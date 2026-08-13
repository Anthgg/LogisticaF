import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../../components/common/PageHeader'
import { Button } from '../../../components/common/Button'
import { Alert } from '../../../components/common/Alert'
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton'
import { LogisticsIcon } from '../../../components/common/LogisticsIcon'
import type { LogisticsIconName } from '../../../components/common/LogisticsIcon'
import { useLogisticsPermissions } from '../../logistics-permissions/hooks/useLogisticsPermissions'
import { useLogisticsContextSelector } from '../../logistics-permissions/hooks/useLogisticsContextSelector'
import { LOGISTICS_PERMISSIONS } from '../../logistics-permissions/logistics-permissions-map'
import { productsCatalogApi } from '../../../api/products-catalog-api'
import type { Product } from '../../../types/products-catalog'
import { DecimalDisplay } from '../components/DecimalDisplay'
import { useBalanceSummary, useRebuildBalances } from '../hooks/useInventoryBalances'
import { isZeroDecimal } from '../decimal'
import type {
  InventoryBalanceMetricKey,
  RebuildMode,
} from '../types/inventory-balances'

interface MetricDefinition {
  key: InventoryBalanceMetricKey
  label: string
  icon: LogisticsIconName
  hint: string
}

/** Las 8 métricas publicadas por el backend, en el orden del contrato. */
const METRICS: MetricDefinition[] = [
  { key: 'physical_on_hand', label: 'Stock físico', icon: 'box', hint: 'Existencias totales en almacén' },
  { key: 'available_to_promise', label: 'Disponible', icon: 'check', hint: 'Disponible operativo (ATP)' },
  { key: 'reserved_stock', label: 'Reservado', icon: 'lock', hint: 'Comprometido con pedidos' },
  { key: 'blocked_stock', label: 'Bloqueado', icon: 'shield', hint: 'Bloqueado operativamente' },
  { key: 'quarantine_stock', label: 'Cuarentena', icon: 'alert', hint: 'Retenido por calidad' },
  { key: 'in_transit_stock', label: 'En tránsito', icon: 'truck', hint: 'En movimiento entre almacenes o compras' },
  { key: 'damaged_stock', label: 'Dañado', icon: 'x', hint: 'Registrado como dañado' },
  { key: 'expired_stock', label: 'Vencido', icon: 'clock', hint: 'Fuera de fecha de caducidad' },
]

const REBUILD_MODE_LABELS: Record<RebuildMode, string> = {
  FULL: 'Completo',
  TOTAL: 'Total',
  PARTIAL_WAREHOUSE: 'Parcial por almacén',
  PARTIAL_PRODUCT: 'Parcial por producto',
}

