import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, getCsrfToken } from '../../../api/api-client'
import { qualityDispositionDecisionsApi } from './qualityDispositionDecisionsApi'
import { qualityInspectionEvidenceApi } from './qualityInspectionEvidenceApi'
import { qualityInspectionsApi } from './qualityInspectionsApi'
import { quarantineRejectionApi } from './quarantineRejectionApi'
import { quarantineReleaseApi } from './quarantineReleaseApi'
import { quarantineZonesApi } from './quarantineZonesApi'

vi.mock('../../../api/api-client', () => ({ apiRequest: vi.fn(), getCsrfToken: vi.fn() }))

const request = vi.mocked(apiRequest)
const csrf = vi.mocked(getCsrfToken)

describe('contrato HTTP de cuarentena F042', () => {
  beforeEach(() => {
    request.mockReset()
    csrf.mockReset()
    csrf.mockResolvedValue('csrf-token')
    request.mockResolvedValue({} as never)
  })

  it('usa únicamente GET evidence y POST evidence-links para evidencia', async () => {
    await qualityInspectionEvidenceApi.list('inspection-1')
    await qualityInspectionEvidenceApi.createLink('inspection-1', { file_id: 'file-1' })

    expect(request).toHaveBeenNthCalledWith(1, {
      path: '/logistics/quality-inspections/inspection-1/evidence',
    })
    expect(request).toHaveBeenNthCalledWith(2, {
      path: '/logistics/quality-inspections/inspection-1/evidence-links',
      method: 'POST',
      headers: { 'X-CSRF-Token': 'csrf-token', 'Idempotency-Key': expect.any(String) },
      body: { file_id: 'file-1' },
    })
  })

  it('no emite requests para upload, archive ni transiciones de inspección ausentes', async () => {
    await expect(qualityInspectionEvidenceApi.createUploadSession('inspection-1', {})).rejects.toMatchObject({ status: 501 })
    await expect(qualityInspectionEvidenceApi.archive('evidence-1')).rejects.toMatchObject({ status: 501 })
    await expect(qualityInspectionsApi.pause('inspection-1')).rejects.toMatchObject({ status: 501 })
    await expect(qualityInspectionsApi.resume('inspection-1')).rejects.toMatchObject({ status: 501 })
    await expect(qualityInspectionsApi.startControl('control-1')).rejects.toMatchObject({ status: 501 })
    await expect(qualityInspectionsApi.markControlNotApplicable('control-1')).rejects.toMatchObject({ status: 501 })
    await expect(qualityInspectionsApi.requestControlResultCorrection('control-1', {})).rejects.toMatchObject({ status: 501 })

    expect(request).not.toHaveBeenCalled()
  })

  it('mantiene decisiones y autorizaciones sobre las rutas publicadas', async () => {
    await qualityDispositionDecisionsApi.create('case-1', {} as never)
    await qualityDispositionDecisionsApi.approve('decision-1', {})
    await quarantineRejectionApi.createAuthorization('case-1', {} as never)
    await quarantineRejectionApi.execute('rejection-1')
    await quarantineReleaseApi.createAuthorization('case-1', {} as never)
    await quarantineReleaseApi.execute('release-1')

    expect(request.mock.calls.map(([call]) => [call.method ?? 'GET', call.path])).toEqual([
      ['POST', '/logistics/quality-quarantine-cases/case-1/decisions'],
      ['POST', '/logistics/quality-disposition-decisions/decision-1/approve'],
      ['POST', '/logistics/quality-quarantine-cases/case-1/rejection-authorizations'],
      ['POST', '/logistics/quarantine-rejection-authorizations/rejection-1/execute'],
      ['POST', '/logistics/quality-quarantine-cases/case-1/release-authorizations'],
      ['POST', '/logistics/quarantine-release-authorizations/release-1/execute'],
    ])
  })

  it('no emite requests para listados o aprobaciones de autorización inexistentes', async () => {
    await expect(qualityDispositionDecisionsApi.submit('decision-1')).rejects.toMatchObject({ status: 501 })
    await expect(quarantineRejectionApi.list()).rejects.toMatchObject({ status: 501 })
    await expect(quarantineRejectionApi.get('rejection-1')).rejects.toMatchObject({ status: 501 })
    await expect(quarantineRejectionApi.create({} as never)).rejects.toMatchObject({ status: 501 })
    await expect(quarantineRejectionApi.approveAuthorization('rejection-1')).rejects.toMatchObject({ status: 501 })
    await expect(quarantineReleaseApi.approveAuthorization('release-1')).rejects.toMatchObject({ status: 501 })
    expect(request).not.toHaveBeenCalled()
  })

  it('limita zonas a listado y creación, sin transiciones inventadas', async () => {
    await quarantineZonesApi.list({ warehouse_id: 'warehouse-1' })
    await quarantineZonesApi.create({ code: 'Q-01' })
    expect(request.mock.calls.map(([call]) => [call.method ?? 'GET', call.path])).toEqual([
      ['GET', '/logistics/quarantine-zones?warehouse_id=warehouse-1'],
      ['POST', '/logistics/quarantine-zones'],
    ])

    request.mockClear()
    await expect(quarantineZonesApi.activateZone('zone-1')).rejects.toMatchObject({ status: 501 })
    await expect(quarantineZonesApi.blockZone('zone-1')).rejects.toMatchObject({ status: 501 })
    await expect(quarantineZonesApi.archiveZone('zone-1')).rejects.toMatchObject({ status: 501 })
    expect(request).not.toHaveBeenCalled()
  })
})
