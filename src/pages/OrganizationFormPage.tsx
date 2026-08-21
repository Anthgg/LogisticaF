import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { logisticsApi } from '../api/logistics-api'
import { Alert } from '../components/common/Alert'
import { Input } from '../components/common/Input'
import { CountrySelect, TimezoneSelect } from '../components/logistics/CatalogSelects'
import { CountryMapPreview } from '../components/logistics/CountryMapPreview'
import { EntityCodeField } from '../components/logistics/EntityCodeField'
import { EntityFormPage } from '../components/logistics/EntityFormPage'
import type { OrganizationCreate, OrganizationResponse } from '../types/logistics-resources'
import { getErrorMessage } from '../utils/errors'

const emptyForm: OrganizationCreate = {
  name: '',
  country_code: 'PE',
  timezone: 'America/Lima',
}

export function OrganizationFormPage() {
  const navigate = useNavigate()
  const { organizationId } = useParams<{ organizationId: string }>()
  const isEditing = Boolean(organizationId)
  const [form, setForm] = useState<OrganizationCreate>(emptyForm)
  const [organization, setOrganization] = useState<OrganizationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(isEditing)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    setIsLoading(true)
    void logisticsApi.organizations
      .get(organizationId)
      .then((item) => {
        setOrganization(item)
        setForm({
          name: item.name,
          country_code: item.country_code,
          timezone: item.timezone,
        })
      })
      .catch((caught: unknown) => setError(getErrorMessage(caught)))
      .finally(() => setIsLoading(false))
  }, [organizationId])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      if (organizationId) {
        await logisticsApi.organizations.update(organizationId, form)
      } else {
        await logisticsApi.organizations.create(form)
      }
      navigate('/logistics/organizations')
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    } finally {
      setIsSaving(false)
    }
  }

  const title = isEditing ? 'Editar organización' : 'Nueva organización'

  return (
    <EntityFormPage
      title={title}
      description="Define la identidad operativa y el contexto regional de la organización."
      breadcrumbs={[
        { label: 'Logística' },
        { label: 'Organizaciones', to: '/logistics/organizations' },
        { label: title },
      ]}
      submitLabel={isEditing ? 'Guardar cambios' : 'Crear organización'}
      isSaving={isSaving}
      isSubmitDisabled={isLoading || !form.name.trim()}
      onCancel={() => navigate('/logistics/organizations')}
      onSubmit={(event) => void submit(event)}
      summary={
        <div className="space-y-4 border-l-2 border-slate-200 pl-4 text-xs">
          <div>
            <p className="font-semibold uppercase tracking-wide text-slate-400">Resumen</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {form.name.trim() || 'Organización sin nombre'}
            </p>
          </div>
          <dl className="space-y-3">
            <div>
              <dt className="text-slate-500">Código</dt>
              <dd className="font-mono font-medium text-slate-800">
                {organization?.code ?? 'Se generará al guardar'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">País</dt>
              <dd className="font-medium text-slate-800">{form.country_code}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Zona horaria</dt>
              <dd className="font-medium text-slate-800">{form.timezone}</dd>
            </div>
            {organization && (
              <div>
                <dt className="text-slate-500">Estado</dt>
                <dd className="font-medium text-slate-800">{organization.status}</dd>
              </div>
            )}
          </dl>
        </div>
      }
    >
      {error && <Alert variant="error">{error}</Alert>}
      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">
          <span className="spinner mr-2" /> Cargando organización…
        </div>
      ) : (
        <>
          <section aria-labelledby="organization-general-title" className="space-y-4">
            <div>
              <h2 id="organization-general-title" className="text-sm font-semibold text-slate-900">
                Datos generales
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Información usada en los módulos logísticos y documentos operativos.
              </p>
            </div>
            <Input
              label="Nombre"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              autoFocus
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <CountrySelect
                value={form.country_code}
                onChange={(countryCode) =>
                  setForm((current) => ({ ...current, country_code: countryCode }))
                }
                disabled={isSaving}
              />
              <TimezoneSelect
                value={form.timezone}
                countryCode={form.country_code}
                onChange={(timezone) => setForm((current) => ({ ...current, timezone }))}
                disabled={isSaving}
              />
            </div>
            <EntityCodeField code={organization?.code ?? null} />
          </section>

          <div className="border-t border-slate-200 pt-6">
            <CountryMapPreview countryCode={form.country_code} />
          </div>
        </>
      )}
    </EntityFormPage>
  )
}
