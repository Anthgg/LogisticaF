import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { logisticsApi } from '../api/logistics-api'
import { Alert } from '../components/common/Alert'
import { Input } from '../components/common/Input'
import { TimezoneSelect } from '../components/logistics/CatalogSelects'
import { EntityCodeField } from '../components/logistics/EntityCodeField'
import { EntityFormPage } from '../components/logistics/EntityFormPage'
import { LocationPicker, type LocationValue } from '../components/logistics/LocationPicker'
import { UbigeoSelector } from '../components/logistics/UbigeoSelector'
import type { BranchResponse, OrganizationResponse } from '../types/logistics-resources'
import { getErrorMessage } from '../utils/errors'

interface BranchFormData {
  name: string
  timezone: string
  ubigeo_code: string | null
  address_text: string
  latitude: number | null
  longitude: number | null
}

const emptyForm: BranchFormData = {
  name: '',
  timezone: 'America/Lima',
  ubigeo_code: null,
  address_text: '',
  latitude: null,
  longitude: null,
}

export function BranchFormPage() {
  const navigate = useNavigate()
  const { branchId } = useParams<{ branchId: string }>()
  const [searchParams] = useSearchParams()
  const isEditing = Boolean(branchId)
  const [organizations, setOrganizations] = useState<OrganizationResponse[]>([])
  const [organizationId, setOrganizationId] = useState(searchParams.get('organizationId') ?? '')
  const [branch, setBranch] = useState<BranchResponse | null>(null)
  const [form, setForm] = useState<BranchFormData>(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    void Promise.all([
      logisticsApi.organizations.list({ page: 1, page_size: 100 }),
      branchId ? logisticsApi.branches.get(branchId) : Promise.resolve(null),
    ])
      .then(([organizationPage, loadedBranch]) => {
        if (!active) return
        setOrganizations(organizationPage.items)
        if (loadedBranch) {
          setBranch(loadedBranch)
          setOrganizationId(loadedBranch.organization_id)
          setForm({
            name: loadedBranch.name,
            timezone: loadedBranch.timezone,
            ubigeo_code: loadedBranch.ubigeo_code ?? null,
            address_text: loadedBranch.address_text ?? '',
            latitude: loadedBranch.latitude,
            longitude: loadedBranch.longitude,
          })
        } else {
          setOrganizationId((current) => current || organizationPage.items[0]?.id || '')
        }
      })
      .catch((caught: unknown) => setError(getErrorMessage(caught)))
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [branchId])

  const selectedOrganization = useMemo(
    () => organizations.find((item) => item.id === organizationId) ?? null,
    [organizationId, organizations],
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSaving || !organizationId) return
    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        timezone: form.timezone,
        ubigeo_code: form.ubigeo_code,
        address_text: form.address_text || null,
        latitude: form.latitude,
        longitude: form.longitude,
      }
      if (branchId) {
        await logisticsApi.branches.update(branchId, payload)
      } else {
        await logisticsApi.branches.create(organizationId, payload)
      }
      navigate('/logistics/branches')
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    } finally {
      setIsSaving(false)
    }
  }

  const title = isEditing ? 'Editar sede' : 'Nueva sede'
  const hasConfirmedLocation = form.latitude != null && form.longitude != null

  return (
    <EntityFormPage
      title={title}
      description="Registra el contexto administrativo y confirma el punto geográfico de la sede."
      breadcrumbs={[
        { label: 'Logística' },
        { label: 'Sedes', to: '/logistics/branches' },
        { label: title },
      ]}
      submitLabel={isEditing ? 'Guardar cambios' : 'Crear sede'}
      isSaving={isSaving}
      isSubmitDisabled={isLoading || !organizationId || !form.name.trim()}
      onCancel={() => navigate('/logistics/branches')}
      onSubmit={(event) => void submit(event)}
      summary={
        <div className="space-y-4 border-l-2 border-slate-200 pl-4 text-xs">
          <div>
            <p className="font-semibold uppercase tracking-wide text-slate-400">Sede</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {form.name.trim() || 'Sede sin nombre'}
            </p>
            <p className="mt-0.5 text-slate-500">{selectedOrganization?.name ?? 'Sin organización'}</p>
          </div>
          <dl className="space-y-3">
            <div>
              <dt className="text-slate-500">Código</dt>
              <dd className="font-mono font-medium text-slate-800">
                {branch?.code ?? 'Se generará al guardar'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">UBIGEO</dt>
              <dd className="font-medium text-slate-800">
                {branch?.ubigeo?.formatted ?? form.ubigeo_code ?? 'Pendiente'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Dirección final</dt>
              <dd className="font-medium text-slate-800">{form.address_text || 'Pendiente'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Estado de ubicación</dt>
              <dd className={hasConfirmedLocation ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                {hasConfirmedLocation ? '✓ Confirmada' : 'Pendiente de confirmar'}
              </dd>
            </div>
            {hasConfirmedLocation && (
              <div>
                <dt className="text-slate-500">Latitud / longitud</dt>
                <dd className="font-mono text-slate-800">
                  {form.latitude?.toFixed(6)}, {form.longitude?.toFixed(6)}
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
          <span className="spinner mr-2" /> Cargando sede…
        </div>
      ) : (
        <>
          <section aria-labelledby="branch-general-title" className="space-y-4">
            <div>
              <h2 id="branch-general-title" className="text-sm font-semibold text-slate-900">
                Datos generales
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field">
                <span className="field__label">Organización</span>
                <select
                  className="field__input"
                  value={organizationId}
                  onChange={(event) => setOrganizationId(event.target.value)}
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
              <EntityCodeField code={branch?.code ?? null} />
              <Input
                label="Nombre"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                autoFocus
                required
              />
              <TimezoneSelect
                value={form.timezone}
                onChange={(timezone) => setForm((current) => ({ ...current, timezone }))}
                disabled={isSaving}
              />
            </div>
          </section>

          <section aria-labelledby="branch-admin-title" className="space-y-4 border-t border-slate-200 pt-6">
            <div>
              <h2 id="branch-admin-title" className="text-sm font-semibold text-slate-900">
                Ubicación administrativa
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Departamento, provincia y distrito se resuelven desde el catálogo UBIGEO.
              </p>
            </div>
            <UbigeoSelector
              value={form.ubigeo_code}
              resolved={branch?.ubigeo ?? null}
              onChange={(ubigeoCode) =>
                setForm((current) => ({ ...current, ubigeo_code: ubigeoCode }))
              }
              disabled={isSaving}
            />
          </section>

          <section aria-labelledby="branch-location-title" className="space-y-4 border-t border-slate-200 pt-6">
            <div>
              <h2 id="branch-location-title" className="text-sm font-semibold text-slate-900">
                Ubicación geográfica
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Busca la dirección, ajusta el marcador y confirma el punto antes de guardar.
              </p>
            </div>
            <LocationPicker
              value={{
                address: form.address_text,
                latitude: form.latitude,
                longitude: form.longitude,
              }}
              onChange={(location: LocationValue) =>
                setForm((current) => ({
                  ...current,
                  address_text: location.address,
                  latitude: location.latitude,
                  longitude: location.longitude,
                }))
              }
              ubigeoCode={form.ubigeo_code}
              disabled={isSaving}
              mapHeight={460}
            />
          </section>
        </>
      )}
    </EntityFormPage>
  )
}
