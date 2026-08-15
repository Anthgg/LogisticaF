import type { InstitutionalPreviewRequest } from '../../types/company-profile'
import { ApiRequestError } from '../../types/api'
import {
  requestPdf,
  type PdfFile,
  type PdfRequestOptions,
} from './pdf-client'

export type PdfIntent = 'preview' | 'download'
export type PdfMethod = 'GET' | 'POST'
export type PdfRenderPayload = Record<string, unknown>
export type PdfCallOptions = Pick<
  PdfRequestOptions,
  'signal' | 'stepUpProofId'
>

export const PDF_CONTRACT_ENDPOINTS = [
  { key: 'company-preview', intent: 'preview', method: 'POST', path: '/logistics/company-profile/document-preview' },
  { key: 'requisition-preview', intent: 'preview', method: 'GET', path: '/logistics/procurement/requisitions/{requisition_id}/document/preview' },
  { key: 'reception-preview', intent: 'preview', method: 'GET', path: '/logistics/reception-appointments/{appointment_id}/preview' },
  { key: 'template-preview', intent: 'preview', method: 'POST', path: '/logistics/document-templates/{template_key}/preview' },
  { key: 'purchasing-preview', intent: 'preview', method: 'POST', path: '/logistics/purchasing/documents/{document_type_code}/preview' },
  { key: 'inbound-preview', intent: 'preview', method: 'POST', path: '/logistics/inbound/documents/{document_type_code}/preview' },
  { key: 'inventory-preview', intent: 'preview', method: 'POST', path: '/logistics/inventory/documents/{document_type_code}/preview' },
  { key: 'outbound-preview', intent: 'preview', method: 'POST', path: '/logistics/outbound/documents/{document_type_code}/preview' },
  { key: 'outbound-package-preview', intent: 'preview', method: 'POST', path: '/logistics/outbound/document-package/preview' },
  { key: 'dispatch-preview', intent: 'preview', method: 'POST', path: '/logistics/dispatch/documents/{document_type_code}/preview' },
  { key: 'transport-preview', intent: 'preview', method: 'POST', path: '/logistics/transport/documents/{document_type_code}/preview' },
  { key: 'transport-package-preview', intent: 'preview', method: 'POST', path: '/logistics/transport/document-package/preview' },
  { key: 'delivery-preview', intent: 'preview', method: 'POST', path: '/logistics/delivery/documents/{document_type_code}/preview' },
  { key: 'document-preview', intent: 'preview', method: 'GET', path: '/logistics/documents/{document_id}/preview' },
  { key: 'company-download', intent: 'download', method: 'POST', path: '/logistics/company-profile/document-preview.pdf' },
  { key: 'requisition-download', intent: 'download', method: 'GET', path: '/logistics/procurement/requisitions/{requisition_id}/document/preview.pdf' },
  { key: 'location-label-download', intent: 'download', method: 'GET', path: '/logistics/warehouses/locations/{location_id}/label.pdf' },
  { key: 'location-labels-download', intent: 'download', method: 'POST', path: '/logistics/warehouses/locations/labels/export' },
  { key: 'reception-download', intent: 'download', method: 'GET', path: '/logistics/reception-appointments/{appointment_id}/preview.pdf' },
  { key: 'gate-cpv-download', intent: 'download', method: 'GET', path: '/logistics/gate-check-ins/{check_in_id}/document/pdf' },
  { key: 'series-download', intent: 'download', method: 'GET', path: '/logistics/document-series/{series_id}/talonario.pdf' },
  { key: 'talonario-download', intent: 'download', method: 'GET', path: '/logistics/document-talonarios/{talonario_id}/pdf' },
  { key: 'template-download', intent: 'download', method: 'POST', path: '/logistics/document-templates/{template_key}/pdf' },
  { key: 'purchasing-download', intent: 'download', method: 'POST', path: '/logistics/purchasing/documents/{document_type_code}/pdf' },
  { key: 'inbound-download', intent: 'download', method: 'POST', path: '/logistics/inbound/documents/{document_type_code}/pdf' },
  { key: 'inventory-download', intent: 'download', method: 'POST', path: '/logistics/inventory/documents/{document_type_code}/pdf' },
  { key: 'outbound-download', intent: 'download', method: 'POST', path: '/logistics/outbound/documents/{document_type_code}/pdf' },
  { key: 'outbound-package-download', intent: 'download', method: 'POST', path: '/logistics/outbound/document-package/pdf' },
  { key: 'dispatch-download', intent: 'download', method: 'POST', path: '/logistics/dispatch/documents/{document_type_code}/pdf' },
  { key: 'transport-download', intent: 'download', method: 'POST', path: '/logistics/transport/documents/{document_type_code}/pdf' },
  { key: 'transport-package-download', intent: 'download', method: 'POST', path: '/logistics/transport/document-package/pdf' },
  { key: 'delivery-download', intent: 'download', method: 'POST', path: '/logistics/delivery/documents/{document_type_code}/pdf' },
  { key: 'document-download', intent: 'download', method: 'GET', path: '/logistics/documents/{document_id}/pdf' },
] as const satisfies ReadonlyArray<{
  key: string
  intent: PdfIntent
  method: PdfMethod
  path: string
}>

