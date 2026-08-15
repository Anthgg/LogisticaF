import {
  apiResponseRequest,
  type ApiRequestOptions,
} from '../api-client'
import { ApiRequestError } from '../../types/api'

const PDF_CONTENT_TYPE = 'application/pdf'
const DEFAULT_FILENAME = 'documento.pdf'
const MAX_FILENAME_LENGTH = 180

function withoutControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint > 31 && codePoint !== 127
    })
    .join('')
}

export interface PdfFile {
  blob: Blob
  size: number
  filename: string
  contentType: string
  contentDisposition: string | null
  response: Response
}

export interface PdfRequestOptions extends ApiRequestOptions {
  fallbackFilename?: string
  stepUpProofId?: string
}

function stripContentDispositionQuotes(value: string): string {
  const trimmed = value.trim()
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed
  return trimmed.slice(1, -1).replace(/\\(["\\])/g, '$1')
}

function decodeExtendedFilename(value: string): string | null {
  const match = stripContentDispositionQuotes(value).match(
    /^([^']*)'[^']*'(.*)$/,
  )
  if (!match) return null

  const charset = match[1]?.trim().toLowerCase()
  if (charset && charset !== 'utf-8' && charset !== 'utf8') return null

  try {
    return decodeURIComponent(match[2] ?? '')
  } catch {
    return null
  }
}

function splitContentDispositionParts(value: string): string[] {
  const parts: string[] = []
  let current = ''
  let insideQuotes = false
  let escaped = false

  for (const character of value) {
    if (escaped) {
      current += character
      escaped = false
      continue
    }
    if (character === '\\' && insideQuotes) {
      current += character
      escaped = true
      continue
    }
    if (character === '"') {
      insideQuotes = !insideQuotes
      current += character
      continue
    }
    if (character === ';' && !insideQuotes) {
      parts.push(current)
      current = ''
      continue
    }
    current += character
  }

  parts.push(current)
  return parts
}

export function sanitizePdfFilename(
  value: string | null | undefined,
  fallback = DEFAULT_FILENAME,
): string {
  const fallbackBase = fallback || DEFAULT_FILENAME
  const lastSegment = (value || fallbackBase)
    .normalize('NFKC')
    .replace(/\\/g, '/')
    .split('/')
    .pop() ?? ''

  let filename = withoutControlCharacters(lastSegment)
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\.{2,}/g, '.')
    .trim()
    .replace(/^[. ]+|[. ]+$/g, '')

  if (!filename) {
    filename = fallbackBase === value
      ? DEFAULT_FILENAME
      : sanitizePdfFilename(fallbackBase, DEFAULT_FILENAME)
  }

  if (!/\.pdf$/i.test(filename)) filename = `${filename}.pdf`

  if (filename.length > MAX_FILENAME_LENGTH) {
    filename = `${filename.slice(0, MAX_FILENAME_LENGTH - 4).trim()}.pdf`
  }

  return filename || DEFAULT_FILENAME
}

export function filenameFromContentDisposition(
  contentDisposition: string | null,
  fallbackFilename = DEFAULT_FILENAME,
): string {
  if (!contentDisposition) {
    return sanitizePdfFilename(fallbackFilename)
  }

  const parts = splitContentDispositionParts(contentDisposition).slice(1)
  let regularFilename: string | null = null

  for (const part of parts) {
    const separatorIndex = part.indexOf('=')
    if (separatorIndex < 0) continue

    const key = part.slice(0, separatorIndex).trim().toLowerCase()
    const rawValue = part.slice(separatorIndex + 1).trim()
    if (key === 'filename*') {
      const decoded = decodeExtendedFilename(rawValue)
      if (decoded) return sanitizePdfFilename(decoded, fallbackFilename)
    }
    if (key === 'filename' && regularFilename === null) {
      regularFilename = stripContentDispositionQuotes(rawValue)
    }
  }

  return sanitizePdfFilename(regularFilename, fallbackFilename)
}

async function parsePdfResponse(
  response: Response,
  fallbackFilename: string,
): Promise<PdfFile> {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.split(';', 1)[0]?.trim().toLowerCase() !== PDF_CONTENT_TYPE) {
    throw new ApiRequestError(
      'El servidor no devolvió un documento PDF válido.',
      {
        code: 'INVALID_PDF_CONTENT_TYPE',
        status: response.status,
        details: { contentType },
      },
    )
  }

  const blob = await response.blob()
  if (blob.size === 0) {
    throw new ApiRequestError('El documento PDF recibido está vacío.', {
      code: 'EMPTY_PDF',
      status: response.status,
    })
  }

  const signatureBytes = new Uint8Array(
    await blob.slice(0, 5).arrayBuffer(),
  )
  const signature = String.fromCharCode(...signatureBytes)
  if (signature !== '%PDF-') {
    throw new ApiRequestError(
      'El archivo recibido no contiene una firma PDF válida.',
      {
        code: 'INVALID_PDF_SIGNATURE',
        status: response.status,
      },
    )
  }

  const contentDisposition = response.headers.get('content-disposition')
  return {
    blob,
    size: blob.size,
    filename: filenameFromContentDisposition(
      contentDisposition,
      fallbackFilename,
    ),
    contentType,
    contentDisposition,
    response,
  }
}

export function requestPdf(options: PdfRequestOptions): Promise<PdfFile> {
  const {
    fallbackFilename = DEFAULT_FILENAME,
    stepUpProofId,
    headers: suppliedHeaders,
    ...requestOptions
  } = options
  const headers = new Headers(suppliedHeaders)
  if (stepUpProofId) headers.set('X-Step-Up-Proof-ID', stepUpProofId)

  return apiResponseRequest(
    { ...requestOptions, headers },
    (response) => parsePdfResponse(response, fallbackFilename),
    PDF_CONTENT_TYPE,
  )
}

export function createPdfObjectUrl(pdf: PdfFile): string {
  return URL.createObjectURL(pdf.blob)
}

export function downloadPdfFile(pdf: PdfFile): void {
  const objectUrl = createPdfObjectUrl(pdf)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = pdf.filename
  anchor.hidden = true

  try {
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  }
}

export function getPdfErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return 'Tu sesión no está autenticada o expiró. Inicia sesión nuevamente.'
    }
    if (error.status === 403) {
      return 'No tienes permiso para acceder a este documento PDF.'
    }
    if (error.status === 404) {
      return 'El documento PDF no está disponible.'
    }
    if (error.status !== null && error.status >= 500) {
      return 'No fue posible generar el PDF por un error del servidor.'
    }
    return error.message
  }

  return error instanceof Error
    ? error.message
    : 'No fue posible procesar el documento PDF.'
}
