import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { useLogisticsAccess } from '../features/logistics-me/hooks/useLogisticsAccess'
import { LOGISTICS_PERMISSIONS } from '../features/logistics-permissions/logistics-permissions-map'
import type {
  BranchResponse,
  LogisticsWarehouseCreate,
  LogisticsWarehouseResponse,
  OrganizationResponse,
  PaginatedResponse,
} from '../types/logistics-resources'
import { getErrorMessage } from '../utils/errors'

/**
 * Tipos aceptados por `LogisticsWarehouseCreate.normalize_type` en el backend.
 * En minúscula, que es lo que valida la superficie estructural F004.
 */
const WAREHOUSE_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'receiving', label: 'Recepción' },
  { value: 'dispatch', label: 'Despacho' },
  { value: 'quarantine', label: 'Cuarentena' },
  { value: 'returns', label: 'Devoluciones' },
  { value: 'transit', label: 'Tránsito' },
]

const emptyForm: LogisticsWarehouseCreate = {
  code: '',
  name: '',
  warehouse_type: 'general',
  address: '',
  district: '',
  province: '',
  department: '',
}

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

  const [orgs, setOrgs] = useState<OrganizationResponse[]>([])
  const [selectedOrg, setSelectedOrg] = useState('')
  const [branches, setBranches] = useState<BranchResponse[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [data, setData] = useState(emptyPage)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<LogisticsWarehouseCreate>(emptyForm)
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
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

  const save = async () => {
    if (isSaving || !selectedBranch) return
    setIsSaving(true)
    setError(null)
    try {
      // La sede va en la ruta y la organización la deriva el backend desde ella:
      // el formulario nunca envía un UUID escrito a mano.
      await logisticsApi.warehouses.create(selectedBranch, form)
      setIsOpen(false)
      setForm(emptyForm)
      await load()
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    } finally {
      setIsSaving(false)
    }
  }

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
          <div className="table-primary">
            <strong>{row.name}</strong>
            <small>{row.code}</small>
          </div>
        ),
      },
      {
        key: 'warehouse_type',
        label: 'Tipo',
        render: (row) =>
          WAREHOUSE_TYPES.find((t) => t.value === row.warehouse_type)?.label ??
          row.warehouse_type,
      },
      {
        key: 'address',
        label: 'Ubicación',
        render: (row) =>
          [row.district, row.province, row.department].filter(Boolean).join(' · ') ||
          'No definida',
      },
      {
        key: 'is_default',
        label: 'Predeterminado',
        render: (row) => (row.is_default ? 'Sí' : 'No'),
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
          <div className="table-actions">
            <Button size="small" variant="ghost" onClick={() => void openDetail(row)}>
              Ficha
            </Button>
            {canChangeStatus && (
              <Button size="small" variant="ghost" onClick={() => void toggleStatus(row)}>
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
    [navigate, canChangeStatus, selectedBranch],
  )

  const updateText = (key: keyof LogisticsWarehouseCreate, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="page">
      <PageHeader
        eyebrow="Estructura organizacional"
        title="Almacenes"
        description="Almacenes como entidad estructural, dentro de su organización y sede."
        actions={
          <PermissionGate permission={LOGISTICS_PERMISSIONS.warehouses.create}>
            <Button
              disabled={!selectedBranch}
              onClick={() => {
                setForm(emptyForm)
                setIsOpen(true)
              }}
            >
              Nuevo almacén
            </Button>
          </PermissionGate>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      <section className="panel operations-section space-y-3">
        <div className="flex items-center gap-3 mb-4">
          <label htmlFor="wh-org-select" className="text-sm font-medium text-slate-700">
            Organización:
          </label>
          <select
            id="wh-org-select"
            className="field__input"
            value={selectedOrg}
            onChange={(e) => {
              setSelectedOrg(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Selecciona una organización</option>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.code})
              </option>
            ))}
          </select>

          <label htmlFor="wh-branch-select" className="text-sm font-medium text-slate-700">
            Sede:
          </label>
          <select
            id="wh-branch-select"
            className="field__input"
            value={selectedBranch}
            onChange={(e) => {
              setSelectedBranch(e.target.value)
              setPage(1)
            }}
            disabled={!selectedOrg || branches.length === 0}
          >
            <option value="">Selecciona una sede</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </div>

        {selectedBranch ? (
          <>
            <QueryBar
              search={search}
              onSearch={(val) => {
                setSearch(val)
                setPage(1)
              }}
            />

            {isLoading ? (
              <div className="loading-panel">
                <span className="spinner" />
                <p>Cargando almacenes…</p>
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
            <p>
              {selectedOrg
                ? 'Esta organización no tiene sedes. Crea una sede antes de registrar almacenes.'
                : 'Selecciona una organización y una sede para ver sus almacenes.'}
            </p>
          </div>
        )}
      </section>

      <ResourceDialog
        isOpen={isOpen}
        title="Nuevo almacén"
        submitLabel="Crear almacén"
        isSubmitting={isSaving}
        isSubmitDisabled={!selectedBranch}
        onClose={() => setIsOpen(false)}
        onSubmit={() => void save()}
      >
        <div className="form-grid">
          <Input
            label="Organización"
            value={(() => {
              const org = orgs.find((o) => o.id === selectedOrg)
              return org ? `${org.name} (${org.code})` : ''
            })()}
            readOnly
            disabled
          />
          <Input
            label="Sede"
            value={(() => {
              const branch = branches.find((b) => b.id === selectedBranch)
              return branch ? `${branch.name} (${branch.code})` : ''
            })()}
            readOnly
            disabled
          />
          <Input
            label="Código"
            value={form.code}
            onChange={(e) => updateText('code', e.target.value)}
            required
          />
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => updateText('name', e.target.value)}
            required
          />
          <div className="field">
            <label className="field__label" htmlFor="wh-type-select">
              Tipo
            </label>
            <div className="field__control">
              <select
                id="wh-type-select"
                className="field__input"
                value={form.warehouse_type}
                onChange={(e) => updateText('warehouse_type', e.target.value)}
              >
                {WAREHOUSE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Input
            label="Dirección"
            value={form.address}
            onChange={(e) => updateText('address', e.target.value)}
            required
          />
          <Input
            label="Distrito"
            value={form.district}
            onChange={(e) => updateText('district', e.target.value)}
            required
          />
          <Input
            label="Provincia"
            value={form.province}
            onChange={(e) => updateText('province', e.target.value)}
            required
          />
          <Input
            label="Departamento"
            value={form.department}
            onChange={(e) => updateText('department', e.target.value)}
            required
          />
        </div>
      </ResourceDialog>

      <ResourceDialog
        isOpen={detail !== null}
        title={detail ? `Ficha · ${detail.name}` : 'Ficha'}
        submitLabel="Cerrar"
        onClose={() => setDetail(null)}
        onSubmit={() => setDetail(null)}
      >
        {detail && (
          <dl className="form-grid">
            <div>
              <dt className="field__label">Código</dt>
              <dd>{detail.code}</dd>
            </div>
            <div>
              <dt className="field__label">Tipo</dt>
              <dd>{detail.warehouse_type}</dd>
            </div>
            <div>
              <dt className="field__label">Organización</dt>
              <dd>
                {orgs.find((o) => o.id === detail.organization_id)?.name ??
                  detail.organization_id ??
                  'Sin organización'}
              </dd>
            </div>
            <div>
              <dt className="field__label">Sede</dt>
              <dd>
                {branches.find((b) => b.id === detail.branch_id)?.name ??
                  detail.branch_id ??
                  'Sin sede'}
              </dd>
            </div>
            <div>
              <dt className="field__label">Dirección</dt>
              <dd>{detail.address ?? 'No definida'}</dd>
            </div>
            <div>
              <dt className="field__label">Estado</dt>
              <dd>{detail.is_active ? 'Activo' : 'Inactivo'}</dd>
            </div>
          </dl>
        )}
      </ResourceDialog>
    </div>
  )
}