function companyPayload(data: InstitutionalPreviewRequest): PdfRenderPayload {
  return {
    doc_type_code: data.doc_type_code,
    branch_id: data.branch_id || null,
    signer_id: data.signer_id || null,
    custom_data: data.custom_data ?? {},
  }
}

export const pdfApi = {
  companyProfile: {
    preview(data: InstitutionalPreviewRequest, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: '/logistics/company-profile/document-preview', method: 'POST', body: companyPayload(data), fallbackFilename: `${data.doc_type_code}-preview.pdf`, ...options })
    },
    download(data: InstitutionalPreviewRequest, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: '/logistics/company-profile/document-preview.pdf', method: 'POST', body: companyPayload(data), fallbackFilename: `${data.doc_type_code}.pdf`, ...options })
    },
  },

  requisition: {
    preview(requisitionId: string, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/procurement/requisitions/${requisitionId}/document/preview`, method: 'GET', fallbackFilename: 'requisicion-preview.pdf', ...options })
    },
    download(requisitionId: string, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/procurement/requisitions/${requisitionId}/document/preview.pdf`, method: 'GET', fallbackFilename: 'requisicion.pdf', ...options })
    },
  },

  receptionAppointment: {
    preview(appointmentId: string, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/reception-appointments/${appointmentId}/preview`, method: 'GET', fallbackFilename: 'cit-preview.pdf', ...options })
    },
    download(appointmentId: string, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/reception-appointments/${appointmentId}/preview.pdf`, method: 'GET', fallbackFilename: 'cit.pdf', ...options })
    },
  },

  warehouseLabels: {
    downloadOne(locationId: string, paperSize = 'A6', options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/warehouses/locations/${locationId}/label.pdf?paper_size=${paperSize}`, method: 'GET', fallbackFilename: 'etiqueta-ubicacion.pdf', ...options })
    },
    downloadBatch(locationIds: string[], paperSize = 'A6', options: PdfCallOptions = {}): Promise<PdfFile> {
      if (locationIds.length === 0) {
        return Promise.reject(
          new ApiRequestError(
            'Selecciona al menos una ubicación para exportar etiquetas.',
            { code: 'EMPTY_PDF_SELECTION' },
          ),
        )
      }
      return requestPdf({ path: `/logistics/warehouses/locations/labels/export?paper_size=${paperSize}`, method: 'POST', body: locationIds, fallbackFilename: 'etiquetas-ubicaciones.pdf', ...options })
    },
  },

  gateControl: {
    downloadCpv(checkInId: string, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/gate-check-ins/${checkInId}/document/pdf`, method: 'GET', fallbackFilename: 'acta-cpv.pdf', ...options })
    },
  },

  documentSeries: {
    downloadSeries(seriesId: string, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/document-series/${seriesId}/talonario.pdf`, method: 'GET', fallbackFilename: 'talonario-serie.pdf', ...options })
    },
    downloadTalonario(talonarioId: string, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/document-talonarios/${talonarioId}/pdf`, method: 'GET', fallbackFilename: 'talonario.pdf', ...options })
    },
  },

  documents: {
    preview(documentId: string, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/documents/${documentId}/preview`, method: 'GET', fallbackFilename: 'documento-preview.pdf', ...options })
    },
    download(documentId: string, original = false, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/documents/${documentId}/pdf?original=${String(original)}`, method: 'GET', fallbackFilename: 'documento.pdf', ...options })
    },
  },

  templates: {
    preview(templateKey: string, payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/document-templates/${templateKey}/preview`, method: 'POST', body: payload, fallbackFilename: `${templateKey}-preview.pdf`, ...options })
    },
    download(templateKey: string, payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/document-templates/${templateKey}/pdf`, method: 'POST', body: payload, fallbackFilename: `${templateKey}.pdf`, ...options })
    },
  },

  purchasing: {
    preview(documentTypeCode: string, payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/purchasing/documents/${documentTypeCode}/preview`, method: 'POST', body: payload, fallbackFilename: `${documentTypeCode}-preview.pdf`, ...options })
    },
    download(documentTypeCode: string, payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/purchasing/documents/${documentTypeCode}/pdf`, method: 'POST', body: payload, fallbackFilename: `${documentTypeCode}.pdf`, ...options })
    },
  },

  inbound: {
    preview(documentTypeCode: string, payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/inbound/documents/${documentTypeCode}/preview`, method: 'POST', body: payload, fallbackFilename: `${documentTypeCode}-preview.pdf`, ...options })
    },
    download(documentTypeCode: string, payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/inbound/documents/${documentTypeCode}/pdf`, method: 'POST', body: payload, fallbackFilename: `${documentTypeCode}.pdf`, ...options })
    },
  },

  inventory: {
    preview(documentTypeCode: string, payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/inventory/documents/${documentTypeCode}/preview`, method: 'POST', body: payload, fallbackFilename: `${documentTypeCode}-preview.pdf`, ...options })
    },
    download(documentTypeCode: string, payload: PdfRenderPayload, blindCountMode = false, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/inventory/documents/${documentTypeCode}/pdf?blind_count_mode=${String(blindCountMode)}`, method: 'POST', body: payload, fallbackFilename: `${documentTypeCode}.pdf`, ...options })
    },
  },

  outbound: {
    preview(documentTypeCode: string, payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/outbound/documents/${documentTypeCode}/preview`, method: 'POST', body: payload, fallbackFilename: `${documentTypeCode}-preview.pdf`, ...options })
    },
    download(documentTypeCode: string, payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/outbound/documents/${documentTypeCode}/pdf`, method: 'POST', body: payload, fallbackFilename: `${documentTypeCode}.pdf`, ...options })
    },
    previewPackage(payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: '/logistics/outbound/document-package/preview', method: 'POST', body: payload, fallbackFilename: 'paquete-outbound-preview.pdf', ...options })
    },
    downloadPackage(payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: '/logistics/outbound/document-package/pdf', method: 'POST', body: payload, fallbackFilename: 'paquete-outbound.pdf', ...options })
    },
  },

  dispatch: {
    preview(documentTypeCode: string, payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/dispatch/documents/${documentTypeCode}/preview`, method: 'POST', body: payload, fallbackFilename: `${documentTypeCode}-preview.pdf`, ...options })
    },
    download(documentTypeCode: string, payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/dispatch/documents/${documentTypeCode}/pdf`, method: 'POST', body: payload, fallbackFilename: `${documentTypeCode}.pdf`, ...options })
    },
  },

  transport: {
    preview(documentTypeCode: string, payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/transport/documents/${documentTypeCode}/preview`, method: 'POST', body: payload, fallbackFilename: `${documentTypeCode}-preview.pdf`, ...options })
    },
    download(documentTypeCode: string, payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/transport/documents/${documentTypeCode}/pdf`, method: 'POST', body: payload, fallbackFilename: `${documentTypeCode}.pdf`, ...options })
    },
    previewPackage(payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: '/logistics/transport/document-package/preview', method: 'POST', body: payload, fallbackFilename: 'paquete-transporte-preview.pdf', ...options })
    },
    downloadPackage(payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: '/logistics/transport/document-package/pdf', method: 'POST', body: payload, fallbackFilename: 'paquete-transporte.pdf', ...options })
    },
  },

  delivery: {
    preview(documentTypeCode: string, payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/delivery/documents/${documentTypeCode}/preview`, method: 'POST', body: payload, fallbackFilename: `${documentTypeCode}-preview.pdf`, ...options })
    },
    download(documentTypeCode: string, payload: PdfRenderPayload, options: PdfCallOptions = {}): Promise<PdfFile> {
      return requestPdf({ path: `/logistics/delivery/documents/${documentTypeCode}/pdf`, method: 'POST', body: payload, fallbackFilename: `${documentTypeCode}.pdf`, ...options })
    },
  },
}