export function InventoryStockDashboardPage() {
  const { hasPermission, hasAnyPermission, requiresStepUp, isLoading: permissionsLoading } =
    useLogisticsPermissions()
  const { context, options, selectContext } = useLogisticsContextSelector()

  const organizationId = context.organization_id
  const [warehouseId, setWarehouseId] = useState<string>('')
  const [productId, setProductId] = useState<string>('')
  const [products, setProducts] = useState<Product[]>([])
  const [confirmingRebuild, setConfirmingRebuild] = useState(false)
  const [rebuildMode, setRebuildMode] = useState<RebuildMode>('FULL')

  const canRead = hasPermission(LOGISTICS_PERMISSIONS.inventoryBalances.read)
  const canRebuild = hasAnyPermission([
    LOGISTICS_PERMISSIONS.inventoryBalances.rebuild,
    LOGISTICS_PERMISSIONS.inventoryBalances.rebuildViaLedger,
  ])

  // Al cambiar de organización los filtros del tenant anterior dejan de aplicar.
  useEffect(() => {
    setWarehouseId('')
    setProductId('')
  }, [organizationId])

  // Catálogo real de productos; nunca se pide un UUID a mano.
  useEffect(() => {
    if (!canRead) return
    let cancelled = false
    productsCatalogApi
      .list({ page: 1, page_size: 100 })
      .then((response) => {
        if (!cancelled) setProducts(response.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setProducts([])
      })
    return () => {
      cancelled = true
    }
  }, [canRead, organizationId])

  const summary = useBalanceSummary({
    organizationId: canRead ? organizationId : null,
    warehouseId: warehouseId || null,
    productId: productId || null,
  })

  const rebuild = useRebuildBalances(() => {
    setConfirmingRebuild(false)
    void summary.refetch()
  })

  const allZero = useMemo(
    () => (summary.data ? METRICS.every((m) => isZeroDecimal(summary.data![m.key])) : false),
    [summary.data],
  )

  if (permissionsLoading) {
    return <LoadingSkeleton rows={4} />
  }

  if (!canRead) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Fase 045" title="Saldos de inventario" />
        <Alert variant="error">
          No tienes el permiso <code>logistics.inventory.read</code> necesario para consultar los
          saldos de inventario.
        </Alert>
      </div>
    )
  }

  const stepUpRequired =
    requiresStepUp(LOGISTICS_PERMISSIONS.inventoryBalances.rebuild) ||
    requiresStepUp(LOGISTICS_PERMISSIONS.inventoryBalances.rebuildViaLedger)

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        eyebrow="Fase 045"
        title="Saldos de inventario"
        description="Proyección consolidada del libro de movimientos. Es una lectura calculada: no se editan cantidades desde aquí."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="small"
              variant="ghost"
              onClick={() => void summary.refetch()}
              disabled={summary.isFetching}
            >
              {summary.isFetching ? 'Actualizando…' : 'Actualizar'}
            </Button>
            {canRebuild && (
              <Button
                size="small"
                variant="secondary"
                onClick={() => setConfirmingRebuild(true)}
                disabled={!organizationId || rebuild.isPending}
              >
                Reconstruir saldos
              </Button>
            )}
          </div>
        }
      />

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <section
        aria-label="Filtros de saldos"
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3"
      >
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-700">Organización</span>
          <select
            value={organizationId ?? ''}
            onChange={(event) => void selectContext({ organization_id: event.target.value || null })}
            className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20"
          >
            <option value="">Selecciona una organización</option>
            {options.organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-700">Almacén (opcional)</span>
          <select
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
            className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20"
          >
            <option value="">Todos los almacenes</option>
            {options.warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-700">Producto (opcional)</span>
          <select
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20"
          >
            <option value="">Todos los productos</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} · {product.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* ── Estados ─────────────────────────────────────────────────────── */}
      {!organizationId && (
        <Alert variant="info">
          Selecciona una organización para consultar sus saldos.
        </Alert>
      )}

      {organizationId && summary.isLoading && <LoadingSkeleton rows={4} />}

      {organizationId && summary.isError && (
        <Alert variant="error">
          {summary.status === 403
            ? 'No tienes acceso a los saldos de esta organización.'
            : summary.error ?? 'No se pudieron cargar los saldos.'}
        </Alert>
      )}

      {organizationId && !summary.isLoading && !summary.isError && summary.data && (
        <>
          {allZero && (
            <Alert variant="info">
              La organización no registra saldos para los filtros seleccionados.
            </Alert>
          )}

          <section
            aria-label="Métricas de saldo"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {METRICS.map((metric) => (
              <article
                key={metric.key}
                data-testid={`metric-${metric.key}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 text-slate-500">
                  <LogisticsIcon name={metric.icon} size={15} aria-hidden="true" />
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.12em]">
                    {metric.label}
                  </h3>
                </div>
                <p className="mt-2 text-xl font-bold text-slate-900">
                  <DecimalDisplay value={summary.data![metric.key]} />
                </p>
                <p className="mt-1 text-[11px] leading-4 text-slate-400">{metric.hint}</p>
              </article>
            ))}
          </section>
        </>
      )}

      {/* ── Confirmación de rebuild ─────────────────────────────────────── */}
      {confirmingRebuild && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar reconstrucción de saldos"
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Reconstruir saldos</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Se relanzará el replay del libro de movimientos para recalcular la proyección de
                saldos de la organización seleccionada. La operación queda auditada.
              </p>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Modo</span>
              <select
                value={rebuildMode}
                onChange={(event) => setRebuildMode(event.target.value as RebuildMode)}
                className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"
              >
                {(Object.keys(REBUILD_MODE_LABELS) as RebuildMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {REBUILD_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </label>

            {stepUpRequired && (
              <Alert variant="warning">
                Esta acción exige reverificación de identidad. Si el servidor la rechaza, reverifica
                tu sesión desde el aviso superior y vuelve a intentarlo.
              </Alert>
            )}

            {rebuild.error && <Alert variant="error">{rebuild.error}</Alert>}

            <div className="flex justify-end gap-2">
              <Button
                size="small"
                variant="secondary"
                onClick={() => {
                  rebuild.reset()
                  setConfirmingRebuild(false)
                }}
                disabled={rebuild.isPending}
              >
                Cancelar
              </Button>
              <Button
                size="small"
                isLoading={rebuild.isPending}
                disabled={rebuild.isPending || !organizationId}
                onClick={() => {
                  if (!organizationId) return
                  void rebuild.requestRebuild({
                    organization_id: organizationId,
                    rebuild_mode: rebuildMode,
                    target_warehouse_id: rebuildMode === 'PARTIAL_WAREHOUSE' ? warehouseId || null : null,
                    target_product_id: rebuildMode === 'PARTIAL_PRODUCT' ? productId || null : null,
                  })
                }}
              >
                Confirmar reconstrucción
              </Button>
            </div>
          </div>
        </div>
      )}

      {rebuild.job && !confirmingRebuild && (
        <Alert variant="success">
          Reconstrucción encolada ({rebuild.job.status}): {rebuild.job.positions_processed} posiciones
          procesadas, {rebuild.job.movements_replayed} movimientos reprocesados,{' '}
          {rebuild.job.differences_count} diferencias.
        </Alert>
      )}
    </div>
  )
}
