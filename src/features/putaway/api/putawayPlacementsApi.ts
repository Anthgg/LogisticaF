import { apiRequest, getCsrfToken } from '../../../api/api-client'
import type { PutawayOperationalPlacementApi } from '../types/putaway-api'

const BASE = '/logistics/putaway/placements'

function generateKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function withCsrf(): Promise<Record<string, string>> {
  const token = await getCsrfToken()
  return { 'X-CSRF-Token': token }
}

export const putawayPlacementsApi = {
  /** POST /putaway/placements/{confirmation_id}/finalize */
  async finalizePlacement(confirmationId: string): Promise<PutawayOperationalPlacementApi> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/${confirmationId}/finalize`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
    })
  },
}
