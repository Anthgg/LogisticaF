import { apiRequest, getCsrfToken } from '../../../api/api-client'
import { contractGap } from '../../../api/contract-availability'
import type {
  QuarantineRejectionAuthorization,
  RequestQuarantineRejectionRequest,
} from '../types/quarantine'

const BASE = '/logistics/quarantine-rejection-authorizations'

function generateKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function withCsrf(): Promise<Record<string, string>> {
  const token = await getCsrfToken()
  return { 'X-CSRF-Token': token }
}

export const quarantineRejectionApi = {
  /** Sin contrato global: las autorizaciones se listan dentro de un caso. */
  async list(_query?: Record<string, unknown>): Promise<never> {
    throw contractGap('El listado global de autorizaciones de rechazo')
  },

  /** Sin contrato: no existe detalle individual de una autorización de rechazo. */
  async get(_authorizationId: string): Promise<never> {
    throw contractGap('El detalle individual de una autorización de rechazo')
  },

  /** Sin contrato global: la creación requiere el caso de cuarentena. */
  async create(_data: RequestQuarantineRejectionRequest): Promise<never> {
    throw contractGap('Crear una autorización de rechazo sin caso')
  },

  /** POST /quality-quarantine-cases/{caseId}/rejection-authorizations */
  async createAuthorization(caseId: string, data: RequestQuarantineRejectionRequest): Promise<QuarantineRejectionAuthorization> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `/logistics/quality-quarantine-cases/${caseId}/rejection-authorizations`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  /** Sin contrato: la única transición publicada después de crear es execute. */
  async approveAuthorization(_rejectionId: string, _data?: { decision?: string; comments?: string }): Promise<never> {
    throw contractGap('Aprobar por separado una autorización de rechazo')
  },

  /** POST /quarantine-rejection-authorizations/{rejectionId}/execute */
  async execute(rejectionId: string): Promise<QuarantineRejectionAuthorization> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/${rejectionId}/execute`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: {},
    })
  },

  /** Alias executeRejection to execute */
  async executeRejection(rejectionId: string): Promise<QuarantineRejectionAuthorization> {
    return this.execute(rejectionId)
  },
}
