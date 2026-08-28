import { useCallback, useEffect, useState } from 'react'
import { logisticsApi } from '../api/logistics-api'
import { Alert } from '../components/common/Alert'
import { Button } from '../components/common/Button'
import { OperationsTable, type TableColumn } from '../components/common/OperationsTable'
import { PageHeader } from '../components/common/PageHeader'
import { Pagination } from '../components/common/Pagination'
import { QueryBar } from '../components/common/QueryBar'
import { StatusBadge } from '../components/common/StatusBadge'
import { AuditEventDetailModal } from '../components/audit/AuditEventDetailModal'
import { useLogisticsAccess } from '../features/logistics-me/hooks/useLogisticsAccess'
import { LOGISTICS_PERMISSIONS } from '../features/logistics-permissions/logistics-permissions-map'
import type {
  AuditEventListQuery,
  AuditEventSummaryResponse,
  PaginatedResponse,
} from '../types/logistics-resources'
import { getErrorMessage } from '../utils/errors'

export function AuditEventsPage() {
  const access = useLogisticsAccess()
  const [data, setData] = useState<PaginatedResponse<AuditEventSummaryResponse>>({
    items: [],
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
  })

  // Filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  // Loading & error states
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null)

  // Selected event for detail modal
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const buildQuery = useCallback((): AuditEventListQuery => {
    const query: AuditEventListQuery = { page, page_size: 20 }
    if (search.trim()) query.search = search.trim()
    if (categoryFilter) query.category = categoryFilter
    if (severityFilter) query.severity = severityFilter
    if (resultFilter) query.result = resultFilter
    if (actionFilter) query.action = actionFilter
    if (dateFrom) query.date_from = `${dateFrom}T00:00:00Z`
    if (dateTo) query.date_to = `${dateTo}T23:59:59Z`
    return query
  }, [page, search, categoryFilter, severityFilter, resultFilter, actionFilter, dateFrom, dateTo])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const query = buildQuery()
      setData(await logisticsApi.auditEvents.list(query))
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    } finally {
      setIsLoading(false)
    }
  }, [buildQuery])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250)
    return () => window.clearTimeout(timer)
  }, [load])

  const handleClearFilters = () => {
    setSearch('')
    setCategoryFilter('')
    setSeverityFilter('')
    setResultFilter('')
    setActionFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const handleExportCsv = async () => {
    setIsExporting(true)
    setError(null)
    setExportSuccessMsg(null)
    try {
      const query = buildQuery()
      delete query.page
      delete query.page_size
      const blob = await logisticsApi.auditEvents.exportCsv(query)
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const today = new Date().toISOString().slice(0, 10)
      a.download = `eventos-auditoria-${today}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setExportSuccessMsg('Exportación CSV completada y descargada exitosamente.')
      setTimeout(() => setExportSuccessMsg(null), 5000)
    } catch (err: unknown) {
      setError(`Error al exportar auditoría: ${getErrorMessage(err)}`)
    } finally {
      setIsExporting(false)
    }
  }

  const openDetail = (id: string) => {
    setSelectedEventId(id)
    setIsDetailOpen(true)
  }

  const columns: TableColumn<AuditEventSummaryResponse>[] = [
    {
      key: 'occurred_at',
      label: 'Fecha (UTC)',
      render: (row) => (
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {new Date(row.occurred_at).toLocaleString('es-PE')}
        </span>
      ),
    },
    {
      key: 'event_code',
      label: 'Código de Evento',
      render: (row) => (
        <code className="text-xs font-mono text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
          {row.event_code}
        </code>
      ),
    },
    {
      key: 'event_category',
      label: 'Categoría',
      render: (row) => (
        <span className="text-xs text-gray-600 dark:text-gray-300 capitalize">
          {row.event_category}
        </span>
      ),
    },
    {
      key: 'actor_display_name_snapshot',
      label: 'Actor',
      render: (row) => (
        <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
          {row.actor_display_name_snapshot ?? 'Sistema'}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Acción',
      render: (row) => (
        <span className="text-xs font-mono uppercase text-gray-700 dark:text-gray-300">
          {row.action ?? '—'}
        </span>
      ),
    },
    {
      key: 'result',
      label: 'Resultado',
      render: (row) => (
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            row.result === 'success'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
          }`}
        >
          {row.result}
        </span>
      ),
    },
    {
      key: 'severity',
      label: 'Severidad',
      render: (row) => {
        const variant =
          row.severity === 'critical' || row.severity === 'high'
            ? 'inactive'
            : row.severity === 'medium'
              ? 'pending'
              : 'active'
        return <StatusBadge value={variant}>{row.severity.toUpperCase()}</StatusBadge>
      },
    },
    {
      key: 'resource_type',
      label: 'Recurso',
      render: (row) => (
        <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[120px] block">
          {row.resource_type ? `${row.resource_type} (${row.resource_id ?? ''})` : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Acción',
      render: (row) => (
        <Button
          type="button"
          variant="secondary"
          className="text-xs py-1 px-2"
          onClick={() => openDetail(row.id)}
        >
          Ver Detalle
        </Button>
      ),
    },
  ]

  if (!access.hasPermission(LOGISTICS_PERMISSIONS.audit.read)) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Auditoría"
          title="Eventos de auditoría"
          description="Registro unificado de operaciones del sistema logístico."
        />
        <Alert variant="error">No tienes permisos para consultar eventos de auditoría.</Alert>
      </div>
    )
  }

  const canExport = access.hasPermission(LOGISTICS_PERMISSIONS.audit.export)

  return (
    <div className="page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader
          eyebrow="Auditoría Unificada"
          title="Eventos de auditoría"
          description="Trazabilidad completa, diffs Before/After, verificación de integridad mediante hash SHA-256 y exportación segura."
        />
        {canExport && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleExportCsv}
              disabled={isExporting}
              className="flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {isExporting ? 'Generando CSV…' : 'Exportar CSV'}
            </Button>
          </div>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {exportSuccessMsg && <Alert variant="success">{exportSuccessMsg}</Alert>}

      <section className="panel operations-section space-y-4">
        {/* Multi-filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="lg:col-span-2">
            <QueryBar
              search={search}
              onSearch={(value) => {
                setSearch(value)
                setPage(1)
              }}
              placeholder="Buscar por código, actor o recurso…"
            />
          </div>

          <div>
            <select
              className="field__input w-full text-xs"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setPage(1)
              }}
              aria-label="Filtrar por categoría"
            >
              <option value="">Todas las categorías</option>
              <option value="organization">Organización</option>
              <option value="branch">Sede</option>
              <option value="warehouse">Almacén</option>
              <option value="security">Seguridad & Sesión</option>
              <option value="document">Documentos</option>
              <option value="role">Roles y Permisos</option>
              <option value="system">Sistema</option>
            </select>
          </div>

          <div>
            <select
              className="field__input w-full text-xs"
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value)
                setPage(1)
              }}
              aria-label="Filtrar por severidad"
            >
              <option value="">Todas las severidades</option>
              <option value="info">Info</option>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </div>

          <div>
            <select
              className="field__input w-full text-xs"
              value={resultFilter}
              onChange={(e) => {
                setResultFilter(e.target.value)
                setPage(1)
              }}
              aria-label="Filtrar por resultado"
            >
              <option value="">Todos los resultados</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="denied">Denied</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div>
            <input
              type="date"
              className="field__input w-full text-xs"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              aria-label="Fecha desde"
              title="Fecha inicial"
            />
          </div>

          <div>
            <input
              type="date"
              className="field__input w-full text-xs"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
              aria-label="Fecha hasta"
              title="Fecha final"
            />
          </div>
        </div>

        {/* Filter status & clear button */}
        {(search || categoryFilter || severityFilter || resultFilter || actionFilter || dateFrom || dateTo) && (
          <div className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-900/50 p-2 rounded border border-gray-200 dark:border-gray-800">
            <span className="text-gray-600 dark:text-gray-400">
              Filtros activos aplicados. Mostrando {data.total} eventos encontrados.
            </span>
            <Button
              type="button"
              variant="secondary"
              className="text-xs py-0.5 px-2"
              onClick={handleClearFilters}
            >
              Limpiar filtros
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="loading-panel py-12">
            <span className="spinner mb-2" />
            <p className="text-sm text-gray-500">Cargando eventos de auditoría…</p>
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
      </section>

      {/* Detail / Diff / Integrity Modal */}
      <AuditEventDetailModal
        eventId={selectedEventId}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setSelectedEventId(null)
        }}
      />
    </div>
  )
}
