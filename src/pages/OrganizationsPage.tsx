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
import type {
  OrganizationResponse,
  PaginatedResponse,
} from '../types/logistics-resources'
import { getErrorMessage } from '../utils/errors'

export function OrganizationsPage() {
  const navigate = useNavigate()
  const access = useLogisticsAccess()
  const canCreate = access.hasPermission(LOGISTICS_PERMISSIONS.organizations.create)
  const canUpdate = access.hasPermission(LOGISTICS_PERMISSIONS.organizations.update)
  const canChangeStatus = access.hasPermission(
    LOGISTICS_PERMISSIONS.organizations.changeStatus,
  )
  const canManage = canCreate || canUpdate || canChangeStatus

  const [data, setData] = useState<PaginatedResponse<OrganizationResponse>>({
    items: [],
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
  })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await logisticsApi.organizations.list({ page, page_size: 20, search }))
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    } finally {
      setIsLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250)
    return () => window.clearTimeout(timer)
  }, [load])

  const toggleStatus = async (org: OrganizationResponse) => {
    setIsSaving(true)
    try {
      // Siempre la fila sobre la que se pulsó. `editing` sobrevive al cierre del
      // diálogo, así que usarlo aquí mandaba el PATCH a la organización equivocada.
      await logisticsApi.organizations.changeStatus(org.id, {
        status: org.status === 'active' ? 'inactive' : 'active',
      })
      await load()
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    } finally {
      setIsSaving(false)
    }
  }

  const columns: TableColumn<OrganizationResponse>[] = [
    {
      key: 'name',
      label: 'Organización',
      render: (row) => (
        <div className="flex flex-col min-w-0">
          <strong className="font-semibold text-slate-900 text-xs truncate">{row.name}</strong>
          <span className="font-mono text-[10px] text-slate-400 mt-0.5">{row.code}</span>
        </div>
      ),
    },
    {
      key: 'country_code',
      label: 'País',
      render: (row) => (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px] font-medium text-slate-700">
          {row.country_code}
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
              <Button
                size="small"
                variant="ghost"
                onClick={() => navigate(`/logistics/organizations/${row.id}/edit`)}
              >
                Editar
              </Button>
            )}
            {canChangeStatus && (
              <Button
                size="small"
                variant="ghost"
                disabled={isSaving}
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

  return (
    <div className="w-full space-y-3">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="w-full">
        <QueryBar
          search={search}
          placeholder="Buscar por nombre o código…"
          onSearch={(value) => {
            setSearch(value)
            setPage(1)
          }}
        >
          <PermissionGate permission={LOGISTICS_PERMISSIONS.organizations.create}>
            <Button onClick={() => navigate('/logistics/organizations/new')}>
              Nueva organización
            </Button>
          </PermissionGate>
        </QueryBar>

        {isLoading ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-xs text-slate-500">
            <span className="spinner" />
            <p>Cargando organizaciones…</p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200/90 bg-white overflow-hidden shadow-xs">
            <OperationsTable
              rows={data.items}
              columns={columns}
              getRowKey={(row) => row.id}
              emptyMessage="No se encontraron organizaciones registradas."
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

    </div>
  )
}
