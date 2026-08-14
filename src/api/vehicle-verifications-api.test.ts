import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, getCsrfToken } from './api-client'
import { vehicleVerificationsApi } from './vehicle-verifications-api'

vi.mock('./api-client', () => ({ apiRequest: vi.fn(), getCsrfToken: vi.fn() }))

const request = vi.mocked(apiRequest)
const csrf = vi.mocked(getCsrfToken)

describe('vehicleVerificationsApi F045', () => {
  beforeEach(() => {
    request.mockReset()
    csrf.mockReset()
    csrf.mockResolvedValue('csrf-token')
  })

  it('lista exclusivamente por vehicle_id', async () => {
    request.mockResolvedValue([])
    await vehicleVerificationsApi.listByVehicle('vehicle-1')
    expect(request).toHaveBeenCalledWith({ path: '/logistics/vehicles/vehicle-1/verifications' })
  })

  it('aplica una verificación mediante el POST real', async () => {
    request.mockResolvedValue({} as never)
    const body = { selected_fields: ['owner'], reason: 'Validación', expected_vehicle_version: 3 }
    await vehicleVerificationsApi.applyVerification('verification-1', body)
    expect(request).toHaveBeenCalledWith({
      path: '/logistics/vehicle-verifications/verification-1/apply',
      method: 'POST',
      headers: { 'X-CSRF-Token': 'csrf-token' },
      body,
    })
  })

  it('no solicita listado global, detalle ni evidencia por verification_id', async () => {
    await expect(vehicleVerificationsApi.list()).rejects.toMatchObject({ status: 501 })
    await expect(vehicleVerificationsApi.get('verification-1')).rejects.toMatchObject({ status: 501 })
    await expect(vehicleVerificationsApi.getEvidenceMetadata('verification-1', 'evidence-1')).rejects.toMatchObject({ status: 501 })
    expect(request).not.toHaveBeenCalled()
  })

  it('no fabrica listas para capacidades futuras sin backend', async () => {
    await expect(vehicleVerificationsApi.listConflicts()).rejects.toMatchObject({ status: 501 })
    await expect(vehicleVerificationsApi.listRequirements()).rejects.toMatchObject({ status: 501 })
    await expect(vehicleVerificationsApi.listReviewTasks()).rejects.toMatchObject({ status: 501 })
    await expect(vehicleVerificationsApi.listAssistedVerifications()).rejects.toMatchObject({ status: 501 })
    expect(request).not.toHaveBeenCalled()
  })
})
