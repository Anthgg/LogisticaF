import { useCallback, useEffect, useState } from 'react'
import { logisticsApi } from '../api/logistics-api'
import { Alert } from '../components/common/Alert'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { OperationsTable, type TableColumn } from '../components/common/OperationsTable'
import { PageHeader } from '../components/common/PageHeader'
import { Pagination } from '../components/common/Pagination'
import { QueryBar } from '../components/common/QueryBar'
import { ResourceDialog } from '../components/common/ResourceDialog'
import { StatusBadge } from '../components/common/StatusBadge'
import { TimezoneSelect } from '../components/logistics/CatalogSelects'
import { EntityCodeField } from '../components/logistics/EntityCodeField'
import { LocationPicker, type LocationValue } from '../components/logistics/LocationPicker'
import { PermissionGate } from '../components/logistics/PermissionGate'
import { UbigeoSelector } from '../components/logistics/UbigeoSelector'
import { useLogisticsAccess } from '../features/logistics-me/hooks/useLogisticsAccess'
import { LOGISTICS_PERMISSIONS } from '../features/logistics-permissions/logistics-permissions-map'
import type { BranchResponse, OrganizationResponse, PaginatedResponse } from '../types/logistics-resources'
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

const emptyPage: PaginatedResponse<BranchResponse> = {
  items: [],
  total: 0,
  page: 1,
  page_size: 20,
  total_pages: 1,
}

