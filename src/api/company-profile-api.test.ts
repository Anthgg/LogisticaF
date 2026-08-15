import { beforeEach, describe, expect, it, vi } from 'vitest'
import { companyProfileApi } from './company-profile-api'
import { pdfApi } from './pdf/pdf-endpoints'
import {
  createPdfObjectUrl,
  downloadPdfFile,
} from './pdf/pdf-client'

vi.mock('./pdf/pdf-endpoints', () => ({
  pdfApi: {
    companyProfile: {
      preview: vi.fn(),
      download: vi.fn(),
    },
  },
}))

vi.mock('./pdf/pdf-client', () => ({
  createPdfObjectUrl: vi.fn(() => 'blob:institutional-preview'),
  downloadPdfFile: vi.fn(),
}))

const previewRequest = {
  doc_type_code: 'AREC',
  branch_id: null,
  signer_id: null,
  custom_data: {},
}
const pdf = {
  blob: new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
  size: 8,
  filename: 'acta-recepcion.pdf',
  contentType: 'application/pdf',
  contentDisposition: 'inline; filename="acta-recepcion.pdf"',
  response: new Response(),
}

describe('companyProfileApi - Vista Previa Institucional', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(pdfApi.companyProfile.preview).mockResolvedValue(pdf)
    vi.mocked(pdfApi.companyProfile.download).mockResolvedValue(pdf)
  })

  it('delega el preview al cliente PDF centralizado', async () => {
    await expect(
      companyProfileApi.getPreviewDocumentBlob(previewRequest),
    ).resolves.toBe(pdf.blob)
    expect(pdfApi.companyProfile.preview).toHaveBeenCalledWith(previewRequest)
  })

  it('crea el object URL únicamente después de recibir el PDF válido', async () => {
    await expect(
      companyProfileApi.getPreviewDocumentBlobUrl(previewRequest),
    ).resolves.toBe('blob:institutional-preview')
    expect(createPdfObjectUrl).toHaveBeenCalledWith(pdf)
  })

  it('usa el contrato download separado y el filename del servidor', async () => {
    await companyProfileApi.downloadPreviewDocument(previewRequest)

    expect(pdfApi.companyProfile.download).toHaveBeenCalledWith(previewRequest)
    expect(downloadPdfFile).toHaveBeenCalledWith(pdf)
  })

  it('propaga errores del cliente PDF sin convertirlos en vacíos falsos', async () => {
    vi.mocked(pdfApi.companyProfile.preview).mockRejectedValue(
      new Error('Sin permiso'),
    )

    await expect(
      companyProfileApi.getPreviewDocumentBlob(previewRequest),
    ).rejects.toThrow('Sin permiso')
  })
})
