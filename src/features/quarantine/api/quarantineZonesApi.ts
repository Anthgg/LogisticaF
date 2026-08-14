import { apiRequest, getCsrfToken } from '../../../api/api-client'
import { contractGap } from '../../../api/contract-availability'

const ZONES_BASE = '/logistics/quarantine-zones'

function generateKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function withCsrf(): Promise<Record<string, string>> {
  const token = await getCsrfToken()
  return { 'X-CSRF-Token': token }
}

function buildQuery(params: Record<string, unknown>): string {
  const entries: [string, string][] = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) {
      for (const item of v) entries.push([k, String(item)])
    } else {
      entries.push([k, String(v)])
    }
  }
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : ''
}

export interface QuarantineZone {
  zone_id: string
  code: string
  name: string
  warehouse_id: string
  warehouse_name: string
  location_id: string | null
  location_name: string | null
  status: 'ACTIVE' | 'BLOCKED' | 'ARCHIVED'
  allowed_categories: string[]
  temperature_min: string | null
  temperature_max: string | null
  restrictions: string[]
  capacity_reference: string | null
  priority: number
  created_at: string
  updated_at: string
}

export const quarantineZonesApi = {
  /** GET /quarantine-zones */
  async list(query?: Record<string, unknown>): Promise<QuarantineZone[]> {
    return apiRequest({ path: `${ZONES_BASE}${query ? buildQuery(query) : ''}`, method: 'GET' })
  },

  /** POST /quarantine-zones */
  async create(data: Record<string, unknown>): Promise<QuarantineZone> {
    const csrf = await withCsrf()
    return apiRequest({
      path: ZONES_BASE,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  /** Sin contrato: F045 solo publica listado y creación de zonas. */
  async activateZone(_zoneId: string): Promise<never> {
    throw contractGap('Activar una zona de cuarentena')
  },

  /** Sin contrato: F045 solo publica listado y creación de zonas. */
  async blockZone(_zoneId: string): Promise<never> {
    throw contractGap('Bloquear una zona de cuarentena')
  },

  /** Sin contrato: F045 solo publica listado y creación de zonas. */
  async archiveZone(_zoneId: string): Promise<never> {
    throw contractGap('Archivar una zona de cuarentena')
  },
}