export function BranchesPage() {
  const { hasPermission } = useLogisticsAccess()
  const canUpdate = hasPermission(LOGISTICS_PERMISSIONS.branches.update)
  const canChangeStatus = hasPermission(LOGISTICS_PERMISSIONS.branches.changeStatus)
  const canManage = canUpdate || canChangeStatus

  const [orgs, setOrgs] = useState<OrganizationResponse[]>([])
  const [selectedOrg, setSelectedOrg] = useState('')
  const [data, setData] = useState<PaginatedResponse<BranchResponse>>(emptyPage)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [editing, setEditing] = useState<BranchResponse | null>(null)
  const [form, setForm] = useState<BranchFormData>(emptyForm)

  const loadOrgs = useCallback(async () => {
    try {
      const response = await logisticsApi.organizations.list({
        page: 1,
        page_size: 100,
      })
      setOrgs(response.items)
      if (response.items.length > 0 && !selectedOrg) {
        setSelectedOrg(response.items[0].id)
      }
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    }
  }, [selectedOrg])

  useEffect(() => {
    void loadOrgs()
  }, [loadOrgs])

  const load = useCallback(async () => {
    if (!selectedOrg) return
    setIsLoading(true)
    setError(null)
    try {
      setData(
        await logisticsApi.organizations.branches(selectedOrg, {
          page,
          page_size: 20,
          search,
        }),
      )
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    } finally {
      setIsLoading(false)
    }
  }, [selectedOrg, page, search])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250)
    return () => window.clearTimeout(timer)
  }, [load])

  const openDialog = (branch?: BranchResponse) => {
    setError(null)
    setEditing(branch ?? null)
    setForm(
      branch
        ? {
            name: branch.name,
            timezone: branch.timezone,
            ubigeo_code: branch.ubigeo_code ?? null,
            address_text: branch.address_text ?? '',
            latitude: branch.latitude ?? null,
            longitude: branch.longitude ?? null,
          }
        : emptyForm,
    )
    setIsOpen(true)
  }

  const save = async () => {
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      if (editing) {
        await logisticsApi.branches.update(editing.id, {
          name: form.name,
          timezone: form.timezone,
          ubigeo_code: form.ubigeo_code ?? null,
          address_text: form.address_text || null,
          latitude: form.latitude,
          longitude: form.longitude,
        })
      } else {
        // `organization_id` viaja en la ruta; el formulario nunca pide un UUID.
        await logisticsApi.branches.create(selectedOrg, {
          // El código no viaja: lo genera el backend.
          name: form.name,
          timezone: form.timezone,
          // Solo el codigo canonico: los nombres del catalogo no son fuente de verdad.
          ubigeo_code: form.ubigeo_code ?? null,
          address_text: form.address_text || null,
          latitude: form.latitude,
          longitude: form.longitude,
        })
      }
      setIsOpen(false)
      setEditing(null)
      await load()
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    } finally {
      setIsSaving(false)
    }
  }

  const toggleStatus = async (branch: BranchResponse) => {
    setError(null)
    try {
      await logisticsApi.branches.changeStatus(branch.id, {
        status: branch.status === 'active' ? 'inactive' : 'active',
      })
      await load()
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    }
  }

  const columns: TableColumn<BranchResponse>[] = [
    {
      key: 'name',
      label: 'Sede',
      render: (row) => (
        <div className="table-primary">
          <strong>{row.name}</strong>
          <small>{row.code}</small>
        </div>
      ),
    },
    {
      key: 'ubigeo',
      label: 'Ubicación',
      render: (row) =>
        // El backend ya resuelve la jerarquía; se muestra legible, no el código.
        row.ubigeo?.formatted ?? 'Pendiente de normalizar',
    },
    {
      key: 'address_text',
      label: 'Dirección',
      render: (row) => row.address_text ?? 'No definida',
    },
    {
      key: 'timezone',
      label: 'Zona horaria',
      render: (row) => row.timezone,
    },
    {
      key: 'status',
      label: 'Estado',
      render: (row) => (
        <StatusBadge value={row.status === 'active' ? 'active' : 'inactive'}>
          {row.status === 'active' ? 'Activo' : 'Inactivo'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      label: 'Acciones',
      align: 'right',
      render: (row) =>
        canManage && (
          <div className="table-actions">
            {canUpdate && (
              <Button size="small" variant="ghost" onClick={() => openDialog(row)}>
                Editar
              </Button>
            )}
            {canChangeStatus && (
              <Button size="small" variant="ghost" onClick={() => void toggleStatus(row)}>
                {row.status === 'active' ? 'Desactivar' : 'Activar'}
              </Button>
            )}
          </div>
        ),
    },
  ]

  const updateText = (key: 'name', value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const selectedOrgLabel = orgs.find((org) => org.id === selectedOrg)

  return (
    <div className="page">
      <PageHeader
        eyebrow="Estructura organizacional"
        title="Sedes"
        description="Gestiona las sedes por organización."
        actions={
          <PermissionGate permission={LOGISTICS_PERMISSIONS.branches.create}>
            <Button disabled={!selectedOrg} onClick={() => openDialog()}>
              Nueva sede
            </Button>
          </PermissionGate>
        }
      />
      {error && <Alert variant="error">{error}</Alert>}
      <section className="panel operations-section">
        <div className="flex items-center gap-3 mb-4">
          <label htmlFor="org-select" className="text-sm font-medium text-slate-700">
            Organización:
          </label>
          <select
            id="org-select"
            className="field__input"
            value={selectedOrg}
            onChange={(e) => {
              setSelectedOrg(e.target.value)
              setPage(1)
            }}
            disabled={isLoading}
          >
            <option value="">Selecciona una organización</option>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.code})
              </option>
            ))}
          </select>
        </div>
        {selectedOrg ? (
          <>
            <QueryBar
              search={search}
              onSearch={(value) => {
                setSearch(value)
                setPage(1)
              }}
            />
            {isLoading ? (
              <div className="loading-panel">
                <span className="spinner" />
                <p>Cargando sedes…</p>
              </div>
            ) : (
              <OperationsTable
                rows={data.items}
                columns={columns}
                getRowKey={(row) => row.id}
              />
            )}
            <Pagination
              page={data.page}
              totalPages={data.total_pages}
              total={data.total}
              onPageChange={setPage}
            />
          </>
        ) : (
          <div className="loading-panel">
            <p>Selecciona una organización para ver sus sedes.</p>
          </div>
        )}
      </section>
      <ResourceDialog
        isOpen={isOpen}
        title={editing ? 'Editar sede' : 'Nueva sede'}
        submitLabel={editing ? 'Guardar cambios' : 'Crear sede'}
        isSubmitting={isSaving}
        onClose={() => {
          setIsOpen(false)
          setEditing(null)
        }}
        onSubmit={() => void save()}
      >
        {/* El Alert de la página queda detrás del modal: un 409 de código duplicado
            se renderizaba donde el usuario no puede verlo. */}
        {error && <Alert variant="error">{error}</Alert>}
        <div className="form-grid">
          <Input
            label="Organización"
            value={
              selectedOrgLabel
                ? `${selectedOrgLabel.name} (${selectedOrgLabel.code})`
                : ''
            }
            readOnly
            disabled
          />
          <EntityCodeField code={editing?.code ?? null} />
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => updateText('name', e.target.value)}
            required
          />
          <TimezoneSelect
            value={form.timezone}
            onChange={(code) => setForm((current) => ({ ...current, timezone: code }))}
            disabled={isSaving}
          />
        </div>

        {/* La división administrativa y la dirección humana son cosas distintas:
            el UBIGEO identifica el distrito, la dirección dice dónde está la puerta. */}
        <h4 className="field__label">Ubicación administrativa</h4>
        <UbigeoSelector
          value={form.ubigeo_code ?? null}
          resolved={editing?.ubigeo ?? null}
          onChange={(ubigeoCode) =>
            setForm((current) => ({ ...current, ubigeo_code: ubigeoCode }))
          }
          disabled={isSaving}
        />

        {/* Dirección y Geolocalización */}
        <h4 className="field__label">Dirección y ubicación en mapa</h4>
        <LocationPicker
          value={{
            address: form.address_text,
            latitude: form.latitude,
            longitude: form.longitude,
          }}
          onChange={(loc: LocationValue) =>
            setForm((current) => ({
              ...current,
              address_text: loc.address,
              latitude: loc.latitude,
              longitude: loc.longitude,
            }))
          }
          ubigeoCode={form.ubigeo_code ?? null}
          disabled={isSaving}
        />
      </ResourceDialog>
    </div>
  )
}
