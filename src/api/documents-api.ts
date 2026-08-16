import { apiRequest, getCsrfToken } from './api-client'
import { API_ROOT } from './config'
import { contractGap } from './contract-availability'
import { pdfApi } from './pdf/pdf-endpoints'
import { createPdfObjectUrl, downloadPdfFile } from './pdf/pdf-client'
import type {
  DocumentCancelRequest,
  DocumentDetail,
  DocumentExportJob,
  DocumentExportRequest,
  DocumentHistoryEntry,
  DocumentHistoryResponse,
  DocumentListResponse,
  DocumentReprintRequest,
  DocumentTalonario,
} from '../types/logistics-documents'
import type { PaginatedResponse } from '../types/logistics-resources'

/** Filtros que el backend publica para `GET /logistics/documents`. */
export interface DocumentListQuery {
  page?: number
  page_size?: number
  search?: string
  document_code?: string
  document_type_code?: string
  family?: string
  status?: string
  branch_id?: string
  warehouse_id?: string
  source_resource_type?: string
  source_resource_id?: string
  date_from?: string
  date_to?: string
  sensitivity?: string
}

/**
 * `DocumentListResponse` no trae `total_pages`. Se deriva aquí, en la vista, en
 * vez de fingir que el dato vino del servidor.
 */
export function documentTotalPages(total: number, pageSize: number): number {
  if (pageSize <= 0 || total <= 0) return 0
  return Math.ceil(total / pageSize)
}

export const documentsApi = {
  async list(query: DocumentListQuery = {}): Promise<DocumentListResponse> {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue
      params.set(key, String(value))
    }
    const qs = params.toString()
    return apiRequest<DocumentListResponse>({
      path: `/logistics/documents${qs ? `?${qs}` : ''}`,
    })
  },

  async get(id: string): Promise<DocumentDetail> {
    return apiRequest<DocumentDetail>({
      path: `/logistics/documents/${id}`,
    })
  },

  /**
   * El historial llega envuelto en `{ document_id, history }`. No se captura el
   * error: un fallo de red que devuelva `[]` se leería como "sin historial",
   * que es justo lo contrario de lo que pasó.
   */
  async getHistory(id: string): Promise<DocumentHistoryEntry[]> {
    const response = await apiRequest<DocumentHistoryResponse>({
      path: `/logistics/documents/${id}/history`,
    })
    return response.history
  },

  async getPreviewBlobUrl(id: string): Promise<string> {
    return createPdfObjectUrl(await pdfApi.documents.preview(id))
  },

  async downloadPdf(
    id: string,
    original = false,
    stepUpProofId?: string,
  ): Promise<void> {
    const pdf = await pdfApi.documents.download(id, original, { stepUpProofId })
    downloadPdfFile(pdf)
  },

  async registerPrintIntent(id: string): Promise<void> {
    const csrfToken = await getCsrfToken()
    await apiRequest({
      path: `/logistics/documents/${id}/print-events`,
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: {},
    })
  },

  async reprint(id: string, data: DocumentReprintRequest): Promise<void> {
    const csrfToken = await getCsrfToken()
    await apiRequest({
      path: `/logistics/documents/${id}/reprint`,
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: data,
    })
  },

  async cancel(id: string, data: DocumentCancelRequest): Promise<void> {
    const csrfToken = await getCsrfToken()
    await apiRequest({
      path: `/logistics/documents/${id}/cancel`,
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: data,
    })
  },

  async createExport(data: DocumentExportRequest): Promise<DocumentExportJob> {
    const csrfToken = await getCsrfToken()
    return apiRequest<DocumentExportJob>({
      path: '/logistics/documents/export',
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: data,
    })
  },

  /**
   * El backend devuelve `polling_url` apuntando a `/document-exports/{id}`,
   * pero ese recurso no está publicado en el contrato: no hay nada que
   * consultar. La UI muestra el trabajo tal como lo devolvió la creación.
   */
  async getExportJob(_jobId: string): Promise<DocumentExportJob> {
    throw contractGap('El seguimiento de un trabajo de exportación')
  },

  /**
   * Igual que el seguimiento: `download_url` apunta a
   * `/document-exports/{id}/download`, que tampoco está publicado.
   */
  async downloadExportZip(_jobId: string): Promise<void> {
    throw contractGap('La descarga del paquete de exportación')
  },

  async listTalonarios(query?: { page?: number; page_size?: number }): Promise<PaginatedResponse<DocumentTalonario>> {
    const params = new URLSearchParams()
    if (query?.page) params.set('page', String(query.page))
    if (query?.page_size) params.set('page_size', String(query.page_size))
    const qs = params.toString()
    return apiRequest<PaginatedResponse<DocumentTalonario>>({
      path: `/logistics/document-series${qs ? `?${qs}` : ''}`,
    })
  },

  async downloadTalonarioPdf(talonarioId: string): Promise<void> {
    downloadPdfFile(await pdfApi.documentSeries.downloadTalonario(talonarioId))
  },

  async downloadPackageZip(operationType: string, operationId: string): Promise<void> {
    const response = await fetch(`${API_ROOT}/logistics/document-packages/${operationType}/${operationId}.zip`, {
      method: 'GET',
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error(`Error ${response.status} al descargar paquete de la operación`)
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `package_${operationType}_${operationId.slice(0, 8)}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },
}
