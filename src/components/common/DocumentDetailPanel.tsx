import { useEffect, useState } from 'react'
import { documentsApi } from '../../api/documents-api'
import { Button } from './Button'
import { StatusBadge } from './StatusBadge'
import type { DocumentDetail, DocumentHistoryEntry } from '../../types/logistics-documents'
import { formatDateTime } from '../../utils/date'
import { getErrorMessage } from '../../utils/errors'

interface DocumentDetailPanelProps {
  documentId: string | null
  onClose: () => void
  onPreview?: (doc: DocumentDetail) => void
  onDownload?: (doc: DocumentDetail) => void
  /** Solo se pasa cuando quien abre el panel tiene el permiso sensible. */
  onDownloadOriginal?: (doc: DocumentDetail) => void
  onReprint?: (doc: DocumentDetail) => void
  onCancel?: (doc: DocumentDetail) => void
}

/** Título legible de un evento. El backend no publica `description`. */
function historyLabel(entry: DocumentHistoryEntry): string {
  return entry.copy_number === null || entry.copy_number === undefined
    ? entry.event_type
    : `${entry.event_type} · copia ${entry.copy_number}`
}

export function DocumentDetailPanel({
  documentId,
  onClose,
  onPreview,
  onDownload,
  onDownloadOriginal,
  onReprint,
  onCancel,
}: DocumentDetailPanelProps) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [history, setHistory] = useState<DocumentHistoryEntry[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!documentId) {
      setDoc(null)
      setHistory([])
      setHistoryError(null)
      return undefined
    }

    let active = true
    setIsLoading(true)
    setError(null)
    setHistoryError(null)

    // El historial se pide aparte: si falla, el detalle sigue siendo válido y
    // el panel debe decir que el historial no cargó, no fingir que está vacío.
    documentsApi
      .get(documentId)
      .then(async (detailData) => {
        if (!active) return
        setDoc(detailData)
        if (!detailData.can_view_history) {
          setHistory([])
          return
        }
        try {
          const historyData = await documentsApi.getHistory(documentId)
          if (active) setHistory(historyData)
        } catch (err: unknown) {
          if (active) {
            setHistory([])
            setHistoryError(getErrorMessage(err))
          }
        }
      })
      .catch((err: unknown) => {
        if (active) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [documentId])

  if (!documentId) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex justify-end bg-slate-950/40 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl overflow-hidden border-l border-slate-200">
        {/* Encabezado del panel */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
              Detalle documental inmutable
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              {doc ? doc.document_code ?? 'Sin código' : 'Cargando…'}
            </h2>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            onClick={onClose}
            aria-label="Cerrar panel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isLoading && (
            <div className="loading-panel">
              <span className="spinner" />
              <p>Consultando el documento…</p>
            </div>
          )}

          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

          {doc && (
            <>
              {/* Acciones principales */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
                {doc.can_preview && onPreview && (
                  <Button size="small" variant="secondary" onClick={() => onPreview(doc)}>
                    Ver vista previa
                  </Button>
                )}
                {doc.can_download && onDownload && (
                  <Button size="small" variant="ghost" onClick={() => onDownload(doc)}>
                    Descargar PDF
                  </Button>
                )}
                {/*
                  El contrato no publica una capacidad para el original anulado.
                  La condición observable es que el documento esté anulado; el
                  permiso sensible lo aporta quien pasa el callback y la
                  autorización final la conserva el backend.
                */}
                {doc.status === 'CANCELLED' && onDownloadOriginal && (
                  <Button
                    size="small"
                    variant="ghost"
                    onClick={() => onDownloadOriginal(doc)}
                  >
                    Descargar original cancelado
                  </Button>
                )}
                {doc.can_reprint && onReprint && (
                  <Button size="small" variant="ghost" onClick={() => onReprint(doc)}>
                    Reimprimir
                  </Button>
                )}
                {doc.can_cancel && doc.status !== 'CANCELLED' && onCancel && (
                  <Button size="small" variant="ghost" onClick={() => onCancel(doc)}>
                    Anular
                  </Button>
                )}
              </div>

              {/* Atributos del documento */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Metadatos principales
                </h3>
                <dl className="detail-list detail-list--compact">
                  <div>
                    <dt>Título</dt>
                    <dd>{doc.title}</dd>
                  </div>
                  <div>
                    <dt>Tipo</dt>
                    <dd>{doc.document_type_name}</dd>
                  </div>
                  <div>
                    <dt>Familia</dt>
                    <dd>{doc.family}</dd>
                  </div>
                  <div>
                    <dt>Estado</dt>
                    <dd>
                      <StatusBadge value={doc.status.toLowerCase()}>{doc.status}</StatusBadge>
                    </dd>
                  </div>
                  <div>
                    <dt>Ciclo de vida</dt>
                    <dd>{doc.lifecycle_status}</dd>
                  </div>
                  <div>
                    <dt>Sede</dt>
                    <dd>{doc.branch_summary.name}</dd>
                  </div>
                  <div>
                    <dt>Almacén</dt>
                    <dd>{doc.warehouse_summary?.name ?? 'No aplica'}</dd>
                  </div>
                  <div>
                    <dt>Emisor</dt>
                    <dd>{doc.issued_by_summary ? doc.issued_by_summary.id : 'Sistema'}</dd>
                  </div>
                  <div>
                    <dt>Fecha de emisión</dt>
                    <dd>{doc.issued_at ? formatDateTime(doc.issued_at) : 'Sin emitir'}</dd>
                  </div>
                  <div>
                    <dt>Reimpresiones</dt>
                    <dd>{doc.reprint_count}</dd>
                  </div>
                  <div>
                    <dt>Sensibilidad</dt>
                    <dd>{doc.sensitivity}</dd>
                  </div>
                  <div>
                    <dt>Origen</dt>
                    <dd>
                      {doc.source_reference.resource_type}
                      {doc.source_reference.resource_id
                        ? ` · ${doc.source_reference.resource_id}`
                        : ''}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Línea temporal de eventos */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Historial de auditoría
                </h3>
                {historyError && (
                  <p className="text-xs font-semibold text-rose-600">
                    No se pudo cargar el historial: {historyError}
                  </p>
                )}
                {!historyError && history.length === 0 && (
                  <p className="text-xs text-slate-500">Sin eventos registrados.</p>
                )}
                <ul className="timeline">
                  {history.map((entry, index) => (
                    <li key={`${entry.event_type}-${entry.timestamp}-${index}`}>
                      <span className="timeline__dot" />
                      <div>
                        <div className="timeline__title">
                          <strong className="text-xs font-bold text-slate-900">
                            {historyLabel(entry)}
                          </strong>
                          <time>{formatDateTime(entry.timestamp)}</time>
                        </div>
                        {entry.actor_name && (
                          <small className="text-[10px] text-slate-400">
                            Por: {entry.actor_name}
                          </small>
                        )}
                        {entry.reason && (
                          <p className="mt-1 rounded bg-slate-50 p-2 text-[11px] font-medium text-slate-700 italic border border-slate-200">
                            «{entry.reason}»
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
