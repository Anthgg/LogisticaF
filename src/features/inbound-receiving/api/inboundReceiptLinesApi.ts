import { apiRequest, getCsrfToken } from '../../../api/api-client'
import type {
  InboundReceiptExpectedLine,
  InboundReceivedLine,
  InboundLineComparison,
  InboundReceiptHistoryEvent,
  ApplyQuantityRequest,
  PaginatedResponse,
} from '../types/inbound-receiving'

const BASE = '/logistics/inbound-receipts'
// El detalle de una línea es un recurso propio: `/inbound-receipt-lines/{id}`.
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

export const inboundReceiptLinesApi = {
  async listExpected(receiptId: string, page = 1, pageSize = 50): Promise<PaginatedResponse<InboundReceiptExpectedLine>> {
    return apiRequest({ path: `${BASE}/${receiptId}/expected-lines?page=${page}&page_size=${pageSize}`, method: 'GET' })
  },

  async listReceived(receiptId: string, page = 1, pageSize = 50): Promise<PaginatedResponse<InboundReceivedLine>> {
    return apiRequest({ path: `${BASE}/${receiptId}/received-lines?page=${page}&page_size=${pageSize}`, method: 'GET' })
  },

  async getLine(_receiptId: string, lineId: string): Promise<InboundReceivedLine> {
    return apiRequest({ path: `${LINES_BASE}/${lineId}`, method: 'GET' })
  },

  async getComparison(_receiptId: string, lineId: string): Promise<InboundLineComparison> {
    return apiRequest({ path: `${LINES_BASE}/${lineId}/comparison`, method: 'GET' })
  },

  async getIdentifiers(_receiptId: string, lineId: string): Promise<{ barcodes: string[]; packaging: string[] }> {
    return apiRequest({ path: `${LINES_BASE}/${lineId}/identifiers`, method: 'GET' })
  },

  async getHistory(_receiptId: string, lineId: string): Promise<InboundReceiptHistoryEvent[]> {
    return apiRequest({ path: `${LINES_BASE}/${lineId}/history`, method: 'GET' })
  },

  async applyQuantity(_receiptId: string, data: ApplyQuantityRequest): Promise<InboundReceivedLine> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${LINES_BASE}/${data.line_id}/apply-quantity`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  async validateLine(_receiptId: string, lineId: string): Promise<InboundReceivedLine> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${LINES_BASE}/${lineId}/validate`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: {},
    })
  },
}
