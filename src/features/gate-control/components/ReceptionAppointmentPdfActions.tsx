import { useState } from 'react'
import { pdfApi } from '../../../api/pdf/pdf-endpoints'
import {
  createPdfObjectUrl,
  downloadPdfFile,
  getPdfErrorMessage,
} from '../../../api/pdf/pdf-client'
import { SecurePdfViewer } from '../../../components/common/SecurePdfViewer'
import { useLogisticsAccess } from '../../logistics-me/hooks/useLogisticsAccess'
import { LOGISTICS_PERMISSIONS } from '../../logistics-permissions/logistics-permissions-map'
import { useSensitiveActionGuard } from '../../logistics-permissions/hooks/useSensitiveActionGuard'

interface ReceptionAppointmentPdfActionsProps {
  appointmentId: string
  citCode: string
}

export function ReceptionAppointmentPdfActions({
  appointmentId,
  citCode,
}: ReceptionAppointmentPdfActionsProps) {
  const access = useLogisticsAccess()
  const canPreview = access.hasPermission(
    LOGISTICS_PERMISSIONS.receptionAppointments.preview,
  )
  const canDownload = access.hasPermission(
    LOGISTICS_PERMISSIONS.receptionAppointments.download,
  )
  const downloadGuard = useSensitiveActionGuard({
    permission: LOGISTICS_PERMISSIONS.receptionAppointments.download,
  })
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    setError(null)
    try {
      await downloadGuard.run(async () => {
        downloadPdfFile(
          await pdfApi.receptionAppointment.download(appointmentId),
        )
      })
    } catch (caught: unknown) {
      setError(getPdfErrorMessage(caught))
    } finally {
      setIsDownloading(false)
    }
  }

  if (!canPreview && !canDownload) return null

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap gap-2">
        {canPreview && (
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Vista previa CIT
          </button>
        )}
        {canDownload && (
          <button
            type="button"
            disabled={isDownloading || downloadGuard.isBlocked}
            onClick={() => void handleDownload()}
            className="rounded-lg bg-[#1F4E6D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#173a55] disabled:opacity-50"
          >
            {isDownloading ? 'Descargando…' : 'Descargar CIT'}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">{error}</p>}

      <SecurePdfViewer
        isOpen={isPreviewOpen}
        title={`Vista previa CIT — ${citCode}`}
        code={citCode}
        fetchBlobUrl={async () => {
          try {
            return createPdfObjectUrl(
              await pdfApi.receptionAppointment.preview(appointmentId),
            )
          } catch (caught: unknown) {
            const message = getPdfErrorMessage(caught)
            setError(message)
            throw new Error(message)
          }
        }}
        onDownload={canDownload ? () => void handleDownload() : undefined}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  )
}
