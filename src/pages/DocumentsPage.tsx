import { useCallback, useEffect, useMemo, useState } from 'react'
import { documentsApi, documentTotalPages } from '../api/documents-api'
import { Alert } from '../components/common/Alert'
import { Button } from '../components/common/Button'
import { CancelDocumentDialog } from '../components/common/CancelDocumentDialog'
import { DocumentDetailPanel } from '../components/common/DocumentDetailPanel'
import { DocumentExportJobsPanel } from '../components/common/DocumentExportJobsPanel'
import { ExportDocumentsDialog } from '../components/common/ExportDocumentsDialog'
import { SelectField } from '../components/common/FormControls'
import { Input } from '../components/common/Input'
import { OperationsTable, type TableColumn } from '../components/common/OperationsTable'
import { PageHeader } from '../components/common/PageHeader'
import { Pagination } from '../components/common/Pagination'
import { QueryBar } from '../components/common/QueryBar'
import { ReprintDocumentDialog } from '../components/common/ReprintDocumentDialog'
import { SecurePdfViewer } from '../components/common/SecurePdfViewer'
import { StatusBadge } from '../components/common/StatusBadge'
import { useSensitiveOperationGuard } from '../features/continuous-auth/hooks/useSensitiveOperationGuard'
import { useLogisticsAccess } from '../features/logistics-me/hooks/useLogisticsAccess'
import { LOGISTICS_PERMISSIONS } from '../features/logistics-permissions/logistics-permissions-map'
import type {
  DocumentExportFormat,
  DocumentExportJob,
  DocumentListResponse,
  DocumentSummary,
} from '../types/logistics-documents'
import { getErrorMessage } from '../utils/errors'
import { getPdfErrorMessage } from '../api/pdf/pdf-client'

