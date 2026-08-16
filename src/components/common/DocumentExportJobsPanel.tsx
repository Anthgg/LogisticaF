import { StatusBadge } from './StatusBadge'
import type { DocumentExportJob } from '../../types/logistics-documents'
import { formatDateTime } from '../../utils/date'

interface DocumentExportJobsPanelProps {
  isOpen: boolean
  /** El trabajo tal como lo devolvió la creación de la exportación. */
  job: DocumentExportJob | null
  onClose: () => void
}

/**
 * Muestra el trabajo de exportación que devolvió `POST /documents/export`.
 *
 * No hay sondeo ni descarga: el backend responde con `polling_url` y
 * `download_url` apuntando a `/document-exports/{id}`, un recurso que el
 * contrato de esta versión no publica. Se dice tal cual en vez de simular un
 * progreso o un enlace que no existe.
 */
export function DocumentExportJobsPanel({
  isOpen,
  job,
  onClose,
}: DocumentExportJobsPanelProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">
              Exportaciones en segundo plano
            </p>
            <h2 className="text-base font-bold text-slate-900">Estado del paquete documental</h2>
          </div>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-700"
            onClick={onClose}
            aria-label="Cerrar panel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {!job && (
          <p className="text-xs text-slate-500">
            Todavía no se ha solicitado ninguna exportación en esta sesión.
          </p>
        )}

        {job && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Identificador de tarea</span>
                <p className="font-mono font-bold text-slate-900">{job.job_id}</p>
              </div>
              <StatusBadge value={job.status.toLowerCase()}>{job.status}</StatusBadge>
            </div>

            <dl className="detail-list detail-list--compact">
              <div>
                <dt>Documentos incluidos</dt>
                <dd>{job.total_items}</dd>
              </div>
              <div>
                <dt>Procesados</dt>
                <dd>{job.processed_items}</dd>
              </div>
              <div>
                <dt>Fallidos</dt>
                <dd>{job.failed_items}</dd>
              </div>
              <div>
                <dt>Vencimiento de la descarga</dt>
                <dd>{formatDateTime(job.expires_at)}</dd>
              </div>
            </dl>

            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-medium text-amber-800">
              El seguimiento y la descarga del paquete no están disponibles en
              esta versión del contrato: el backend los publica en{' '}
              <code className="font-mono">{job.polling_url}</code>, una ruta que
              todavía no expone. Anota el identificador para reclamarlo cuando
              se publique.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
