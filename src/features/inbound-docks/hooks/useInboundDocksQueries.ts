import { useCallback, useMemo } from 'react'
import { useQuery, type QueryState } from './useQuery'
import { inboundDockQueueApi } from '../api/inboundDockQueueApi'
import { warehouseDocksApi } from '../api/warehouseDocksApi'
import { dockAssignmentsApi } from '../api/dockAssignmentsApi'
import { unloadingOperationsApi } from '../api/unloadingOperationsApi'
import { dockOperationalMetricsApi } from '../api/dockOperationalMetricsApi'
import type {
  InboundDockQueueEntry,
  InboundDockQueueListQuery,
  InboundDockQueueSummary,
  PaginatedResponse,
  WarehouseDock,
  WarehouseDockAvailability,
  WarehouseDockListQuery,
  WarehouseDockSummary,
  WarehouseDockBlackout,
  WarehouseDockOperatingWindow,
  InboundDockAssignment,
  DockAssignmentPlan,
  DockAssignmentMetrics,
  DockOperationalTimes,
  DockOperationIntegrity,
  DockOperationHistoryEvent,
  ReceivingScanPreparation,
  UnloadingOperation,
  UnloadingReadinessCheck,
  UnloadingCompletionCheck,
  UnloadingExpectedLoad,
  UnloadingResponsibleAssignment,
  UnloadingEquipmentAssignment,
  UnloadingSealOpening,
  UnloadingPause,
} from '../types/inbound-docks'

/**
 * Bases canonicas del contrato de muelles de entrada.
 *
 * El backend publica estos recursos en la raiz de `/logistics`, NO bajo
 * `/logistics/inbound/...`. Ese prefijo pertenece a las rutas de la UI, que son
 * otra cosa. Todos los clientes deben derivar de aqui.
 */
export const INBOUND_DOCK_ASSIGNMENTS_BASE = '/logistics/inbound-dock-assignments'
export const UNLOADING_OPERATIONS_BASE = '/logistics/unloading-operations'

const FIVE_SECONDS = 5_000
const TEN_SECONDS = 10_000
const THIRTY_SECONDS = 30_000

function normalizePaginatedResponse<T>(
  response: PaginatedResponse<T> | T[] | undefined,
  requestedPage = 1,
  requestedPageSize = 50,
): PaginatedResponse<T> | undefined {
  if (!response || !Array.isArray(response)) return response

  const page = Math.max(1, requestedPage)
  const pageSize = Math.max(1, requestedPageSize)
  const total = response.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize

  return {
    items: response.slice(start, start + pageSize),
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages,
  }
}

function omitUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v
  }
  return out
}

/**
 * Como omitUndefined pero descartando tambien null y cadena vacia.
 *
 * Los filtros opcionales del contrato son UUID: mandar '' obliga al backend a
 * parsearlo y falla. Ausente y "sin valor" deben viajar igual: omitidos.
 */
function omitEmptyParams<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === '') continue
    ;(out as Record<string, unknown>)[k] = v
  }
  return out
}

export function useInboundDockQueue(
  query: InboundDockQueueListQuery,
  options: { refetchIntervalMs?: number | null; enabled?: boolean } = {},
): QueryState<PaginatedResponse<InboundDockQueueEntry>> {
  const stableQuery = useMemo(() => omitUndefined(query as Record<string, unknown>), [query])
  const result = useQuery<PaginatedResponse<InboundDockQueueEntry> | InboundDockQueueEntry[]>(
    ['dock-queue', JSON.stringify(stableQuery)],
    '/logistics/inbound-dock-queue',
    stableQuery as Record<string, unknown>,
    { enabled: options.enabled ?? true, refetchIntervalMs: options.refetchIntervalMs ?? TEN_SECONDS },
  )

  return {
    ...result,
    data: normalizePaginatedResponse(result.data, query.page ?? 1, query.page_size ?? 50),
  } as QueryState<PaginatedResponse<InboundDockQueueEntry>>
}

export function useInboundDockQueueEntry(entryId: string | null | undefined) {
  return useQuery<InboundDockQueueEntry>(
    ['dock-queue-entry', entryId],
    entryId ? `/logistics/inbound-dock-queue/${entryId}` : '',
    undefined,
    { enabled: Boolean(entryId), refetchIntervalMs: FIVE_SECONDS },
  )
}

export function useInboundDockQueueSummary(warehouseId: string | null | undefined) {
  return useQuery<InboundDockQueueSummary>(
    ['dock-queue-summary', warehouseId],
    '/logistics/inbound-dock-queue/summary',
    // Nunca se envia cadena vacia a un parametro UUID: o va el id, o se omite.
    { warehouse_id: warehouseId || undefined },
    { enabled: Boolean(warehouseId), refetchIntervalMs: TEN_SECONDS },
  )
}

