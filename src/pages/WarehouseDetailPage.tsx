import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { warehousesApi } from '../api/warehouses-modeling-api'
import { Alert } from '../components/common/Alert'
import { Button } from '../components/common/Button'
import { PageHeader } from '../components/common/PageHeader'
import { StatusBadge } from '../components/common/StatusBadge'
import { LocationMap } from '../components/logistics/LocationMap'
import { WarehouseLocationTree } from '../components/warehouses/WarehouseLocationTree'
import { WarehouseLocationDetailPanel } from '../components/warehouses/WarehouseLocationDetailPanel'
import { WarehouseLocationGenerationWizard } from '../components/warehouses/WarehouseLocationGenerationWizard'
import { WarehouseLogicalMapPage } from '../components/warehouses/WarehouseLogicalMapPage'
import type { Warehouse, WarehouseLocationTreeNode } from '../types/warehouse-modeling'
import { getErrorMessage } from '../utils/errors'

type DetailTab =
  | 'locations'
  | 'map'
  | 'summary'

export function WarehouseDetailPage() {
  const { warehouseId } = useParams<{ warehouseId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab: DetailTab = (searchParams.get('tab') as DetailTab) || 'locations'

  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<WarehouseLocationTreeNode | null>(null)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadWarehouse = useCallback(async () => {
    if (!warehouseId) return
    setIsLoading(true)
    setError(null)
    try {
      setWarehouse(await warehousesApi.get(warehouseId))
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [warehouseId])

  useEffect(() => {
    void loadWarehouse()
  }, [loadWarehouse])

  const setTab = (tab: DetailTab) => {
    setSearchParams({ tab })
  }

  const handleBlockLocation = async (node: WarehouseLocationTreeNode) => {
    const reason = window.prompt(`Ingresa el motivo obligatorio para bloquear ${node.full_code}:`)
    if (!reason || reason.trim().length < 5) return
    try {
      await warehousesApi.blockLocation(node.id, reason.trim())
      await loadWarehouse()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  if (!warehouseId) return null

  return (
    <div className="w-full space-y-3.5">
      {warehouse && (
        <PageHeader
          eyebrow={`Sede: ${warehouse.branch_name || 'Principal'} · Tipo: ${warehouse.warehouse_type}`}
          title={`${warehouse.name} (${warehouse.code})`}
          description={warehouse.address ?? warehouse.address_text ?? undefined}
          actions={
            <div className="flex items-center gap-2">
              <StatusBadge value={warehouse.status.toLowerCase()}>{warehouse.status}</StatusBadge>
              {warehouse.capabilities?.can_bulk_create && (
                <Button size="small" onClick={() => setIsWizardOpen(true)}>
                  Generación Masiva
                </Button>
              )}
            </div>
          }
        />
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {isLoading ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-xs text-slate-500">
          <span className="spinner" />
          <p>Cargando detalles y estructura del almacén…</p>
        </div>
      ) : warehouse ? (
        <div className="w-full space-y-3.5">
          {/* Métricas compactas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-xs">
              <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider block">
                Ubicaciones Totales
              </span>
              <span className="font-mono text-base font-bold text-slate-900 mt-0.5 block">
                {warehouse.total_locations ?? '—'}
              </span>
            </div>

            <div className="rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-xs">
              <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider block">
                Ubicaciones Activas
              </span>
              <span className="font-mono text-base font-bold text-emerald-700 mt-0.5 block">
                {warehouse.active_locations ?? '—'}
              </span>
            </div>

            <div className="rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-xs">
              <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider block">
                Ubicaciones Bloqueadas
              </span>
              <span className="font-mono text-base font-bold text-rose-700 mt-0.5 block">
                {warehouse.blocked_locations ?? '—'}
              </span>
            </div>

            <div className="rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-xs">
              <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider block">
                Versión Layout
              </span>
              <span className="font-mono text-base font-bold text-primary mt-0.5 block">
                {warehouse.active_layout_version != null
                  ? `v${warehouse.active_layout_version}`
                  : warehouse.layout_status ?? 'Sin dato'}
              </span>
            </div>
          </div>

          {/* Navegación por pestañas */}
          <div className="flex items-center gap-1 border-b border-slate-200 pb-0 overflow-x-auto">
            {[
              { id: 'locations', label: 'Estructura & Ubicaciones' },
              { id: 'map', label: 'Mapa Lógico 2D' },
              { id: 'summary', label: 'Ficha Resumen' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`relative px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
                  activeTab === t.id
                    ? 'text-primary'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 rounded-md'
                }`}
                onClick={() => setTab(t.id as DetailTab)}
              >
                {t.label}
                {activeTab === t.id && (
                  <span
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-primary rounded-t"
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Contenido activo */}
          <div className="pt-1">
            {activeTab === 'locations' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                <WarehouseLocationTree
                  warehouseId={warehouse.id}
                  selectedLocationId={selectedLocation?.id || null}
                  onSelectLocation={setSelectedLocation}
                />
                <WarehouseLocationDetailPanel
                  locationNode={selectedLocation}
                  onBlockLocation={handleBlockLocation}
                />
              </div>
            )}

            {activeTab === 'map' && <WarehouseLogicalMapPage warehouseId={warehouse.id} />}

            {activeTab === 'summary' && (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]">
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Cross-docking:</span>
                  <span className="font-semibold text-slate-900">
                    {(warehouse.is_inventory_enabled ?? warehouse.inventory_enabled) == null
                      ? 'Sin dato'
                      : (warehouse.is_inventory_enabled ?? warehouse.inventory_enabled)
                        ? 'Habilitado'
                        : 'Deshabilitado'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Control de Temperatura:</span>
                  <span className="font-semibold text-slate-900">
                    {(warehouse.has_temperature_control ?? warehouse.temperature_controlled) == null
                      ? 'Sin dato'
                      : (warehouse.has_temperature_control ?? warehouse.temperature_controlled)
                        ? 'Sí'
                        : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 font-medium">Materiales Peligrosos (HAZMAT):</span>
                  <span className="font-semibold text-slate-900">
                    {(warehouse.has_hazmat ?? warehouse.hazardous_materials_allowed) == null
                      ? 'Sin dato'
                      : (warehouse.has_hazmat ?? warehouse.hazardous_materials_allowed)
                        ? 'Sí'
                        : 'No'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">Ubicación geográfica</span>
                  <span className="text-slate-500">
                    Origen: {warehouse.location_source === 'WAREHOUSE' ? 'Almacén' : 'Sede'}
                  </span>
                </div>
                <LocationMap
                  latitude={warehouse.effective_latitude}
                  longitude={warehouse.effective_longitude}
                  addressText={warehouse.address ?? warehouse.address_text}
                  isConfirmed={
                    warehouse.effective_latitude != null &&
                    warehouse.effective_longitude != null
                  }
                  interactive={false}
                  height={360}
                  ariaLabel="Mapa de ubicación efectiva del almacén"
                />
              </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <WarehouseLocationGenerationWizard
        warehouseId={warehouseId}
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={loadWarehouse}
      />
    </div>
  )
}
