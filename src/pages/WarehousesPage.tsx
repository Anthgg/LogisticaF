import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logisticsApi } from '../api/logistics-api'
import { Alert } from '../components/common/Alert'
import { Button } from '../components/common/Button'
import { OperationsTable, type TableColumn } from '../components/common/OperationsTable'
import { Pagination } from '../components/common/Pagination'
import { QueryBar } from '../components/common/QueryBar'
import { ResourceDialog } from '../components/common/ResourceDialog'
import { StatusBadge } from '../components/common/StatusBadge'
import { SearchableCombobox, type ComboboxOption } from '../components/ui/SearchableCombobox'
import { PermissionGate } from '../components/logistics/PermissionGate'
import { useLogisticsAccess } from '../features/logistics-me/hooks/useLogisticsAccess'
import { LOGISTICS_PERMISSIONS } from '../features/logistics-permissions/logistics-permissions-map'
import type {
  BranchResponse,
  LogisticsWarehouseResponse,
  OrganizationResponse,
  PaginatedResponse,
} from '../types/logistics-resources'
import { getErrorMessage } from '../utils/errors'

const emptyPage: PaginatedResponse<LogisticsWarehouseResponse> = {
  items: [],
  page: 1,
  page_size: 20,
  total: 0,
  total_pages: 0,
}

