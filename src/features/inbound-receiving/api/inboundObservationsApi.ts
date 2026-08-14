import { apiRequest, getCsrfToken } from '../../../api/api-client'
import type {
  InboundLotObservation,
  InboundSerialObservation,
  InboundExpirationObservation,
  CreateLotObservationRequest,
  CreateSerialObservationRequest,
  CreateSerialBatchRequest,
  CreateExpirationObservationRequest,
  PaginatedResponse,
} from '../types/inbound-receiving'

// Las observaciones cuelgan de la LÍNEA, no del acta: el backend las publica
// como `/inbound-receipt-lines/{line_id}/...`. El `receiptId` se conserva en la
// firma porque es lo que identifica el acta en la UI.
const LINES_BASE = '/logistics/inbound-receipt-lines'

async function withCsrf(): Promise<Record<string, string>> {
  const token = await getCsrfToken()
  return { 'X-CSRF-Token': token }
}

function generateKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const inboundObservationsApi = {
  // ── Lotes ───────────────────────────────────────────────────────────────────
  async listLots(_receiptId: string, lineId: string): Promise<InboundLotObservation[]> {
    return apiRequest({ path: `${LINES_BASE}/${lineId}/lot-observations`, method: 'GET' })
  },

  async createLot(_receiptId: string, data: CreateLotObservationRequest): Promise<InboundLotObservation> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${LINES_BASE}/${data.line_id}/lot-observations`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  // ── Series ──────────────────────────────────────────────────────────────────
  async listSerials(_receiptId: string, lineId: string, page = 1, pageSize = 100): Promise<PaginatedResponse<InboundSerialObservation>> {
    return apiRequest({ path: `${LINES_BASE}/${lineId}/serial-observations?page=${page}&page_size=${pageSize}`, method: 'GET' })
  },

  async createSerial(_receiptId: string, data: CreateSerialObservationRequest): Promise<InboundSerialObservation> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${LINES_BASE}/${data.line_id}/serial-observations`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  async createSerialBatch(_receiptId: string, data: CreateSerialBatchRequest): Promise<InboundSerialObservation[]> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${LINES_BASE}/${data.line_id}/serial-observations/batch`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  // ── Vencimientos ────────────────────────────────────────────────────────────
  async listExpirations(_receiptId: string, lineId: string): Promise<InboundExpirationObservation[]> {
    return apiRequest({ path: `${LINES_BASE}/${lineId}/expiration-observations`, method: 'GET' })
  },

  async createExpiration(_receiptId: string, data: CreateExpirationObservationRequest): Promise<InboundExpirationObservation> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${LINES_BASE}/${data.line_id}/expiration-observations`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },
}
