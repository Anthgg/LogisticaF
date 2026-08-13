/**
 * Tipos de Fase 045 · Saldos de inventario.
 *
 * Reflejan EXACTAMENTE el contrato publicado por el backend en
 * `backend/app/modules/logistics/inventory/balances/presentation/schemas/schemas.py`
 * (commit 337007b). No se declaran recursos que el backend no exponga.
 */

/**
 * Cantidad decimal canónica.
 *
 * El backend usa `Numeric(38,18)` / `decimal.Decimal`. Se conserva SIEMPRE como
 * string: convertirla con `Number()` o `parseFloat()` perdería dígitos.
 */
export type DecimalString = string

/** Las 8 métricas de `GET /logistics/inventory/balances/summary`. */
export interface InventoryBalanceSummary {
  physical_on_hand: DecimalString
  available_to_promise: DecimalString
  reserved_stock: DecimalString
  blocked_stock: DecimalString
  quarantine_stock: DecimalString
  in_transit_stock: DecimalString
  damaged_stock: DecimalString
  expired_stock: DecimalString
}

export type InventoryBalanceMetricKey = keyof InventoryBalanceSummary

/** Filtros aceptados por el endpoint de resumen. */
export interface InventoryBalanceSummaryFilters {
  organization_id: string
  warehouse_id?: string | null
  product_id?: string | null
}

/** Respuesta de `GET /logistics/inventory/balances/positions/{position_id}`. */
export interface InventoryPositionBalance {
  id: string
  organization_id: string
  branch_id: string
  warehouse_id: string | null
  warehouse_location_id: string | null
  inventory_position_id: string
  product_id: string
  product_version_id: string | null
  base_unit_id: string
  quantity: DecimalString

  availability_state: string
  quality_state: string
  transit_state: string
  damage_state: string
  expiration_state: string

  dimension_key: string
  last_applied_ledger_sequence: number
  data_quality_status: string
  reconciliation_status: string
  calculated_at: string
}

/** Modos de reconstrucción admitidos por el backend. */
export const REBUILD_MODES = [
  'FULL',
  'TOTAL',
  'PARTIAL_WAREHOUSE',
  'PARTIAL_PRODUCT',
] as const

export type RebuildMode = (typeof REBUILD_MODES)[number]

/** Cuerpo de `POST /logistics/inventory/balances/rebuild`. */
export interface RebuildJobCreate {
  organization_id: string
  rebuild_mode: RebuildMode
  target_warehouse_id?: string | null
  target_product_id?: string | null
  as_of_sequence?: number | null
}

/** Respuesta 202 del rebuild. */
export interface RebuildJobRead {
  id: string
  organization_id: string
  rebuild_mode: string
  status: string
  positions_processed: number
  movements_replayed: number
  differences_count: number
  created_at: string
  completed_at: string | null
}
