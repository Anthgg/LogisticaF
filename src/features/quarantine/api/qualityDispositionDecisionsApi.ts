import { apiRequest, getCsrfToken } from '../../../api/api-client'
import { contractGap } from '../../../api/contract-availability'
import type {
  QualityDispositionDecision,
  CreateQualityDispositionDecisionRequest,
} from '../types/quarantine'

const BASE = '/logistics/quality-disposition-decisions'

function generateKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function withCsrf(): Promise<Record<string, string>> {
  const token = await getCsrfToken()
  return { 'X-CSRF-Token': token }
}

export const qualityDispositionDecisionsApi = {
  /** POST /quality-quarantine-cases/{caseId}/disposition-decisions */
  async create(caseId: string, data: CreateQualityDispositionDecisionRequest): Promise<QualityDispositionDecision> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `/logistics/quality-quarantine-cases/${caseId}/decisions`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  /** Sin contrato: la decisión se crea y luego puede aprobarse; no existe submit. */
  async submit(_decisionId: string): Promise<never> {
    throw contractGap('Enviar una decisión de disposición')
  },

  /** POST /quality-disposition-decisions/{decisionId}/approve */
  async approve(decisionId: string, data: Record<string, unknown>): Promise<QualityDispositionDecision> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/${decisionId}/approve`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },
}
