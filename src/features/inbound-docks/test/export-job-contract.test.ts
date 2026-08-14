import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../../api/api-client'
import { DOCK_OPERATION_EXPORTS_BASE, dockAssignmentsApi } from '../api/dockAssignmentsApi'
import { useQuery } from '../hooks/useQuery'
import type { DockOperationExportJob } from '../types/inbound-docks'

/**
 * Contrato del job de exportación de operaciones de muelle.
 *
 * El recurso real es `/logistics/dock-operation-exports`. Antes el diálogo
 * consultaba con path vacío y `enabled: Boolean(jobId)`, así que el sondeo
 * nunca obtenía estado ni `download_url`.
 */

const JOB_ID = '55555555-5555-5555-5555-555555555555'

let requestSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  requestSpy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({} as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function lastCall(): apiClient.ApiRequestOptions {
  return requestSpy.mock.calls.at(-1)?.[0] as apiClient.ApiRequestOptions
}

describe('job de exportación de muelles', () => {
  it('la base apunta al recurso real del contrato', () => {
    expect(DOCK_OPERATION_EXPORTS_BASE).toBe('/logistics/dock-operation-exports')
  })

  it('consultar el job usa el endpoint real por id', async () => {
    await dockAssignmentsApi.getExportJob(JOB_ID)

    const call = lastCall()
    expect(call.path).toBe(`${DOCK_OPERATION_EXPORTS_BASE}/${JOB_ID}`)
    expect(call.method).toBe('GET')
  })

  it('sin jobId no se consulta nada', async () => {
    renderHook(() =>
      useQuery<DockOperationExportJob>(['dock-export-job', null], '', undefined, {
        enabled: false,
      }),
    )

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(requestSpy).not.toHaveBeenCalled()
  })

  it('nunca se sondea con path vacío aunque esté habilitado', async () => {
    renderHook(() =>
      useQuery<DockOperationExportJob>(['dock-export-job', JOB_ID], '', undefined, {
        enabled: true,
        refetchIntervalMs: 20,
      }),
    )

    await new Promise((resolve) => setTimeout(resolve, 120))
    expect(requestSpy).not.toHaveBeenCalled()
  })

  it('con jobId consulta la ruta real y propaga download_url', async () => {
    requestSpy.mockResolvedValue({
      id: JOB_ID,
      status: 'READY',
      download_url: 'https://example.invalid/export.csv',
    } as never)

    const { result } = renderHook(() =>
      useQuery<DockOperationExportJob>(
        ['dock-export-job', JOB_ID],
        `${DOCK_OPERATION_EXPORTS_BASE}/${JOB_ID}`,
        undefined,
        { enabled: true },
      ),
    )

    await vi.waitFor(() => expect(result.current.data).toBeDefined())
    expect(lastCall().path).toBe(`${DOCK_OPERATION_EXPORTS_BASE}/${JOB_ID}`)
    expect(result.current.data?.download_url).toBe('https://example.invalid/export.csv')
  })
})
