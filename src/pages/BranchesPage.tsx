import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logisticsApi } from '../api/logistics-api'
import { Alert } from '../components/common/Alert'
import { Button } from '../components/common/Button'
import { OperationsTable, type TableColumn } from '../components/common/OperationsTable'
import { Pagination } from '../components/common/Pagination'
import { QueryBar } from '../components/common/QueryBar'
import { StatusBadge } from '../components/common/StatusBadge'
import { PermissionGate } from '../components/logistics/PermissionGate'
import { useLogisticsAccess } from '../features/logistics-me/hooks/useLogisticsAccess'
import { LOGISTICS_PERMISSIONS } from '../features/logistics-permissions/logistics-permissions-map'
import type { BranchResponse, OrganizationResponse, PaginatedResponse } from '../types/logistics-resources'
import { getErrorMessage } from '../utils/errors'

const emptyPage: PaginatedResponse<BranchResponse> = {
  items: [],
  total: 0,
  page: 1,
  page_size: 20,
  total_pages: 1,
}

export function BranchesPage() {
  const navigate = useNavigate()
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
  const [error, setError] = useState<string | null>(null)

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
              <Button
                size="small"
                variant="ghost"
                onClick={() => navigate(`/logistics/branches/${row.id}/edit`)}
              >
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

  return (
    <div className="w-full space-y-3">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor="org-select" className="field w-full sm:w-72">
          <span className="field__label">Organización</span>
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
        </label>
        <div className="min-w-[260px] flex-1">
          <QueryBar
            search={search}
            placeholder="Buscar sede por nombre o código…"
            className="!mb-0"
            onSearch={(value) => {
              setSearch(value)
              setPage(1)
            }}
          >
            <PermissionGate permission={LOGISTICS_PERMISSIONS.branches.create}>
              <Button
                disabled={!selectedOrg}
                onClick={() =>
                  navigate(`/logistics/branches/new?organizationId=${selectedOrg}`)
                }
              >
                Nueva sede
              </Button>
            </PermissionGate>
          </QueryBar>
        </div>
      </div>

      {selectedOrg ? (
        <div className="w-full">
            {isLoading ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center text-xs text-slate-500">
                <span className="spinner" />
                <p>Cargando sedes…</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
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
        <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs text-slate-500">
          Selecciona una organización para ver sus sedes.
        </div>
      )}
    </div>
  )
}