export function useWarehouseDocks(
  query: WarehouseDockListQuery,
  options: { refetchIntervalMs?: number | null; enabled?: boolean } = {},
) {
  const stableQuery = useMemo(() => omitUndefined(query as Record<string, unknown>), [query])
  const result = useQuery<PaginatedResponse<WarehouseDockSummary> | WarehouseDockSummary[]>(
    ['warehouse-docks', JSON.stringify(stableQuery)],
    '/logistics/warehouse-docks',
    stableQuery as Record<string, unknown>,
    { enabled: options.enabled ?? true, refetchIntervalMs: options.refetchIntervalMs ?? THIRTY_SECONDS },
  )

  return {
    ...result,
    data: normalizePaginatedResponse(result.data, query.page ?? 1, query.page_size ?? 50),
  } as QueryState<PaginatedResponse<WarehouseDockSummary>>
}

export function useWarehouseDock(dockId: string | null | undefined) {
  return useQuery<WarehouseDock>(
    ['warehouse-dock', dockId],
    dockId ? `/logistics/warehouse-docks/${dockId}` : '',
    undefined,
    { enabled: Boolean(dockId), refetchIntervalMs: THIRTY_SECONDS },
  )
}

export function useWarehouseDockAvailability(dockId: string | null | undefined) {
  return useQuery<WarehouseDockAvailability>(
    ['warehouse-dock-availability', dockId],
    dockId ? `/logistics/warehouse-docks/${dockId}/availability` : '',
    undefined,
    { enabled: Boolean(dockId), refetchIntervalMs: FIVE_SECONDS },
  )
}

export function useWarehouseDockBlackouts(dockId: string | null | undefined) {
  return useQuery<WarehouseDockBlackout[]>(
    ['warehouse-dock-blackouts', dockId],
    dockId ? `/logistics/warehouse-docks/${dockId}/blackouts` : '',
    undefined,
    { enabled: Boolean(dockId), refetchIntervalMs: THIRTY_SECONDS },
  )
}

export function useWarehouseDockOperatingWindows(dockId: string | null | undefined) {
  return useQuery<WarehouseDockOperatingWindow[]>(
    ['warehouse-dock-windows', dockId],
    dockId ? `/logistics/warehouse-docks/${dockId}/operating-windows` : '',
    undefined,
    { enabled: Boolean(dockId), refetchIntervalMs: THIRTY_SECONDS },
  )
}

export function useInboundDockAssignment(assignmentId: string | null | undefined) {
  return useQuery<InboundDockAssignment>(
    ['dock-assignment', assignmentId],
    assignmentId ? `${INBOUND_DOCK_ASSIGNMENTS_BASE}/${assignmentId}` : '',
    undefined,
    { enabled: Boolean(assignmentId), refetchIntervalMs: FIVE_SECONDS },
  )
}

export function useDockAssignmentPlan(planId: string | null | undefined) {
  return useQuery<DockAssignmentPlan>(
    ['dock-assignment-plan', planId],
    planId ? `/logistics/inbound/dock-assignment-plans/${planId}` : '',
    undefined,
    { enabled: Boolean(planId), refetchIntervalMs: FIVE_SECONDS },
  )
}

export function useDockAssignmentMetrics(assignmentId: string | null | undefined) {
  return useQuery<DockAssignmentMetrics>(
    ['dock-assignment-metrics', assignmentId],
    assignmentId ? `${INBOUND_DOCK_ASSIGNMENTS_BASE}/${assignmentId}/metrics` : '',
    undefined,
    { enabled: Boolean(assignmentId), refetchIntervalMs: THIRTY_SECONDS },
  )
}

export function useDockOperationalTimes(assignmentId: string | null | undefined) {
  return useQuery<DockOperationalTimes>(
    ['dock-assignment-times', assignmentId],
    '',  // sin contrato backend
    undefined,
    { enabled: false },
  )
}

export function useDockAssignmentIntegrity(assignmentId: string | null | undefined) {
  return useQuery<DockOperationIntegrity>(
    ['dock-assignment-integrity', assignmentId],
    '',  // sin contrato backend
    undefined,
    { enabled: false },
  )
}

export function useDockAssignmentHistory(assignmentId: string | null | undefined) {
  return useQuery<DockOperationHistoryEvent[]>(
    ['dock-assignment-history', assignmentId],
    assignmentId ? `${INBOUND_DOCK_ASSIGNMENTS_BASE}/${assignmentId}/history` : '',
    undefined,
    { enabled: Boolean(assignmentId), refetchIntervalMs: THIRTY_SECONDS },
  )
}

export function useReceivingPreparationByAssignment(assignmentId: string | null | undefined) {
  return useQuery<ReceivingScanPreparation>(
    ['dock-assignment-receiving-prep', assignmentId],
    '',  // sin contrato backend
    undefined,
    { enabled: false },
  )
}

export function useUnloadingOperation(operationId: string | null | undefined) {
  return useQuery<UnloadingOperation>(
    ['unloading-op', operationId],
    operationId ? `${UNLOADING_OPERATIONS_BASE}/${operationId}` : '',
    undefined,
    { enabled: Boolean(operationId), refetchIntervalMs: FIVE_SECONDS },
  )
}

export function useUnloadingReadinessChecks(operationId: string | null | undefined) {
  return useQuery<UnloadingReadinessCheck[]>(
    ['unloading-readiness', operationId],
    operationId ? `${UNLOADING_OPERATIONS_BASE}/${operationId}/readiness-checks` : '',
    undefined,
    { enabled: Boolean(operationId), refetchIntervalMs: FIVE_SECONDS },
  )
}

