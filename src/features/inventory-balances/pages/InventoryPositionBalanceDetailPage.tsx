import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../../components/common/PageHeader'
import { Button } from '../../../components/common/Button'
import { Alert } from '../../../components/common/Alert'
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton'
import { useLogisticsPermissions } from '../../logistics-permissions/hooks/useLogisticsPermissions'
import { LOGISTICS_PERMISSIONS } from '../../logistics-permissions/logistics-permissions-map'
import { DecimalDisplay } from '../components/DecimalDisplay'
import { DataQualityBadge } from '../components/DataQualityBadge'
import { usePositionBalance } from '../hooks/useInventoryBalances'
import type { InventoryPositionBalance } from '../types/inventory-balances'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-xs text-slate-800">{children}</dd>
    </div>
  )
}

const STATE_FIELDS: Array<{ key: keyof InventoryPositionBalance; label: string }> = [
  { key: 'availability_state', label: 'Disponibilidad' },
  { key: 'quality_state', label: 'Calidad' },
  { key: 'transit_state', label: 'Tránsito' },
  { key: 'damage_state', label: 'Daño' },
  { key: 'expiration_state', label: 'Vencimiento' },
]

/**
 * Detalle de una posición de inventario.
 *
 * `positionId` es el `InventoryPosition.id`, no la PK de la fila de saldo:
 * el backend filtra por `inventory_position_id`.
 */
export function InventoryPositionBalanceDetailPage() {
  const navigate = useNavigate()
  const { positionId } = useParams<{ positionId: string }>()
  const { hasPermission, isLoading: permissionsLoading } = useLogisticsPermissions()

  const canRead = hasPermission(LOGISTICS_PERMISSIONS.inventoryBalances.read)
  const query = usePositionBalance(canRead && positionId ? positionId : null)

  if (permissionsLoading) return <LoadingSkeleton rows={3} />

  if (!canRead) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Fase 045" title="Saldo de posición" />
        <Alert variant="error">
          No tienes el permiso <code>logistics.inventory.read</code> necesario para consultar esta
          posición.
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        eyebrow="Fase 045"
        title="Saldo de posición"
        description="Saldo atómico proyectado para una posición de inventario."
        actions={
          <Button
            size="small"
            variant="ghost"
            onClick={() => navigate('/logistics/inventory/stock')}
          >
            ← Volver a saldos
          </Button>
        }
      />

      {query.isLoading && <LoadingSkeleton rows={3} />}

      {query.isError && (
        <Alert variant="error">
          {query.status === 404
            ? 'La posición solicitada no tiene un saldo proyectado activo.'
            : query.status === 403
              ? 'No tienes acceso a la organización propietaria de esta posición.'
              : query.error ?? 'No se pudo cargar el saldo de la posición.'}
        </Alert>
      )}

      {!query.isLoading && !query.isError && query.data && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Cantidad proyectada
                </p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  <DecimalDisplay value={query.data.quantity} maximumFractionDigits={6} />
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <DataQualityBadge status={query.data.data_quality_status} />
                <span className="text-[11px] text-slate-400">
                  Conciliación: {query.data.reconciliation_status}
                </span>
                <span className="text-[11px] text-slate-400">
                  Secuencia aplicada: {query.data.last_applied_ledger_sequence}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Estados</h2>
            <dl className="mt-3 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {STATE_FIELDS.map((field) => (
                <Field key={field.key} label={field.label}>
                  {String(query.data![field.key] ?? '—')}
                </Field>
              ))}
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Identificadores
            </h2>
            <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Posición">{query.data.inventory_position_id}</Field>
              <Field label="Producto">{query.data.product_id}</Field>
              <Field label="Unidad base">{query.data.base_unit_id}</Field>
              <Field label="Organización">{query.data.organization_id}</Field>
              <Field label="Sede">{query.data.branch_id}</Field>
              <Field label="Almacén">{query.data.warehouse_id ?? '—'}</Field>
              <Field label="Ubicación">{query.data.warehouse_location_id ?? '—'}</Field>
              <Field label="Clave de dimensión">{query.data.dimension_key}</Field>
              <Field label="Calculado">
                {new Date(query.data.calculated_at).toLocaleString('es-PE')}
              </Field>
            </dl>
          </section>
        </>
      )}
    </div>
  )
}
