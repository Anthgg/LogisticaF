import { apiRequest, getCsrfToken } from '../../../api/api-client'

export interface QualitySamplingContract {
  id: string
  control_id: string
  sampling_type: string
  fixed_count: number | null
  percentage: string | null
  minimum_count: number | null
  package_level: string | null
  lot_level: string | null
  custom_formula: string | null
  description: string | null
  created_at: string
}

export interface QualitySamplingContractRequest {
  sampling_type: string
  fixed_count?: number | null
  percentage?: string | null
  minimum_count?: number | null
  package_level?: string | null
  lot_level?: string | null
  custom_formula?: string | null
  description?: string | null
}

const BASE = '/logistics/quality-inspection-plans'

function generateKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function withCsrf(): Promise<Record<string, string>> {
  const token = await getCsrfToken()
  return { 'X-CSRF-Token': token }
}

export const qualitySamplingPlansApi = {
  /** GET /quality-inspection-plans/controls/{controlId}/samplings */
  async list(controlId: string): Promise<QualitySamplingContract[]> {
    return apiRequest({ path: `${BASE}/controls/${controlId}/samplings`, method: 'GET' })
  },

  /** POST /quality-inspection-plans/controls/{controlId}/samplings */
  async create(controlId: string, data: QualitySamplingContractRequest): Promise<QualitySamplingContract> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/controls/${controlId}/samplings`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  /** PATCH /quality-inspection-plans/samplings/{samplingId} */
  async update(samplingId: string, data: QualitySamplingContractRequest): Promise<QualitySamplingContract> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/samplings/${samplingId}`,
      method: 'PATCH',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  /** DELETE /quality-inspection-plans/samplings/{samplingId} */
  async delete(samplingId: string): Promise<void> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/samplings/${samplingId}`,
      method: 'DELETE',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
    })
  },
}
