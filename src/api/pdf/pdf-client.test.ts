import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCsrfToken } from '../csrf'
import { API_ROOT } from '../config'
import {
  createPdfObjectUrl,
  downloadPdfFile,
  filenameFromContentDisposition,
  getPdfErrorMessage,
  requestPdf,
  sanitizePdfFilename,
  type PdfFile,
} from './pdf-client'

type FetchMock = ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>

function pdfResponse(
  contentDisposition = 'inline; filename="documento.pdf"',
): Response {
  return new Response('%PDF-1.7\nbody', {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDisposition,
    },
  })
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function createFetchMock(): FetchMock {
  const fetchMock = vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >()
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('cliente PDF seguro', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    clearCsrfToken()
  })

  it('usa credentials include y Accept application/pdf', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(pdfResponse())

    await requestPdf({ path: '/logistics/documents/doc-1/preview' })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    const headers = new Headers(init?.headers)
    expect(url).toBe(`${API_ROOT}/logistics/documents/doc-1/preview`)
    expect(init?.credentials).toBe('include')
    expect(headers.get('Accept')).toBe('application/pdf')
  })

  it('envía CSRF y JSON en POST', async () => {
    const fetchMock = createFetchMock()
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ csrf_token: 'csrf-pdf' }))
      .mockResolvedValueOnce(pdfResponse())

    await requestPdf({
      path: '/logistics/company-profile/document-preview',
      method: 'POST',
      body: { doc_type_code: 'CIT' },
    })

    const [, init] = fetchMock.mock.calls[1] ?? []
    const headers = new Headers(init?.headers)
    expect(headers.get('X-CSRF-Token')).toBe('csrf-pdf')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(init?.body).toBe(JSON.stringify({ doc_type_code: 'CIT' }))
  })

  it('propaga el comprobante Step-Up solo por cabecera', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(pdfResponse())

    await requestPdf({
      path: '/logistics/documents/doc-1/pdf',
      stepUpProofId: 'proof-123',
    })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).not.toContain('proof-123')
    expect(new Headers(init?.headers).get('X-Step-Up-Proof-ID')).toBe(
      'proof-123',
    )
  })

  it('prioriza filename* UTF-8 sobre filename ASCII', () => {
    expect(
      filenameFromContentDisposition(
        "attachment; filename=orden.pdf; filename*=UTF-8''orden%20N%C2%B0%201.pdf",
      ),
    ).toBe('orden N° 1.pdf')
  })

  it.each([
    ['inline; filename="vista previa.pdf"', 'vista previa.pdf'],
    ['attachment; filename="guía-remisión.pdf"', 'guía-remisión.pdf'],
  ])('acepta disposición %s con espacios y acentos', (header, expected) => {
    expect(filenameFromContentDisposition(header)).toBe(expected)
  })

  it('ignora filename* inválido y usa filename normal', () => {
    expect(
      filenameFromContentDisposition(
        "attachment; filename=seguro.pdf; filename*=UTF-8''%E0%A4%A",
      ),
    ).toBe('seguro.pdf')
  })

  it('usa fallback seguro ante un header inválido', () => {
    expect(
      filenameFromContentDisposition(
        'attachment; filename*=ISO-8859-1\'\'caf%E9.pdf',
        'reporte final',
      ),
    ).toBe('reporte final.pdf')
  })

  it('interpreta filename entre comillas y escapes', () => {
    expect(
      filenameFromContentDisposition(
        'attachment; filename="orden \\"especial\\".pdf"',
      ),
    ).toBe('orden _especial_.pdf')
  })

  it('conserva punto y coma dentro de un filename quoted', () => {
    expect(
      filenameFromContentDisposition(
        'attachment; filename="guía; lote 4.pdf"',
      ),
    ).toBe('guía; lote 4.pdf')
  })

  it('usa fallback cuando Content-Disposition no trae filename', () => {
    expect(
      filenameFromContentDisposition('inline', 'vista-previa'),
    ).toBe('vista-previa.pdf')
  })

  it('sanitiza traversal, CRLF y caracteres reservados', () => {
    expect(
      sanitizePdfFilename('../carpeta\\reporte\r\nmal:<1>.pdf'),
    ).toBe('reportemal__1_.pdf')
  })

  it('conserva un nombre contextual como fallback', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      new Response('%PDF-1.7', {
        headers: { 'Content-Type': 'application/pdf' },
      }),
    )

    const pdf = await requestPdf({
      path: '/logistics/documents/doc-1/preview',
      fallbackFilename: 'DOC-001-preview.pdf',
    })

    expect(pdf.filename).toBe('DOC-001-preview.pdf')
    expect(pdf.size).toBeGreaterThan(0)
    expect(pdf.response).toBeInstanceOf(Response)
  })

  it('rechaza una respuesta que no sea application/pdf', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      new Response('<html>error</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    )

    await expect(
      requestPdf({ path: '/logistics/documents/doc-1/preview' }),
    ).rejects.toMatchObject({ code: 'INVALID_PDF_CONTENT_TYPE' })
  })

  it('rechaza un Blob PDF vacío', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      new Response('', {
        headers: { 'Content-Type': 'application/pdf' },
      }),
    )

    await expect(
      requestPdf({ path: '/logistics/documents/doc-1/preview' }),
    ).rejects.toMatchObject({ code: 'EMPTY_PDF' })
  })

  it('rechaza contenido sin firma %PDF-', async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      new Response('NOT-A-PDF', {
        headers: { 'Content-Type': 'application/pdf' },
      }),
    )

    await expect(
      requestPdf({ path: '/logistics/documents/doc-1/preview' }),
    ).rejects.toMatchObject({ code: 'INVALID_PDF_SIGNATURE' })
  })

  it.each([
    [401, 'Tu sesión no está autenticada o expiró. Inicia sesión nuevamente.'],
    [403, 'No tienes permiso para acceder a este documento PDF.'],
    [404, 'El documento PDF no está disponible.'],
    [500, 'No fue posible generar el PDF por un error del servidor.'],
  ] as const)('diferencia errores HTTP %s', async (status, expectedMessage) => {
    const fetchMock = createFetchMock()
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: `backend-${status}` }, status),
    )

    const error = await requestPdf({
      path: '/logistics/documents/doc-1/preview',
      skipAuthRefresh: true,
    }).catch((caught: unknown) => caught)

    expect(getPdfErrorMessage(error)).toBe(expectedMessage)
  })

  it('crea un object URL reutilizable por el visor', () => {
    const createObjectUrl = vi.fn(() => 'blob:preview')
    vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectUrl })
    const pdf = { blob: new Blob(['%PDF-1.7']) } as PdfFile

    expect(createPdfObjectUrl(pdf)).toBe('blob:preview')
    expect(createObjectUrl).toHaveBeenCalledWith(pdf.blob)
  })

  it('descarga con el nombre del servidor y revoca el object URL', () => {
    const createObjectUrl = vi.fn(() => 'blob:download')
    const revokeObjectUrl = vi.fn()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    })
    const click = vi.fn()
    const anchor = document.createElement('a')
    anchor.click = click
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    const pdf = {
      blob: new Blob(['%PDF-1.7']),
      size: 8,
      filename: 'orden N° 1.pdf',
      contentType: 'application/pdf',
      contentDisposition: null,
      response: new Response(),
    }

    downloadPdfFile(pdf)

    expect(click).toHaveBeenCalledOnce()
    expect(anchor.download).toBe('orden N° 1.pdf')
    expect(document.body.contains(anchor)).toBe(false)
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:download')
  })
})