export function useUnloadingCompletionChecks(operationId: string | null | undefined) {
  return useQuery<UnloadingCompletionCheck[]>(
    ['unloading-completion', operationId],
    operationId ? `${UNLOADING_OPERATIONS_BASE}/${operationId}/completion-checks` : '',
    undefined,
    { enabled: Boolean(operationId), refetchIntervalMs: FIVE_SECONDS },
  )
}

export function useUnloadingExpectedLoad(operationId: string | null | undefined) {
  return useQuery<UnloadingExpectedLoad>(
    ['unloading-expected', operationId],
    '',  // sin contrato backend
    undefined,
    { enabled: false },
  )
}

export function useUnloadingResponsibles(operationId: string | null | undefined) {
  return useQuery<UnloadingResponsibleAssignment[]>(
    ['unloading-responsibles', operationId],
    operationId ? `${UNLOADING_OPERATIONS_BASE}/${operationId}/responsibles` : '',
    undefined,
    { enabled: Boolean(operationId), refetchIntervalMs: THIRTY_SECONDS },
  )
}

export function useUnloadingEquipment(operationId: string | null | undefined) {
  return useQuery<UnloadingEquipmentAssignment[]>(
    ['unloading-equipment', operationId],
    operationId ? `${UNLOADING_OPERATIONS_BASE}/${operationId}/equipment` : '',
    undefined,
    { enabled: Boolean(operationId), refetchIntervalMs: THIRTY_SECONDS },
  )
}

export function useUnloadingSealOpening(operationId: string | null | undefined) {
  return useQuery<UnloadingSealOpening | null>(
    ['unloading-seal', operationId],
    operationId ? `${UNLOADING_OPERATIONS_BASE}/${operationId}/seal-opening` : '',
    undefined,
    { enabled: Boolean(operationId), refetchIntervalMs: FIVE_SECONDS },
  )
}

export function useUnloadingPauses(operationId: string | null | undefined) {
  return useQuery<UnloadingPause[]>(
    ['unloading-pauses', operationId],
    operationId ? `${UNLOADING_OPERATIONS_BASE}/${operationId}/pauses` : '',
    undefined,
    { enabled: Boolean(operationId), refetchIntervalMs: FIVE_SECONDS },
  )
}

export function useReceivingPreparationByOperation(operationId: string | null | undefined) {
  return useQuery<ReceivingScanPreparation>(
    ['unloading-receiving-prep', operationId],
    operationId ? `${UNLOADING_OPERATIONS_BASE}/${operationId}/receiving-preparation` : '',
    undefined,
    { enabled: Boolean(operationId), refetchIntervalMs: THIRTY_SECONDS },
  )
}

export function useInboundDockAssignments(
  query: {
    warehouse_id?: string
    dock_id?: string
    status?: string
    supplier_id?: string
    carrier_id?: string
    date_from?: string
    date_to?: string
  },
  options: { refetchIntervalMs?: number | null; enabled?: boolean } = {},
) {
  const stable = useMemo(() => omitEmptyParams(query as Record<string, unknown>), [query])
  return useQuery<PaginatedResponse<InboundDockAssignment>>(
    ['dock-assignments', stable],
    INBOUND_DOCK_ASSIGNMENTS_BASE,
    stable as Record<string, unknown>,
    { enabled: options.enabled ?? true, refetchIntervalMs: options.refetchIntervalMs ?? FIVE_SECONDS },
  )
}

export function useUnloadingOperationsList(
  query: {
    warehouse_id?: string
    dock_id?: string
    assignment_id?: string
    status?: string
  },
  options: { refetchIntervalMs?: number | null; enabled?: boolean } = {},
) {
  const stable = useMemo(() => omitEmptyParams(query as Record<string, unknown>), [query])
  return useQuery<PaginatedResponse<UnloadingOperation>>(
    ['unloading-ops', stable],
    UNLOADING_OPERATIONS_BASE,
    stable as Record<string, unknown>,
    { enabled: options.enabled ?? true, refetchIntervalMs: options.refetchIntervalMs ?? FIVE_SECONDS },
  )
}

export function useDockMetricsSummary(
  warehouseId: string | null | undefined,
  range?: { date_from?: string; date_to?: string },
) {
  const stable = useMemo(
    () => omitUndefined({ warehouse_id: warehouseId || undefined, ...(range ?? {}) } as Record<string, unknown>),
    [warehouseId, range?.date_from, range?.date_to],
  )
  return useQuery<ReturnType<typeof dockOperationalMetricsApi.getSummary>>(
    ['dock-metrics-summary', stable],
    '',  // sin contrato backend: no existe un endpoint de resumen
    stable as Record<string, unknown>,
    { enabled: false },
  )
}

export { inboundDockQueueApi, warehouseDocksApi, dockAssignmentsApi, unloadingOperationsApi, dockOperationalMetricsApi }

export function useNoop() {
  return useCallback(() => undefined, [])
}
