import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError } from '../../types/api'
import { PDF_CONTRACT_ENDPOINTS, pdfApi } from './pdf-endpoints'
import { requestPdf } from './pdf-client'

vi.mock('./pdf-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./pdf-client')>()
  return { ...actual, requestPdf: vi.fn() }
})

const requestPdfMock = vi.mocked(requestPdf)

describe('catálogo contractual PDF', () => {
  beforeEach(() => {
    requestPdfMock.mockReset()
    requestPdfMock.mockResolvedValue({
      blob: new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
      size: 8,
      filename: 'test.pdf',
      contentType: 'application/pdf',
      contentDisposition: null,
      response: new Response(),
    })
  })

  it('declara exactamente 14 previews y 19 downloads', () => {
    expect(
      PDF_CONTRACT_ENDPOINTS.filter(({ intent }) => intent === 'preview'),
    ).toHaveLength(14)
    expect(
      PDF_CONTRACT_ENDPOINTS.filter(({ intent }) => intent === 'download'),
    ).toHaveLength(19)
    expect(PDF_CONTRACT_ENDPOINTS).toHaveLength(33)
  })

  it('no duplica pares method/path', () => {
    const signatures = PDF_CONTRACT_ENDPOINTS.map(
      ({ method, path }) => `${method} ${path}`,
    )
    expect(new Set(signatures).size).toBe(signatures.length)
  })

  it('separa preview y download institucional en requests distintos', async () => {
    const payload = { doc_type_code: 'CIT', custom_data: { locale: 'es' } }

    await pdfApi.companyProfile.preview(payload)
    await pdfApi.companyProfile.download(payload)

    expect(requestPdfMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: '/logistics/company-profile/document-preview',
        method: 'POST',
      }),
    )
    expect(requestPdfMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: '/logistics/company-profile/document-preview.pdf',
        method: 'POST',
      }),
    )
  })

  it('usa los dos endpoints reales de requisiciones', async () => {
    await pdfApi.requisition.preview('req-1')
    await pdfApi.requisition.download('req-1')

    expect(requestPdfMock.mock.calls.map(([options]) => options.path)).toEqual([
      '/logistics/procurement/requisitions/req-1/document/preview',
      '/logistics/procurement/requisitions/req-1/document/preview.pdf',
    ])
  })

  it('preserva paper_size en etiqueta individual y masiva', async () => {
    await pdfApi.warehouseLabels.downloadOne('loc-1', 'A4')
    await pdfApi.warehouseLabels.downloadBatch(['loc-1', 'loc-2'], 'A5')

    expect(requestPdfMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: '/logistics/warehouses/locations/loc-1/label.pdf?paper_size=A4',
        method: 'GET',
      }),
    )
    expect(requestPdfMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: '/logistics/warehouses/locations/labels/export?paper_size=A5',
        method: 'POST',
        body: ['loc-1', 'loc-2'],
      }),
    )
  })

  it('no emite request si el lote de etiquetas está vacío', async () => {
    await expect(
      pdfApi.warehouseLabels.downloadBatch([]),
    ).rejects.toBeInstanceOf(ApiRequestError)
    expect(requestPdfMock).not.toHaveBeenCalled()
  })

  it('envía original explícito al download del documento', async () => {
    await pdfApi.documents.download('doc-1', true, {
      stepUpProofId: 'proof-sensitive',
    })

    expect(requestPdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/logistics/documents/doc-1/pdf?original=true',
        method: 'GET',
        stepUpProofId: 'proof-sensitive',
      }),
    )
  })

  it('no inventa preview PDF para el acta CPV', async () => {
    await pdfApi.gateControl.downloadCpv('gate-1')

    expect(requestPdfMock).toHaveBeenCalledOnce()
    expect(requestPdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/logistics/gate-check-ins/gate-1/document/pdf',
        method: 'GET',
      }),
    )
  })

  it('distingue preview/download de paquetes outbound y transporte', async () => {
    await pdfApi.outbound.previewPackage({ operation_id: 'op-1' })
    await pdfApi.outbound.downloadPackage({ operation_id: 'op-1' })
    await pdfApi.transport.previewPackage({ operation_id: 'op-2' })
    await pdfApi.transport.downloadPackage({ operation_id: 'op-2' })

    expect(requestPdfMock.mock.calls.map(([options]) => options.path)).toEqual([
      '/logistics/outbound/document-package/preview',
      '/logistics/outbound/document-package/pdf',
      '/logistics/transport/document-package/preview',
      '/logistics/transport/document-package/pdf',
    ])
  })

  it('conserva blind_count_mode en el PDF de inventario', async () => {
    await pdfApi.inventory.download('COUNT_SHEET', { session_id: 's-1' }, true)

    expect(requestPdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/logistics/inventory/documents/COUNT_SHEET/pdf?blind_count_mode=true',
        method: 'POST',
      }),
    )
  })
})
