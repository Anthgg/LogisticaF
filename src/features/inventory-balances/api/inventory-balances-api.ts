import { apiRequest } from '../../../api/api-client'
import { toDecimalString } from '../decimal'
import type {
  InventoryBalanceSummary,
  InventoryBalanceSummaryFilters,
  InventoryPositionBalance,
  RebuildJobCreate,
  RebuildJobRead,
} from '../types/inventory-balances'

/**
 * Cliente de Fase 045 · Saldos de inventario.
 *
 * El backend (commit 337007b) publica EXACTAMENTE tres operaciones bajo
 * `/logistics/inventory/balances`. No se añade ninguna otra: cualquier método
 * extra sería un endpoint inventado que respondería 404 en runtime.
 *
 *   GET  /summary?organization_id=&warehouse_id=&product_id=
 *   GET  /positions/{position_id}
 *   POST /rebuild                      (CSRF + Step-Up opcional)
 *
 * Usa `apiRequest`, que ya resuelve cookies (`credentials: 'include'`),
 * refresh de sesión, CSRF y normalización de errores.
 */

export const BALANCES_BASE_PATH = '/logistics/inventory/balances'
const BASE = BALANCES_BASE_PATH

const SUMMARY_METRICS = [
  'physical_on_hand',
  'available_to_promise',
  'reserved_stock',
  'blocked_stock',
  'quarantine_stock',
  'in_transit_stock',
  'damaged_stock',
  'expired_stock',
] as const

function buildQuery(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue
    search.set(key, value)
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Pydantic v2 serializa `Decimal` como string, así que el valor llega intacto.
 * Aun así se normaliza defensivamente sin `Number()` por si el serializador
 * cambiara a número: convertir aquí sería perder dígitos de forma silenciosa.
 */
export function normalizeSummary(payload: unknown): InventoryBalanceSummary {
  const raw = (payload ?? {}) as Record<string, unknown>
  const summary = {} as InventoryBalanceSummary
  for (const metric of SUMMARY_METRICS) {
    summary[metric] = toDecimalString(raw[metric])
  }
  return summary
}

export function normalizePositionBalance(payload: unknown): InventoryPositionBalance {
  const raw = (payload ?? {}) as InventoryPositionBalance
  return { ...raw, quantity: toDecimalString(raw.quantity) }
}

export const inventoryBalancesApi = {
  /** GET /logistics/inventory/balances/summary */
  async getSummary(
    filters: InventoryBalanceSummaryFilters,
    signal?: AbortSignal,
  ): Promise<InventoryBalanceSummary> {
    const payload = await apiRequest<unknown>({
      path: `${BASE}/summary${buildQuery({
        organization_id: filters.organization_id,
        warehouse_id: filters.warehouse_id,
        product_id: filters.product_id,
      })}`,
      method: 'GET',
      signal,
    })
    return normalizeSummary(payload)
  },

  /** GET /logistics/inventory/balances/positions/{position_id} */
  async getPositionBalance(
    positionId: string,
    signal?: AbortSignal,
  ): Promise<InventoryPositionBalance> {
    const payload = await apiRequest<unknown>({
      path: `${BASE}/positions/${encodeURIComponent(positionId)}`,
      method: 'GET',
      signal,
    })
    return normalizePositionBalance(payload)
  },

  /**
   * POST /logistics/inventory/balances/rebuild
   *
   * Responde 202. El backend exige CSRF y acepta `X-Step-Up-Proof-ID` cuando
   * el permiso de rebuild está marcado como step-up para el usuario.
   */
  async requestRebuild(
    payload: RebuildJobCreate,
    options: { stepUpProofId?: string | null; signal?: AbortSignal } = {},
  ): Promise<RebuildJobRead> {
    const headers: Record<string, string> = {}
    if (options.stepUpProofId) {
      headers['X-Step-Up-Proof-ID'] = options.stepUpProofId
    }

    return apiRequest<RebuildJobRead>({
      path: `${BASE}/rebuild`,
      method: 'POST',
      body: payload,
      headers,
      requiresCsrf: true,
      signal: options.signal,
    })
  },
}
