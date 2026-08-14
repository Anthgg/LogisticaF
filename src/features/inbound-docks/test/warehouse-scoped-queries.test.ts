import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from '../../../api/api-client'
import {
  INBOUND_DOCK_ASSIGNMENTS_BASE,
  UNLOADING_OPERATIONS_BASE,
  useInboundDockAssignments,
  useInboundDockQueueSummary,
  useUnloadingOperationsList,
} from '../hooks/useInboundDocksQueries'

/**
 * Regresión de la tormenta de peticiones.
 *
 * Sin almacén resuelto estas consultas no deben ejecutarse ni arrancar su
 * polling. Antes se enviaba `?warehouse_id=` (cadena vacía) a un parámetro
 * UUID, generando ruido de red y respuestas de error en bucle.
 */

const WAREHOUSE = '22222222-2222-2222-2222-222222222222'

let requestSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  requestSpy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({ items: [] } as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function paths() {
  return requestSpy.mock.calls.map(
    (call: unknown[]) => (call[0] as apiClient.ApiRequestOptions).path,
  )
}

describe('consultas dependientes de almacén', () => {
  it('A · con warehouse undefined no se ejecuta ninguna petición', () => {
    renderHook(() => useInboundDockAssignments({ warehouse_id: undefined }))
    renderHook(() => useUnloadingOperationsList({ warehouse_id: undefined }))

    expect(requestSpy).not.toHaveBeenCalled()
  })

  it('B · con warehouse null tampoco se ejecuta', () => {
    renderHook(() =>
      useInboundDockAssignments({ warehouse_id: null as unknown as undefined }),
    )
    renderHook(() =>
      useUnloadingOperationsList({ warehouse_id: null as unknown as undefined }),
    )

    expect(requestSpy).not.toHaveBeenCalled()
  })

  it("C · con warehouse '' tampoco se ejecuta", () => {
    renderHook(() => useInboundDockAssignments({ warehouse_id: '' }))
    renderHook(() => useUnloadingOperationsList({ warehouse_id: '' }))

    expect(requestSpy).not.toHaveBeenCalled()
  })

  it('D · con un UUID válido se consulta la ruta canónica', async () => {
    renderHook(() => useInboundDockAssignments({ warehouse_id: WAREHOUSE }))
    await vi.waitFor(() => expect(requestSpy).toHaveBeenCalled())

    const [path] = paths()
    expect(path.startsWith(INBOUND_DOCK_ASSIGNMENTS_BASE)).toBe(true)
    expect(path).toContain(`warehouse_id=${WAREHOUSE}`)
    // La ruta legacy no existe en el backend.
    expect(path).not.toContain('/logistics/inbound/dock-assignments')
  })

  it('D · unloading usa la ruta canónica del contrato', async () => {
    renderHook(() => useUnloadingOperationsList({ warehouse_id: WAREHOUSE }))
    await vi.waitFor(() => expect(requestSpy).toHaveBeenCalled())

    const [path] = paths()
    expect(path.startsWith(UNLOADING_OPERATIONS_BASE)).toBe(true)
    expect(path).not.toContain('/logistics/inbound/unloading')
  })

  it('E · el resumen de cola nunca envía warehouse_id vacío', async () => {
    renderHook(() => useInboundDockQueueSummary(''))
    expect(requestSpy).not.toHaveBeenCalled()

    renderHook(() => useInboundDockQueueSummary(WAREHOUSE))
    await vi.waitFor(() => expect(requestSpy).toHaveBeenCalled())
    expect(paths().at(-1)).toContain(`warehouse_id=${WAREHOUSE}`)
    expect(paths().every((p: string) => !p.includes('warehouse_id=&'))).toBe(true)
    expect(paths().every((p: string) => !p.endsWith('warehouse_id='))).toBe(true)
  })

  it('E · sin almacén no arranca el polling', async () => {
    // Intervalo muy corto y espera real: los timers falsos globales
    // contaminaban a userEvent en otros archivos de la suite.
    renderHook(() =>
      useInboundDockAssignments({ warehouse_id: undefined }, { refetchIntervalMs: 20 }),
    )

    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(requestSpy).not.toHaveBeenCalled()
  })
})
