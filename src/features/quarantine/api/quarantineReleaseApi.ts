import { apiRequest, getCsrfToken } from '../../../api/api-client'
import { contractGap } from '../../../api/contract-availability'
import type {
  QuarantineReleaseAuthorization,
  RequestQuarantineReleaseRequest,
} from '../types/quarantine'

const BASE = '/logistics/quarantine-release-authorizations'

function generateKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function withCsrf(): Promise<Record<string, string>> {
  const token = await getCsrfToken()
  return { 'X-CSRF-Token': token }
}

export const quarantineReleaseApi = {
  /** POST /quality-quarantine-cases/{caseId}/release-authorizations */
  async createAuthorization(caseId: string, data: RequestQuarantineReleaseRequest): Promise<QuarantineReleaseAuthorization> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `/logistics/quality-quarantine-cases/${caseId}/release-authorizations`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  /** Sin contrato: la única transición publicada después de crear es execute. */
  async approveAuthorization(_releaseId: string, _data?: { decision?: string; comments?: string }): Promise<never> {
    throw contractGap('Aprobar por separado una autorización de liberación')
  },

  /** POST /quarantine-release-authorizations/{releaseId}/execute */
  async execute(releaseId: string): Promise<QuarantineReleaseAuthorization> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/${releaseId}/execute`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: {},
    })
  },

  /** Alias executeRelease to execute */
  async executeRelease(releaseId: string): Promise<QuarantineReleaseAuthorization> {
    return this.execute(releaseId)
  },
}
