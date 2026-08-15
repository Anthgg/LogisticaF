import { beforeEach, describe, expect, it, vi } from 'vitest'
import { documentsApi } from './documents-api'
import { apiRequest } from './api-client'
import { isContractGap } from './contract-availability'
import type { DocumentHistoryResponse } from '../types/logistics-documents'

vi.mock('./api-client', () => ({
  apiRequest: vi.fn(),
  getCsrfToken: vi.fn(async () => 'csrf-token'),
}))

vi.mock('./pdf/pdf-endpoints', () => ({
  pdfApi: { documents: { preview: vi.fn(), download: vi.fn() }, documentSeries: { downloadTalonario: vi.fn() } },
}))

vi.mock('./pdf/pdf-client', () => ({
  createPdfObjectUrl: vi.fn(() => 'blob:preview'),
  downloadPdfFile: vi.fn(),
}))

const historyResponse: DocumentHistoryResponse = {
  document_id: '2f2f0f5c-6b1a-4a9f-9b0a-2a5c8b7d1e01',
  history: [
    {
      event_type: 'ISSUED',
      timestamp: '2026-08-01T12:00:00Z',
      actor_user_id: '0f02a6e1-b9ca-4e4a-b85d-5fd469943a78',
      actor_name: 'Usuario de Prueba',
      reason: null,
      copy_number: null,
      details: {},
    },
  ],
}

describe('documentsApi contra el contrato real', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lee el historial de la clave history del sobre real', async () => {
    vi.mocked(apiRequest).mockResolvedValue(historyResponse)

    const history = await documentsApi.getHistory('2f2f0f5c-6b1a-4a9f-9b0a-2a5c8b7d1e01')

    expect(history).toHaveLength(1)
    expect(history[0]?.event_type).toBe('ISSUED')
    expect(history[0]?.timestamp).toBe('2026-08-01T12:00:00Z')
  })

  it('propaga el fallo del historial en vez de devolver una lista vacía', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('502'))

    await expect(
      documentsApi.getHistory('2f2f0f5c-6b1a-4a9f-9b0a-2a5c8b7d1e01'),
    ).rejects.toThrow('502')
  })

  it('envía solo el motivo al anular, sin el código de confirmación local', async () => {
    vi.mocked(apiRequest).mockResolvedValue(undefined)

    await documentsApi.cancel('2f2f0f5c-6b1a-4a9f-9b0a-2a5c8b7d1e01', {
      reason: 'Documento emitido por error',
    })

    const options = vi.mocked(apiRequest).mock.calls[0]?.[0]
    expect(options?.body).toEqual({ reason: 'Documento emitido por error' })
    expect(options?.body).not.toHaveProperty('confirm_code')
  })

  it('omite los filtros vacíos y usa los nombres publicados', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 })

    await documentsApi.list({
      page: 2,
      page_size: 20,
      search: '',
      document_type_code: 'REQ',
      status: undefined,
    })

    const path = vi.mocked(apiRequest).mock.calls[0]?.[0]?.path ?? ''
    expect(path).toContain('document_type_code=REQ')
    expect(path).toContain('page=2')
    expect(path).not.toContain('search=')
    expect(path).not.toContain('status=')
    expect(path).not.toContain('document_type=')
  })

  it('acepta los formatos de exportación que publica el backend', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      job_id: '7c6b5a49-3827-4160-9f8e-7d6c5b4a3928',
      status: 'QUEUED',
      total_items: 1,
      processed_items: 0,
      failed_items: 0,
      expires_at: '2026-08-02T12:00:00Z',
      polling_url: '/api/logistics/document-exports/7c6b5a49-3827-4160-9f8e-7d6c5b4a3928',
      download_url: null,
    })

    const job = await documentsApi.createExport({
      document_ids: ['2f2f0f5c-6b1a-4a9f-9b0a-2a5c8b7d1e01'],
      export_format: 'MERGED_PDF',
      include_manifest: true,
      include_checksums: true,
    })

    expect(vi.mocked(apiRequest).mock.calls[0]?.[0]?.body).toMatchObject({
      export_format: 'MERGED_PDF',
    })
    expect(job.job_id).toBe('7c6b5a49-3827-4160-9f8e-7d6c5b4a3928')
  })

  it('no simula el seguimiento ni la descarga de una exportación', async () => {
    await expect(documentsApi.getExportJob('cualquiera')).rejects.toSatisfy(isContractGap)
    await expect(documentsApi.downloadExportZip('cualquiera')).rejects.toSatisfy(isContractGap)
    expect(apiRequest).not.toHaveBeenCalled()
  })
})
