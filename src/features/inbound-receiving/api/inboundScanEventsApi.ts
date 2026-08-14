import { apiRequest, getCsrfToken } from '../../../api/api-client'
import { contractGap } from '../../../api/contract-availability'
import type {
  BarcodeSymbology,
  InboundScanEvent,
  InboundCodeResolution,
  CreateInboundScanEventRequest,
  CreateInboundScanEventBatchRequest,
  CompensateScanRequest,
  ResolveUnknownScanRequest,
  ManualEntryRequest,
  PaginatedResponse,
} from '../types/inbound-receiving'

const BASE = '/logistics/inbound-receipts'
// Un evento de escaneo es un recurso propio en cuanto existe; solo su creación
// y su listado cuelgan del acta.
const EVENTS_BASE = '/logistics/inbound-scan-events'

async function withCsrf(): Promise<Record<string, string>> {
  const token = await getCsrfToken()
  return { 'X-CSRF-Token': token }
}

function generateKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const inboundScanEventsApi = {
  async create(receiptId: string, data: CreateInboundScanEventRequest): Promise<InboundScanEvent> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/${receiptId}/scan-events`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  async createBatch(receiptId: string, data: CreateInboundScanEventBatchRequest): Promise<InboundScanEvent[]> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/${receiptId}/scan-events/batch`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  async list(receiptId: string, page = 1, pageSize = 50): Promise<PaginatedResponse<InboundScanEvent>> {
    return apiRequest({ path: `${BASE}/${receiptId}/scan-events?page=${page}&page_size=${pageSize}`, method: 'GET' })
  },

  async get(_receiptId: string, eventId: string): Promise<InboundScanEvent> {
    return apiRequest({ path: `${EVENTS_BASE}/${eventId}`, method: 'GET' })
  },

  async compensate(_receiptId: string, data: CompensateScanRequest): Promise<InboundScanEvent> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${EVENTS_BASE}/${data.event_id}/compensate`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  /**
   * La resolución no cuelga del evento: el backend resuelve el CÓDIGO contra el
   * acta (`POST .../resolve-code`), que es lo que permite proponer líneas y
   * productos candidatos antes de decidir.
   */
  async resolve(receiptId: string, rawCode: string, symbology: BarcodeSymbology): Promise<InboundCodeResolution> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/${receiptId}/resolve-code`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: { raw_code: rawCode, symbology },
    })
  },

  async listUnresolved(receiptId: string): Promise<InboundScanEvent[]> {
    return apiRequest({ path: `${BASE}/${receiptId}/unresolved-scans`, method: 'GET' })
  },

  async resolveUnknown(receiptId: string, _eventId: string, data: ResolveUnknownScanRequest): Promise<InboundScanEvent> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/${receiptId}/resolve-unresolved-scan`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: {
        product_id: data.target_product_id ?? null,
        expected_line_id: data.target_line_id ?? null,
        reason: data.reason ?? null,
      },
    })
  },

  /**
   * El backend no modela la digitación manual como un recurso aparte: es un
   * evento de escaneo con `scan_source` manual seguido de `apply-quantity`
   * sobre la línea. Sin ese flujo en la UI no hay nada que emitir.
   */
  async manualEntry(_receiptId: string, _data: ManualEntryRequest): Promise<InboundScanEvent> {
    throw contractGap('La digitación manual como recurso propio')
  },
}
