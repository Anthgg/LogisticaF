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
import { useQuery } from '../hooks/useQuery'

/**
 * Alcances soportados por el contrato.
 *
 * En `/inbound-dock-assignments` y `/unloading-operations` TODOS los filtros
 * son opcionales: el backend acota por el tenant del principal. Exigir
 * `warehouse_id` en el frontend sería más restrictivo que el backend y rompería
 * consumidores legítimos (detalle de muelle con dock_id, detalle de asignación).
 *
 * Lo que sí está prohibido es enviar un valor vacío a un parámetro UUID.
 */

const WAREHOUSE = '22222222-2222-2222-2222-222222222222'
const DOCK = '33333333-3333-3333-3333-333333333333'

let requestSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  requestSpy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({ items: [] } as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function paths(): string[] {
  return requestSpy.mock.calls.map(
    (call: unknown[]) => (call[0] as apiClient.ApiRequestOptions).path,
  )
}

describe('asignaciones de muelle · alcances soportados', () => {
  it('warehouse-only consulta la ruta canónica', async () => {
    renderHook(() => useInboundDockAssignments({ warehouse_id: WAREHOUSE }))
    await vi.waitFor(() => expect(requestSpy).toHaveBeenCalled())

    const [path] = paths()
    expect(path.startsWith(INBOUND_DOCK_ASSIGNMENTS_BASE)).toBe(true)
    expect(path).toContain(`warehouse_id=${WAREHOUSE}`)
    expect(path).not.toContain('/logistics/inbound/dock-assignments')
  })

  it('dock-only SÍ consulta: el contrato lo admite (regresión de WarehouseDockDetailPage)', async () => {
    renderHook(() => useInboundDockAssignments({ dock_id: DOCK }))
    await vi.waitFor(() => expect(requestSpy).toHaveBeenCalled())

    const [path] = paths()
    expect(path).toContain(`dock_id=${DOCK}`)
    expect(path).not.toContain('warehouse_id')
  })

  it('sin ningún filtro consulta igualmente: el backend acota por tenant', async () => {
    renderHook(() => useInboundDockAssignments({}))
    await vi.waitFor(() => expect(requestSpy).toHaveBeenCalled())

    expect(paths()[0]).toBe(INBOUND_DOCK_ASSIGNMENTS_BASE)
  })

  it('nunca envía un UUID vacío', async () => {
    renderHook(() => useInboundDockAssignments({ warehouse_id: '', dock_id: DOCK }))
    await vi.waitFor(() => expect(requestSpy).toHaveBeenCalled())

    const [path] = paths()
    expect(path).not.toContain('warehouse_id=')
    expect(path).toContain(`dock_id=${DOCK}`)
  })
})

describe('operaciones de descarga · alcances soportados', () => {
  it('assignment-only SÍ consulta (regresión de InboundDockAssignmentDetailPage)', async () => {
    const assignment = '44444444-4444-4444-4444-444444444444'
    renderHook(() => useUnloadingOperationsList({ assignment_id: assignment }))
    await vi.waitFor(() => expect(requestSpy).toHaveBeenCalled())

    const [path] = paths()
    expect(path.startsWith(UNLOADING_OPERATIONS_BASE)).toBe(true)
    expect(path).toContain(`assignment_id=${assignment}`)
  })

  it('dock-only también consulta', async () => {
    renderHook(() => useUnloadingOperationsList({ dock_id: DOCK }))
    await vi.waitFor(() => expect(requestSpy).toHaveBeenCalled())

    expect(paths()[0]).toContain(`dock_id=${DOCK}`)
  })

  it('warehouse-only también consulta', async () => {
    renderHook(() => useUnloadingOperationsList({ warehouse_id: WAREHOUSE }))
    await vi.waitFor(() => expect(requestSpy).toHaveBeenCalled())

    expect(paths()[0]).toContain(`warehouse_id=${WAREHOUSE}`)
  })
})

describe('resumen de cola · parámetro obligatorio', () => {
  it('sin almacén no consulta y con almacén nunca manda vacío', async () => {
    renderHook(() => useInboundDockQueueSummary(''))
    expect(requestSpy).not.toHaveBeenCalled()

    renderHook(() => useInboundDockQueueSummary(WAREHOUSE))
    await vi.waitFor(() => expect(requestSpy).toHaveBeenCalled())
    expect(paths().at(-1)).toContain(`warehouse_id=${WAREHOUSE}`)
    expect(paths().every((path) => !path.endsWith('warehouse_id='))).toBe(true)
  })
})

describe('seguridad de path vacío', () => {
  it('enabled con path vacío no ejecuta ninguna petición', async () => {
    renderHook(() => useQuery(['sin-path'], '', undefined, { enabled: true }))

    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(requestSpy).not.toHaveBeenCalled()
  })

  it('tampoco arranca el polling con path vacío', async () => {
    renderHook(() => useQuery(['sin-path-polling'], '', undefined, { enabled: true, refetchIntervalMs: 20 }))

    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(requestSpy).not.toHaveBeenCalled()
  })
})
