import { useState } from 'react'
import { purchaseRequisitionsApi } from '../../api/purchase-requisitions-api'
import { Button } from '../common/Button'
import { SecurePdfViewer } from '../common/SecurePdfViewer'
import type { PurchaseRequisitionComment } from '../../types/purchase-requisitions'
import { pdfApi } from '../../api/pdf/pdf-endpoints'
import {
  createPdfObjectUrl,
  downloadPdfFile,
  getPdfErrorMessage,
} from '../../api/pdf/pdf-client'

interface CommentsProps {
  requisitionId: string
  comments: PurchaseRequisitionComment[]
  onCommentAdded?: () => void
  canComment?: boolean
}

export function PurchaseRequisitionCommentsPanel({
  requisitionId,
  comments,
  onCommentAdded,
  canComment = true,
}: CommentsProps) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitting) return
    setSubmitting(true)
    try {
      await purchaseRequisitionsApi.addComment(requisitionId, content.trim())
      setContent('')
      if (onCommentAdded) onCommentAdded()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al añadir comentario')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 text-xs">
      <h4 className="font-bold uppercase tracking-wider text-slate-500 text-xs">
        Hilo de Comentarios y Observaciones ({comments.length})
      </h4>

      {canComment && (
        <form onSubmit={handleAdd} className="space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            required
            placeholder="Escribe un comentario u observación sobre la solicitud..."
            className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs"
          />
          <div className="flex justify-end">
            <Button size="small" type="submit" isLoading={submitting} loadingLabel="Publicando...">
              Publicar Comentario
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2 pt-2">
        {comments.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-800">{c.user_name}</span>
              <span className="text-slate-400 font-mono">{new Date(c.created_at).toLocaleString('es-PE')}</span>
            </div>
            <p className="text-slate-700">{c.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

interface DocumentProps {
  requisitionId: string
  requisitionCode: string
  activeRevisionNumber: number
  canPreview?: boolean
  canDownload?: boolean
}

export function PurchaseRequisitionDocumentPanel({
  requisitionId,
  requisitionCode,
  activeRevisionNumber,
  canPreview = false,
  canDownload = false,
}: DocumentProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const handleDownload = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    setPdfError(null)
    try {
      downloadPdfFile(await pdfApi.requisition.download(requisitionId))
    } catch (error: unknown) {
      setPdfError(getPdfErrorMessage(error))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">
            Documento de Solicitud de Compra (REQ)
          </span>
          <h3 className="text-sm font-bold text-slate-800">
            {requisitionCode} — Revisión v{activeRevisionNumber}
          </h3>
        </div>

        <div className="flex gap-2">
          {canPreview && (
            <Button size="small" variant="secondary" onClick={() => setIsPreviewOpen(true)}>
              Vista Previa (NO OFICIAL)
            </Button>
          )}
          {canDownload && (
            <Button
              size="small"
              isLoading={isDownloading}
              loadingLabel="Descargando…"
              onClick={() => void handleDownload()}
            >
              Descargar Documento
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2 text-slate-600">
        <p>
          El documento REQ es emitido por el backend con marca de agua inmutable. No asigna nuevos correlativos al previsualizar.
        </p>
      </div>

      {pdfError && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800">
          {pdfError}
        </p>
      )}

      <SecurePdfViewer
        isOpen={isPreviewOpen}
        title={`Vista previa REQ — ${requisitionCode}`}
        code={requisitionCode}
        fetchBlobUrl={async () => {
          try {
            return createPdfObjectUrl(
              await pdfApi.requisition.preview(requisitionId),
            )
          } catch (error: unknown) {
            const message = getPdfErrorMessage(error)
            setPdfError(message)
            throw new Error(message)
          }
        }}
        onDownload={canDownload ? () => void handleDownload() : undefined}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  )
}
