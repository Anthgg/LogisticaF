import { useMemo, useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { logisticsApi } from '../api/logistics-api'
import { Alert } from '../components/common/Alert'
import { Input } from '../components/common/Input'
import { WarehouseTypeSelect } from '../components/logistics/CatalogSelects'
import { EntityCodeField } from '../components/logistics/EntityCodeField'
import { EntityFormPage } from '../components/logistics/EntityFormPage'
import { LocationMap } from '../components/logistics/LocationMap'
import { LocationPicker, type LocationValue } from '../components/logistics/LocationPicker'
import type {
  BranchResponse,
  LogisticsWarehouseCreate,
  LogisticsWarehouseResponse,
  OrganizationResponse,
} from '../types/logistics-resources'
import { getErrorMessage } from '../utils/errors'

interface WarehouseFormData extends LogisticsWarehouseCreate {
  uses_branch_location: boolean
  latitude: number | null
  longitude: number | null
}

const emptyForm: WarehouseFormData = {
  name: '',
  warehouse_type: 'general',
  address: '',
  capacity: null,
  is_default: false,
  uses_branch_location: true,
  latitude: null,
  longitude: null,
}

export function WarehouseFormPage() {
  const navigate = useNavigate()
  const { warehouseId } = useParams<{ warehouseId: string }>()
  const [searchParams] = useSearchParams()
  const isEditing = Boolean(warehouseId)
  const [organizations, setOrganizations] = useState<OrganizationResponse[]>([])
  const [branches, setBranches] = useState<BranchResponse[]>([])
  const [organizationId, setOrganizationId] = useState(searchParams.get('organizationId') ?? '')
  const [branchId, setBranchId] = useState(searchParams.get('branchId') ?? '')
  const [warehouse, setWarehouse] = useState<LogisticsWarehouseResponse | null>(null)
  const [form, setForm] = useState<WarehouseFormData>(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    void (async () => {
      const organizationPage = await logisticsApi.organizations.list({ page: 1, page_size: 100 })
      const loadedWarehouse = warehouseId
        ? await logisticsApi.warehouses.getById(warehouseId)
        : null
      const nextOrganizationId =
        loadedWarehouse?.organization_id ??
        searchParams.get('organizationId') ??
        organizationPage.items[0]?.id ??
        ''
      const branchPage = nextOrganizationId
        ? await logisticsApi.organizations.branches(nextOrganizationId, { page: 1, page_size: 100 })
        : null
      if (!active) return

      setOrganizations(organizationPage.items)
      setOrganizationId(nextOrganizationId)
      setBranches(branchPage?.items ?? [])
      setBranchId(
        loadedWarehouse?.branch_id ??
          searchParams.get('branchId') ??
          branchPage?.items[0]?.id ??
          '',
      )

      if (loadedWarehouse) {
        setWarehouse(loadedWarehouse)
        setForm({
          name: loadedWarehouse.name,
          warehouse_type: loadedWarehouse.warehouse_type,
          address: loadedWarehouse.address ?? '',
          capacity: loadedWarehouse.capacity,
          is_default: loadedWarehouse.is_default,
          uses_branch_location: loadedWarehouse.uses_branch_location ?? true,
          latitude: loadedWarehouse.latitude ?? null,
          longitude: loadedWarehouse.longitude ?? null,
        })
      }
    })()
      .catch((caught: unknown) => setError(getErrorMessage(caught)))
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [searchParams, warehouseId])

  const changeOrganization = async (nextOrganizationId: string) => {
    setOrganizationId(nextOrganizationId)
    setBranchId('')
    setBranches([])
    if (!nextOrganizationId) return
    try {
      const response = await logisticsApi.organizations.branches(nextOrganizationId, {
        page: 1,
        page_size: 100,
      })
      setBranches(response.items)
      setBranchId(response.items[0]?.id ?? '')
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    }
  }

  const selectedOrganization = useMemo(
    () => organizations.find((item) => item.id === organizationId) ?? null,
    [organizationId, organizations],
  )
  const selectedBranch = useMemo(
    () => branches.find((item) => item.id === branchId) ?? null,
    [branchId, branches],
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSaving || !branchId) return
    if (!form.uses_branch_location && (form.latitude == null || form.longitude == null)) {
      setError('Confirma una ubicación propia en el mapa antes de guardar.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        warehouse_type: form.warehouse_type,
        address: form.address || null,
        capacity: form.capacity,
        uses_branch_location: form.uses_branch_location,
        latitude: form.uses_branch_location ? null : form.latitude,
        longitude: form.uses_branch_location ? null : form.longitude,
      }
      if (warehouseId) {
        await logisticsApi.warehouses.update(branchId, warehouseId, payload)
      } else {
        await logisticsApi.warehouses.create(branchId, {
          ...payload,
          is_default: form.is_default,
        })
      }
      navigate('/logistics/warehouses')
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    } finally {
      setIsSaving(false)
    }
  }

  const title = isEditing ? 'Editar almacén' : 'Nuevo almacén'
  const effectiveLatitude = form.uses_branch_location ? selectedBranch?.latitude : form.latitude
  const effectiveLongitude = form.uses_branch_location ? selectedBranch?.longitude : form.longitude
  const locationConfirmed = effectiveLatitude != null && effectiveLongitude != null

  return (
    <EntityFormPage
      title={title}
      description="Configura el almacén y decide si su punto geográfico se hereda de la sede o se confirma de forma independiente."
      breadcrumbs={[
        { label: 'Logística' },
        { label: 'Almacenes', to: '/logistics/warehouses' },
        { label: title },
      ]}
      submitLabel={isEditing ? 'Guardar cambios' : 'Crear almacén'}
      isSaving={isSaving}
      isSubmitDisabled={
        isLoading ||
        !branchId ||
        !form.name.trim() ||
        (!form.uses_branch_location && !locationConfirmed)
      }
      onCancel={() => navigate('/logistics/warehouses')}
      onSubmit={(event) => void submit(event)}
      summary={
        <div className="space-y-4 border-l-2 border-slate-200 pl-4 text-xs">
          <div>
            <p className="font-semibold uppercase tracking-wide text-slate-400">Almacén</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {form.name.trim() || 'Almacén sin nombre'}
            </p>
          </div>
          <dl className="space-y-3">
            <div>
              <dt className="text-slate-500">Organización</dt>
              <dd className="font-medium text-slate-800">{selectedOrganization?.name ?? 'Pendiente'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Sede</dt>
              <dd className="font-medium text-slate-800">{selectedBranch?.name ?? 'Pendiente'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tipo / código</dt>
              <dd className="font-medium text-slate-800">
                {form.warehouse_type} · {warehouse?.code ?? 'automático'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Origen de ubicación</dt>
              <dd className="font-semibold text-slate-800">
                {form.uses_branch_location ? 'Sede' : 'Almacén'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Estado</dt>
              <dd className={locationConfirmed ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                {locationConfirmed ? '✓ Ubicación disponible' : 'Ubicación pendiente'}
              </dd>
            </div>
            {locationConfirmed && (
              <div>
                <dt className="text-slate-500">Latitud / longitud</dt>
                <dd className="font-mono text-slate-800">
                  {effectiveLatitude?.toFixed(6)}, {effectiveLongitude?.toFixed(6)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      }
    >
      {error && <Alert variant="error">{error}</Alert>}
      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">
          <span className="spinner mr-2" /> Cargando almacén…
        </div>
      ) : (
        <>
          <section aria-labelledby="warehouse-general-title" className="space-y-4">
            <div>
              <h2 id="warehouse-general-title" className="text-sm font-semibold text-slate-900">
                Datos generales
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field">
                <span className="field__label">Organización</span>
                <select
                  className="field__input"
                  value={organizationId}
                  onChange={(event) => void changeOrganization(event.target.value)}
                  disabled={isEditing || isSaving}
                  required
                >
                  <option value="">Selecciona una organización</option>
                  {organizations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Sede</span>
                <select
                  className="field__input"
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  disabled={isEditing || isSaving || !organizationId}
                  required
                >
                  <option value="">Selecciona una sede</option>
                  {branches.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.code})
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Nombre"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                autoFocus
                required
              />
              <WarehouseTypeSelect
                value={form.warehouse_type}
                onChange={(warehouseType) =>
                  setForm((current) => ({ ...current, warehouse_type: warehouseType }))
                }
                disabled={isSaving}
              />
              <EntityCodeField code={warehouse?.code ?? null} />
              <Input
                label="Capacidad"
                type="number"
                min="0"
                step="0.01"
                value={form.capacity ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    capacity: event.target.value ? Number(event.target.value) : null,
                  }))
                }
              />
            </div>
          </section>

          <section aria-labelledby="warehouse-location-title" className="space-y-4 border-t border-slate-200 pt-6">
            <div>
              <h2 id="warehouse-location-title" className="text-sm font-semibold text-slate-900">
                Ubicación
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                El modo heredado sigue automáticamente cualquier cambio de coordenadas de la sede.
              </p>
            </div>

            <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={form.uses_branch_location}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    uses_branch_location: event.target.checked,
                    latitude: null,
                    longitude: null,
                  }))
                }
                disabled={isSaving}
              />
              <span>
                <strong className="font-semibold">Usar ubicación de la sede</strong>
                <span className="block text-xs text-slate-500">
                  No se duplicarán coordenadas en el almacén.
                </span>
              </span>
            </label>

            {form.uses_branch_location ? (
              <div className="space-y-3" data-testid="warehouse-inherited-location">
                <Input
                  label="Dirección / referencia del almacén"
                  value={form.address ?? ''}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, address: event.target.value }))
                  }
                  hint="Referencia interna, por ejemplo «Nave B — Puerta 4»."
                />
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <p className="font-semibold text-slate-900">Ubicación heredada de la sede</p>
                  <p className="mt-1">
                    {selectedBranch?.address_text ?? 'La sede aún no tiene una dirección confirmada.'}
                  </p>
                  <p className="mt-1">{selectedBranch?.ubigeo?.formatted ?? 'UBIGEO pendiente'}</p>
                </div>
                <LocationMap
                  latitude={selectedBranch?.latitude}
                  longitude={selectedBranch?.longitude}
                  addressText={selectedBranch?.address_text}
                  isConfirmed={locationConfirmed}
                  interactive={false}
                  height={400}
                  ariaLabel="Mapa de ubicación heredada de la sede"
                />
              </div>
            ) : (
              <div data-testid="warehouse-custom-location">
                <LocationPicker
                  value={{
                    address: form.address ?? '',
                    latitude: form.latitude,
                    longitude: form.longitude,
                  }}
                  onChange={(location: LocationValue) =>
                    setForm((current) => ({
                      ...current,
                      address: location.address,
                      latitude: location.latitude,
                      longitude: location.longitude,
                    }))
                  }
                  ubigeoCode={selectedBranch?.ubigeo_code ?? null}
                  initialCenter={
                    selectedBranch?.latitude != null && selectedBranch.longitude != null
                      ? {
                          latitude: selectedBranch.latitude,
                          longitude: selectedBranch.longitude,
                        }
                      : null
                  }
                  disabled={isSaving}
                  mapHeight={460}
                />
              </div>
            )}
          </section>
        </>
      )}
    </EntityFormPage>
  )
}
