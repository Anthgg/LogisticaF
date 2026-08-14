import { apiRequest, getCsrfToken } from '../../../api/api-client'

const BASE = '/logistics/putaway/exceptions'

function generateKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function withCsrf(): Promise<Record<string, string>> {
  const token = await getCsrfToken()
  return { 'X-CSRF-Token': token }
}

export const putawayExceptionsApi = {
  /** POST /putaway/exceptions/{exception_id}/resolve */
  async resolveException(exceptionId: string, resolution: string): Promise<unknown> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/${exceptionId}/resolve`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: { resolution },
    })
  },
}
