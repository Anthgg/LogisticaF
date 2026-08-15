import { useState } from 'react'
import { ResourceDialog } from './ResourceDialog'
import { TextareaField } from './FormControls'
import type { DocumentSummary } from '../../types/logistics-documents'

interface ReprintDocumentDialogProps {
  isOpen: boolean
  document: DocumentSummary | null
  isSubmitting?: boolean
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
}

export function ReprintDocumentDialog({
  isOpen,
  document,
  isSubmitting,
  onClose,
  onSubmit,
}: ReprintDocumentDialogProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!document) return null

  // El backend publica `document_code` y admite null mientras el documento no
  // se emite. La confirmación por código sigue siendo una guarda local.
  const documentCode = document.document_code ?? 'Sin código'

  const handleConfirm = async () => {
    if (reason.trim().length < 5) {
      setError('Debes especificar un motivo válido de al menos 5 caracteres.')
      return
    }
    setError(null)
    await onSubmit(reason.trim())
    setReason('')
  }

  return (
    <ResourceDialog
      isOpen={isOpen}
      title={`Solicitar reimpresión — ${documentCode}`}
      submitLabel="Reimprimir documento"
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={() => void handleConfirm()}
    >
      <div className="space-y-4 text-xs">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <p className="font-bold">Aviso de seguridad y auditoría:</p>
          <p className="mt-1 leading-relaxed">
            La reimpresión conservará el mismo código oficial (<code className="font-mono">{documentCode}</code>), pero
            incrementará el contador de copias. El PDF resultante incluirá la marca de agua permanente de reimpresión.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Documento</span>
            <p className="font-semibold text-slate-900">{document.title}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Copias emitidas previamente</span>
            <p className="font-semibold text-slate-900">{document.reprint_count}</p>
          </div>
        </div>

        <TextareaField
          label="Motivo justificado de reimpresión (Obligatorio)"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            if (error) setError(null)
          }}
          placeholder="Ej: Copia requerida por inspección en ruta o deterioro del impreso original."
          rows={3}
          required
        />
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
      </div>
    </ResourceDialog>
  )
}