export function WarehousesPage() {
  const navigate = useNavigate()
  const access = useLogisticsAccess()
  const canChangeStatus = access.hasPermission(
    LOGISTICS_PERMISSIONS.warehouses.changeStatus,
  )
  const canUpdate = access.hasPermission(LOGISTICS_PERMISSIONS.warehouses.update)

  const [orgs, setOrgs] = useState<OrganizationResponse[]>([])
  const [selectedOrg, setSelectedOrg] = useState('')
  const [branches, setBranches] = useState<BranchResponse[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [data, setData] = useState(emptyPage)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [detail, setDetail] = useState<LogisticsWarehouseResponse | null>(null)

  // 1. Organizaciones
  useEffect(() => {
    void logisticsApi.organizations
      .list({ page: 1, page_size: 100 })
      .then((res) => {
        setOrgs(res.items)
        setSelectedOrg((current) => current || res.items[0]?.id || '')
      })
      .catch((caught: unknown) => setError(getErrorMessage(caught)))
  }, [])

  // 2. Sedes de la organización elegida
  useEffect(() => {
    if (!selectedOrg) {
      setBranches([])
      setSelectedBranch('')
      return
    }
    void logisticsApi.organizations
      .branches(selectedOrg, { page: 1, page_size: 100 })
      .then((res) => {
        setBranches(res.items)
        setSelectedBranch(res.items[0]?.id ?? '')
      })
      .catch((caught: unknown) => setError(getErrorMessage(caught)))
  }, [selectedOrg])

  // 3. Almacenes de la sede elegida
  const load = useCallback(async () => {
    if (!selectedBranch) {
      setData(emptyPage)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      setData(
        await logisticsApi.warehouses.listByBranch(selectedBranch, {
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
  }, [selectedBranch, page, search])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250)
    return () => window.clearTimeout(timer)
  }, [load])

  const toggleStatus = async (row: LogisticsWarehouseResponse) => {
    setError(null)
    try {
      await logisticsApi.warehouses.changeStatus(row.id, {
        status: row.is_active ? 'inactive' : 'active',
      })
      await load()
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    }
  }

  const openDetail = async (row: LogisticsWarehouseResponse) => {
    setError(null)
    try {
      setDetail(await logisticsApi.warehouses.get(selectedBranch, row.id))
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    }
  }

  const columns = useMemo<TableColumn<LogisticsWarehouseResponse>[]>(
    () => [
      {
        key: 'name',
        label: 'Almacén',
        render: (row) => (
          <div className="flex flex-col min-w-0">
            <strong className="font-semibold text-slate-900 text-xs truncate">{row.name}</strong>
            <span className="font-mono text-[10px] text-slate-400 mt-0.5">{row.code}</span>
          </div>
        ),
      },
      {
        key: 'warehouse_type',
        label: 'Tipo',
        render: (row) => (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px] font-medium text-slate-700 capitalize">
            {row.warehouse_type}
          </span>
        ),
      },
      {
        key: 'address',
        label: 'Ubicación',
        render: (row) => (
          <div className="text-xs">
            <span className="font-medium text-slate-700">
              {row.location_source === 'WAREHOUSE' ? 'Almacén' : 'Sede'}
            </span>
            <span className="ml-1 text-slate-500">
              {row.effective_latitude != null && row.effective_longitude != null
                ? `${row.effective_latitude.toFixed(5)}, ${row.effective_longitude.toFixed(5)}`
                : '· Sin coordenadas'}
            </span>
          </div>
        ),
      },
      {
        key: 'is_default',
        label: 'Predeterminado',
        render: (row) => (
          <span
            className={`text-xs font-medium ${row.is_default ? 'text-primary font-semibold' : 'text-slate-400'}`}
          >
            {row.is_default ? 'Sí' : 'No'}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Estado',
        render: (row) => (
          <StatusBadge value={row.is_active ? 'active' : 'inactive'}>
            {row.is_active ? 'Activo' : 'Inactivo'}
          </StatusBadge>
        ),
      },
      {
        key: 'actions',
        label: 'Acciones',
        align: 'right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1">
            <Button size="small" variant="ghost" onClick={() => void openDetail(row)}>
              Ficha
            </Button>
            {canUpdate && (
              <Button
                size="small"
                variant="ghost"
                onClick={() => navigate(`/logistics/warehouses/${row.id}/edit`)}
              >
                Editar
              </Button>
            )}
            {canChangeStatus && (
              <Button
                size="small"
                variant="ghost"
                className={
                  row.is_active
                    ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                    : 'text-slate-600 hover:bg-slate-100'
                }
                onClick={() => void toggleStatus(row)}
              >
                {row.is_active ? 'Desactivar' : 'Activar'}
              </Button>
            )}
            <Button
              size="small"
              variant="ghost"
              onClick={() => navigate(`/logistics/settings/warehouses/${row.id}`)}
            >
              Estructura
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, canChangeStatus, canUpdate, selectedBranch],
  )

  const orgOptions: ComboboxOption[] = useMemo(
    () =>
      orgs.map((org) => ({
        value: org.id,
        label: org.name,
        code: org.code,
      })),
    [orgs],
  )

  const branchOptions: ComboboxOption[] = useMemo(
    () =>
      branches.map((b) => ({
        value: b.id,
        label: b.name,
        code: b.code,
      })),
    [branches],
  )

  return (
    <div className="w-full space-y-3">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Toolbar Horizontal de Filtros en Cascada y Búsqueda */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <SearchableCombobox
            id="wh-org-select"
            value={selectedOrg}
            options={orgOptions}
            onChange={(val) => {
              setSelectedOrg(val)
              setPage(1)
            }}
            placeholder="Organización..."
            searchPlaceholder="Buscar organización..."
            emptyMessage="Sin organizaciones"
          />
        </div>

        <div className="w-full sm:w-64">
          <SearchableCombobox
            id="wh-branch-select"
            value={selectedBranch}
            options={branchOptions}
            onChange={(val) => {
              setSelectedBranch(val)
              setPage(1)
            }}
            disabled={!selectedOrg || branches.length === 0}
            placeholder={
              !selectedOrg
                ? 'Elige organización primero'
                : branches.length === 0
                  ? 'Sin sedes disponibles'
                  : 'Sede...'
            }
            searchPlaceholder="Buscar sede..."
            emptyMessage="Sin sedes en esta organización"
          />
        </div>

        {selectedBranch && (
          <div className="flex-1 min-w-[240px] max-w-[380px]">
            <QueryBar
              search={search}
              placeholder="Buscar almacén por nombre o código…"
              onSearch={(val) => {
                setSearch(val)
                setPage(1)
              }}
              className="!mb-0"
            />
          </div>
        )}

        <PermissionGate permission={LOGISTICS_PERMISSIONS.warehouses.create}>
          <Button
            disabled={!selectedBranch}
            onClick={() =>
              navigate(
                `/logistics/warehouses/new?organizationId=${selectedOrg}&branchId=${selectedBranch}`,
              )
            }
          >
            Nuevo almacén
          </Button>
        </PermissionGate>
      </div>

      {selectedBranch ? (
        <div className="w-full">
          {isLoading ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-xs text-slate-500">
              <span className="spinner" />
              <p>Cargando almacenes…</p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200/90 bg-white overflow-hidden shadow-xs">
              <OperationsTable
                rows={data.items}
                columns={columns}
                getRowKey={(row) => row.id}
                emptyMessage="No hay almacenes registrados en esta sede."
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
          <p>
            {selectedOrg
              ? 'Esta organización no tiene sedes. Crea una sede antes de registrar almacenes.'
              : 'Selecciona una organización y una sede en la barra superior para ver sus almacenes.'}
          </p>
        </div>
      )}

      {/* Modal Ficha Detallada */}
      <ResourceDialog
        isOpen={detail !== null}
        maxWidth="max-w-[560px]"
        title={detail ? `Ficha · ${detail.name}` : 'Ficha'}
        submitLabel="Cerrar"
        onClose={() => setDetail(null)}
        onSubmit={() => setDetail(null)}
      >
        {detail && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Código
              </dt>
              <dd className="font-mono font-bold text-slate-900 mt-0.5">{detail.code}</dd>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tipo
              </dt>
              <dd className="font-semibold text-slate-800 capitalize mt-0.5">
                {detail.warehouse_type}
              </dd>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Organización
              </dt>
              <dd className="text-slate-800 mt-0.5">
                {orgs.find((o) => o.id === detail.organization_id)?.name ??
                  detail.organization_id ??
                  'Sin organización'}
              </dd>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Sede
              </dt>
              <dd className="text-slate-800 mt-0.5">
                {branches.find((b) => b.id === detail.branch_id)?.name ??
                  detail.branch_id ??
                  'Sin sede'}
              </dd>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 sm:col-span-2">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Dirección / Referencia
              </dt>
              <dd className="text-slate-800 mt-0.5">{detail.address ?? 'No definida'}</dd>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 sm:col-span-2 flex items-center justify-between">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Estado operativo
                </dt>
                <dd className="mt-0.5">
                  <StatusBadge value={detail.is_active ? 'active' : 'inactive'}>
                    {detail.is_active ? 'Activo' : 'Inactivo'}
                  </StatusBadge>
                </dd>
              </div>

              <div className="text-right">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Predeterminado
                </dt>
                <dd className="font-semibold text-slate-700 mt-0.5">
                  {detail.is_default ? 'Sí' : 'No'}
                </dd>
              </div>
            </div>
          </dl>
        )}
      </ResourceDialog>
    </div>
  )
}