export function DocumentsPage() {
  const access = useLogisticsAccess()
  const { guardSensitiveAction } = useSensitiveOperationGuard()

  const canDownload = access.hasPermission(LOGISTICS_PERMISSIONS.documents.download)
  const canPreview = access.hasPermission(LOGISTICS_PERMISSIONS.documents.preview)
  const canReadSensitive = access.hasPermission(LOGISTICS_PERMISSIONS.audit.readSensitive)
  const canExport = access.hasPermission(LOGISTICS_PERMISSIONS.documents.export)
  const canCancel = access.hasPermission(LOGISTICS_PERMISSIONS.documents.cancel)
  const canReprint = access.hasPermission(LOGISTICS_PERMISSIONS.documents.reprint)

  const [data, setData] = useState<DocumentListResponse>({
    items: [],
    page: 1,
    page_size: 20,
    total: 0,
  })

  // Filtros
  const [search, setSearch] = useState('')
  const [familyFilter, setFamilyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Estados de Diálogos y Paneles
  const [previewDoc, setPreviewDoc] = useState<DocumentSummary | null>(null)
  const [detailDocId, setDetailDocId] = useState<string | null>(null)
  const [reprintDoc, setReprintDoc] = useState<DocumentSummary | null>(null)
  const [cancelDoc, setCancelDoc] = useState<DocumentSummary | null>(null)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [activeExportJob, setActiveExportJob] = useState<DocumentExportJob | null>(null)
  const [isExportJobsPanelOpen, setIsExportJobsPanelOpen] = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(
        await documentsApi.list({
          page,
          page_size: 20,
          search: search || undefined,
          status: statusFilter || undefined,
          family: familyFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
      )
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    } finally {
      setIsLoading(false)
    }
  }, [dateFrom, dateTo, familyFilter, page, search, statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250)
    return () => window.clearTimeout(timer)
  }, [load])

  const handlePdfDownload = useCallback(
    async (documentItem: DocumentSummary, original = false) => {
      setError(null)
      try {
        if (original) {
          const executed = await guardSensitiveAction(async () => {
            await documentsApi.downloadPdf(documentItem.id, true)
          })
          if (!executed) return
        } else {
          await documentsApi.downloadPdf(documentItem.id)
        }
      } catch (caught: unknown) {
        setError(getPdfErrorMessage(caught))
      }
    },
    [guardSensitiveAction],
  )

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Operaciones de Negocio
  const handleReprintSubmit = async (reason: string) => {
    if (!reprintDoc) return
    setIsSaving(true)
    try {
      const executed = await guardSensitiveAction(async () => {
        await documentsApi.reprint(reprintDoc.id, { reason })
      })
      if (!executed) return
      setReprintDoc(null)
      await load()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelSubmit = async (reason: string) => {
    if (!cancelDoc) return
    setIsSaving(true)
    try {
      const executed = await guardSensitiveAction(async () => {
        await documentsApi.cancel(cancelDoc.id, { reason })
      })
      if (!executed) return
      setCancelDoc(null)
      await load()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateExport = async (options: {
    exportFormat: DocumentExportFormat
    includeManifest: boolean
    includeChecksums: boolean
    reason?: string
  }) => {
    setIsSaving(true)
    try {
      const job = await documentsApi.createExport({
        document_ids: Array.from(selectedIds),
        export_format: options.exportFormat,
        include_manifest: options.includeManifest,
        include_checksums: options.includeChecksums,
        reason: options.reason,
      })
      setIsExportDialogOpen(false)
      setSelectedIds(new Set())
      setActiveExportJob(job)
      setIsExportJobsPanelOpen(true)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  // Definición de Columnas de la Tabla
  const columns = useMemo<TableColumn<DocumentSummary>[]>(
    () => [
      {
        key: 'select',
        label: '',
        render: (row) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.id)}
            onChange={() => toggleSelectOne(row.id)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
        ),
      },
      {
        key: 'document_code',
        label: 'Código',
        render: (row) => (
          <button
            type="button"
            className="text-left hover:underline text-blue-700 font-mono font-bold text-xs"
            onClick={() => setDetailDocId(row.id)}
          >
            {row.document_code ?? 'Sin código'}
          </button>
        ),
      },
      {
        key: 'title',
        label: 'Documento',
        render: (row) => (
          <div className="table-primary">
            <strong>{row.title}</strong>
            <small>{row.document_type_name}</small>
          </div>
        ),
      },
      {
        key: 'status',
        label: 'Estado',
        render: (row) => (
          <StatusBadge value={row.status.toLowerCase()}>{row.status}</StatusBadge>
        ),
      },
      {
        key: 'issued_at',
        label: 'Fecha de emisión',
        render: (row) =>
          row.issued_at
            ? new Date(row.issued_at).toLocaleDateString('es-PE')
            : 'Sin emitir',
      },
      {
        key: 'actions',
        label: 'Acciones',
        align: 'right',
        render: (row) => (
          <div className="table-actions">
            {row.can_preview && canPreview && (
              <Button size="small" variant="ghost" onClick={() => setPreviewDoc(row)}>
                Ver
              </Button>
            )}
            {row.can_download && canDownload && (
              <Button
                size="small"
                variant="ghost"
                onClick={() => void handlePdfDownload(row)}
              >
                Descargar
              </Button>
            )}
            {row.can_reprint && canReprint && (
              <Button size="small" variant="ghost" onClick={() => setReprintDoc(row)}>
                Reimprimir
              </Button>
            )}
            {row.can_cancel && row.status !== 'CANCELLED' && canCancel && (
              <Button size="small" variant="ghost" onClick={() => setCancelDoc(row)}>
                Anular
              </Button>
            )}
          </div>
        ),
      },
    ],
    [canCancel, canDownload, canPreview, canReprint, handlePdfDownload, selectedIds],
  )

  return (
    <div className="page">
      <PageHeader
        eyebrow="Gestión documental"
        title="Centro Documental Logístico"
        description="Emisión, verificación, reimpresión y archivo auditable de comprobantes oficiales."
        actions={
          <div className="flex items-center gap-2">
            {activeExportJob && (
              <Button variant="secondary" onClick={() => setIsExportJobsPanelOpen(true)}>
                Ver exportación activa
              </Button>
            )}
            <Button onClick={() => void load()} disabled={isLoading}>
              Actualizar
            </Button>
          </div>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {/* Barra de Acciones Masivas cuando hay elementos seleccionados */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
          <span>
            <strong>{selectedIds.size}</strong> documentos seleccionados en esta página
          </span>
          <div className="flex items-center gap-2">
            <Button size="small" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Limpiar selección
            </Button>
            {canExport && (
              <Button size="small" onClick={() => setIsExportDialogOpen(true)}>
                Exportar paquete ZIP
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Panel principal de filtros y tabla */}
      <section className="panel operations-section space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label="Familia de documento"
            value={familyFilter}
            onChange={(e) => {
              setFamilyFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Todas las familias</option>
            <option value="REMISSION_GUIDE">Guía de Remisión</option>
            <option value="MANIFEST">Manifiesto de Carga</option>
            <option value="PROOF_OF_DELIVERY">Prueba de Entrega (POD)</option>
            <option value="INCIDENT_ACT">Acta de Incidentes</option>
          </SelectField>

          <SelectField
            label="Estado"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Todos los estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="ISSUED">Emitido</option>
            <option value="CANCELLED">Anulado</option>
            <option value="ARCHIVED">Archivado</option>
          </SelectField>

          <Input
            label="Desde fecha"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(1)
            }}
          />

          <Input
            label="Hasta fecha"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(1)
            }}
          />
        </div>

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
            <p>Cargando archivo documental…</p>
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
          totalPages={documentTotalPages(data.total, data.page_size)}
          total={data.total}
          onPageChange={setPage}
        />
      </section>

      {/* Diálogos y Visores */}
      <SecurePdfViewer
        isOpen={Boolean(previewDoc)}
        title={previewDoc?.title || ''}
        code={previewDoc?.document_code ?? ''}
        isVoided={previewDoc?.status === 'CANCELLED'}
        reprintCount={previewDoc?.reprint_count}
        fetchBlobUrl={async () => {
          if (!previewDoc) return ''
          return documentsApi.getPreviewBlobUrl(previewDoc.id)
        }}
        onClose={() => setPreviewDoc(null)}
        onDownload={() => {
          if (previewDoc) void handlePdfDownload(previewDoc)
        }}
        onPrint={() => {
          if (previewDoc) void documentsApi.registerPrintIntent(previewDoc.id)
        }}
      />

      <DocumentDetailPanel
        documentId={detailDocId}
        onClose={() => setDetailDocId(null)}
        onPreview={canPreview ? (doc) => setPreviewDoc(doc) : undefined}
        onDownload={canDownload ? (doc) => void handlePdfDownload(doc) : undefined}
        onDownloadOriginal={canReadSensitive ? (doc) => void handlePdfDownload(doc, true) : undefined}
        onReprint={(doc) => setReprintDoc(doc)}
        onCancel={(doc) => setCancelDoc(doc)}
      />

      <ReprintDocumentDialog
        isOpen={Boolean(reprintDoc)}
        document={reprintDoc}
        isSubmitting={isSaving}
        onClose={() => setReprintDoc(null)}
        onSubmit={handleReprintSubmit}
      />

      <CancelDocumentDialog
        isOpen={Boolean(cancelDoc)}
        document={cancelDoc}
        isSubmitting={isSaving}
        onClose={() => setCancelDoc(null)}
        onSubmit={handleCancelSubmit}
      />

      <ExportDocumentsDialog
        isOpen={isExportDialogOpen}
        selectedCount={selectedIds.size}
        isSubmitting={isSaving}
        onClose={() => setIsExportDialogOpen(false)}
        onSubmit={handleCreateExport}
      />

      <DocumentExportJobsPanel
        isOpen={isExportJobsPanelOpen}
        job={activeExportJob}
        onClose={() => setIsExportJobsPanelOpen(false)}
      />
    </div>
  )
}
