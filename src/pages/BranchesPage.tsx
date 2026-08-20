import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { PermissionGate } from '../components/logistics/PermissionGate'
import { TimezoneSelect } from '../components/logistics/CatalogSelects'
import { EntityCodeField } from '../components/logistics/EntityCodeField'
import { UbigeoSelector } from '../components/logistics/UbigeoSelector'
import { LocationPicker } from '../components/logistics/LocationPicker'
import type { LocationValue } from '../components/logistics/LocationPicker'
import { SearchableCombobox, type ComboboxOption } from '../components/ui/SearchableCombobox'
import { useLogisticsAccess } from '../features/logistics-me/hooks/useLogisticsAccess'
import { LOGISTICS_PERMISSIONS } from '../features/logistics-permissions/logistics-permissions-map'
import type {
  BranchCreate,
  BranchResponse,
  OrganizationResponse,
  PaginatedResponse,
} from '../types/logistics-resources'
import { getErrorMessage } from '../utils/errors'

const emptyForm: BranchCreate = {
  // Sin `code`: lo genera el backend.
  name: '',
  timezone: 'America/Lima',
  ubigeo_code: null,
  address_text: '',
  latitude: null,
  longitude: null,
}

export function BranchesPage() {
  const access = useLogisticsAccess()
  const canCreate = access.hasPermission(LOGISTICS_PERMISSIONS.branches.create)
  const canUpdate = access.hasPermission(LOGISTICS_PERMISSIONS.branches.update)
  const canChangeStatus = access.hasPermission(
    LOGISTICS_PERMISSIONS.branches.changeStatus,
  )
  const canManage = canCreate || canUpdate || canChangeStatus

  const [orgs, setOrgs] = useState<OrganizationResponse[]>([])
  const [selectedOrg, setSelectedOrg] = useState<string>('')
  const [data, setData] = useState<PaginatedResponse<BranchResponse>>({
    items: [],
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
  })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<BranchCreate>(emptyForm)
  const [editing, setEditing] = useState<BranchResponse | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    void logisticsApi.organizations
      .list({ page: 1, page_size: 100 })
      .then((res: PaginatedResponse<OrganizationResponse>) => {
        setOrgs(res.items)
        if (res.items.length > 0 && !selectedOrg) {
          setSelectedOrg(res.items[0].id)
        }
      })
      .catch(() => undefined)
  }, [selectedOrg])

  const load = useCallback(async () => {
    if (!selectedOrg) {
      setIsLoading(false)
      return
    }
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
          latitude: form.latitude ?? null,
          longitude: form.longitude ?? null,
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
          latitude: form.latitude ?? null,
          longitude: form.longitude ?? null,
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
        <div className="flex flex-col min-w-0">
          <strong className="font-semibold text-slate-900 text-xs truncate">{row.name}</strong>
          <span className="font-mono text-[10px] text-slate-400 mt-0.5">{row.code}</span>
        </div>
      ),
    },
    {
      key: 'ubigeo',
      label: 'Ubicación',
      render: (row) => (
        <span className="text-slate-700 text-xs">
          {row.ubigeo?.formatted ?? (
            <span className="text-slate-400 italic">Pendiente de normalizar</span>
          )}
        </span>
      ),
    },
    {
      key: 'address_text',
      label: 'Dirección',
      render: (row) => (
        <span className="text-slate-600 text-xs truncate max-w-[280px] block">
          {row.address_text ?? 'No definida'}
        </span>
      ),
    },
    {
      key: 'timezone',
      label: 'Zona horaria',
      render: (row) => <span className="text-slate-600 text-xs">{row.timezone}</span>,
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
          <div className="flex items-center justify-end gap-1">
            {canUpdate && (
              <Button size="small" variant="ghost" onClick={() => openDialog(row)}>
                Editar
              </Button>
            )}
            {canChangeStatus && (
              <Button
                size="small"
                variant="ghost"
                className={
                  row.status === 'active'
                    ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                    : 'text-slate-600 hover:bg-slate-100'
                }
                onClick={() => void toggleStatus(row)}
              >
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

  const orgOptions: ComboboxOption[] = useMemo(
    () =>
      orgs.map((org) => ({
        value: org.id,
        label: org.name,
        code: org.code,
      })),
    [orgs],
  )

  return (
    <div className="w-full space-y-3">
      <PageHeader
        eyebrow="Estructura organizacional"
        title="Sedes"
        description="Gestiona las sedes por organización de la red logística."
        actions={
          <PermissionGate permission={LOGISTICS_PERMISSIONS.branches.create}>
            <Button disabled={!selectedOrg} onClick={() => openDialog()}>
              Nueva sede
            </Button>
          </PermissionGate>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {/* Toolbar Horizontal de Filtros y Búsqueda */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <SearchableCombobox
            id="branches-org-filter"
            value={selectedOrg}
            options={orgOptions}
            onChange={(val) => {
              setSelectedOrg(val)
              setPage(1)
            }}
            placeholder="Selecciona una organización"
            searchPlaceholder="Buscar organización..."
            emptyMessage="Sin organizaciones"
          />
        </div>

        {selectedOrg && (
          <div className="flex-1 min-w-[260px] max-w-[420px]">
            <QueryBar
              search={search}
              placeholder="Buscar sede por nombre o código…"
              onSearch={(value) => {
                setSearch(value)
                setPage(1)
              }}
              className="!mb-0"
            />
          </div>
        )}
      </div>

      {selectedOrg ? (
        <div className="w-full">
          {isLoading ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-xs text-slate-500">
              <span className="spinner" />
              <p>Cargando sedes…</p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200/90 bg-white overflow-hidden shadow-xs">
              <OperationsTable
                rows={data.items}
                columns={columns}
                getRowKey={(row) => row.id}
                emptyMessage="No hay sedes registradas en esta organización."
              />
            </div>
          )}

          <Pagination
            page={data.page}
            totalPages={data.total_pages}
            total={data.total}
            pageSize={data.page_size}
            onPageChange={setPage}
          />
        </div>
      ) : (
        <div className="flex min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
          <p>Selecciona una organización en la barra superior para ver sus sedes.</p>
        </div>
      )}

      <ResourceDialog
        isOpen={isOpen}
        maxWidth="max-w-[700px]"
        title={editing ? 'Editar sede' : 'Nueva sede'}
        submitLabel={editing ? 'Guardar cambios' : 'Crear sede'}
        isSubmitting={isSaving}
        onClose={() => {
          setIsOpen(false)
          setEditing(null)
        }}
        onSubmit={() => void save()}
      >
        {error && <Alert variant="error">{error}</Alert>}

        <div className="space-y-4">
          {/* Fila superior: Organización de contexto & Código */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="field">
              <span className="field__label">Organización</span>
              <div className="field__readonly">
                {selectedOrgLabel
                  ? `${selectedOrgLabel.name} (${selectedOrgLabel.code})`
                  : 'Sin organización seleccionada'}
              </div>
            </div>

            <EntityCodeField code={editing?.code ?? null} />
          </div>

          {/* Información general */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nombre"
              value={form.name}
              onChange={(e) => updateText('name', e.target.value)}
              placeholder="Ej: Sede Central Trujillo"
              required
            />

            <TimezoneSelect
              value={form.timezone}
              onChange={(code) => setForm((current) => ({ ...current, timezone: code }))}
              disabled={isSaving}
            />
          </div>

          {/* Ubicación Administrativa */}
          <div className="pt-2 border-t border-slate-100">
            <div className="mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Ubicación administrativa
              </span>
              <p className="text-[11px] text-slate-400">
                El UBIGEO identifica el distrito oficial para operaciones y fiscalización.
              </p>
            </div>
            <UbigeoSelector
              value={form.ubigeo_code ?? null}
              resolved={editing?.ubigeo ?? null}
              onChange={(ubigeoCode) =>
                setForm((current) => ({ ...current, ubigeo_code: ubigeoCode }))
              }
              disabled={isSaving}
            />
          </div>

          {/* Dirección y Geolocalización */}
          <div className="pt-2 border-t border-slate-100">
            <div className="mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Dirección y ubicación en mapa
              </span>
              <p className="text-[11px] text-slate-400">
                Ingresa la dirección y localízala en el mapa. Puedes ajustar el marcador
                manualmente.
              </p>
            </div>
            <LocationPicker
              value={{
                address: form.address_text ?? '',
                latitude: form.latitude ?? null,
                longitude: form.longitude ?? null,
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
          </div>
        </div>

      </ResourceDialog>
    </div>
  )
}
