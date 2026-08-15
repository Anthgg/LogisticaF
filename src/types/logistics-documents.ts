/**
 * Contrato runtime del módulo Documents.
 *
 * Estos tipos reproducen los DTO que el backend publica de verdad
 * (`DocumentSummaryResponse`, `DocumentDetailResponse`, `DocumentHistoryResponse`
 * del OpenAPI de `d55e7f2b64ea6d8ce278fb626046c12d3dab1286`). No se añade ningún
 * campo que el backend no emita: un campo inventado aquí no falla en typecheck,
 * falla en producción cuando alguien lo lee.
 *
 * En particular las capacidades viajan PLANAS (`can_preview`, `can_download`…),
 * no dentro de un objeto `capabilities`.
 */

/** Estados conocidos, para poblar filtros. El DTO no cierra la unión. */
export const DOCUMENT_STATUSES = [
  'DRAFT',
  'READY_TO_ISSUE',
  'ISSUED',
  'CANCELLED',
  'REPLACED',
  'FAILED',
  'ARCHIVED',
] as const

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

/** Formatos que acepta `DocumentExportCreate.export_format`. */
export type DocumentExportFormat = 'ZIP' | 'MERGED_PDF' | 'MANIFEST_ONLY'

/** `issued_by_summary`: el backend solo publica el identificador del emisor. */
export interface DocumentActorSummary {
  id: string
}

export interface DocumentBranchSummary {
  id: string
  name: string
}

export interface DocumentWarehouseSummary {
  id: string
  name: string
}

export interface DocumentSourceReference {
  resource_type: string
  resource_id: string | null
}

/**
 * `DocumentSummaryResponse`. `status` y `family` son `string` en el contrato:
 * cerrarlos en una unión haría que una familia nueva del backend rompiera la
 * página en vez de mostrarse.
 */
export interface DocumentSummary {
  id: string
  document_code: string | null
  document_type_code: string
  document_type_name: string
  family: string
  title: string
  status: string
  issued_at: string | null
  issued_by_summary: DocumentActorSummary | null
  branch_summary: DocumentBranchSummary
  warehouse_summary: DocumentWarehouseSummary | null
  source_reference: DocumentSourceReference
  reprint_count: number
  print_request_count: number
  sensitivity: string
  can_preview: boolean
  can_download: boolean
  can_print: boolean
  can_reprint: boolean
  can_cancel: boolean
  can_view_history: boolean
  authoritative_artifact_status: string | null
}

/** `DocumentDetailResponse` = summary + trazabilidad del recurso de origen. */
export interface DocumentDetail extends DocumentSummary {
  lifecycle_status: string
  source_resource_type: string
  source_resource_id: string | null
  source_operation_id: string | null
  current_snapshot_id: string | null
  created_at: string
  updated_at: string
}

/** `DocumentListResponse`: sin `total_pages`; se deriva en el frontend. */
export interface DocumentListResponse {
  items: DocumentSummary[]
  total: number
  page: number
  page_size: number
}

/** `DocumentHistoryEntryResponse`: sin `id` ni `description`. */
export interface DocumentHistoryEntry {
  event_type: string
  timestamp: string
  actor_user_id?: string | null
  actor_name?: string | null
  reason?: string | null
  copy_number?: number | null
  details?: Record<string, unknown> | null
}

export interface DocumentHistoryResponse {
  document_id: string
  history: DocumentHistoryEntry[]
}

/** `DocumentReprintRequest`. */
export interface DocumentReprintRequest {
  reason: string
  requested_copy_format?: string
}

/** `DocumentCancelRequest`: solo `reason`. La confirmación es local. */
export interface DocumentCancelRequest {
  reason: string
}

/** `DocumentExportCreate`. */
export interface DocumentExportRequest {
  document_ids: string[]
  export_format: DocumentExportFormat
  include_manifest: boolean
  include_checksums: boolean
  reason?: string
}

/** `DocumentExportJobResponse`. */
export interface DocumentExportJob {
  job_id: string
  status: string
  total_items: number
  processed_items: number
  failed_items: number
  expires_at: string
  polling_url: string
  download_url: string | null
}

export interface DocumentTalonario {
  id: string
  series_code: string
  document_type: string
  start_number: number
  end_number: number
  current_number: number
  status: 'active' | 'exhausted' | 'closed'
  branch_id: string
  branch_name?: string
  warehouse_id?: string
  warehouse_name?: string
  year: number
  reserved_count: number
  issued_count: number
  cancelled_count: number
  available_count: number
  created_at: string
}
