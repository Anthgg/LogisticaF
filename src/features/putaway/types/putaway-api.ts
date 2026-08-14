export type PutawayOrderStatus =
  | 'DRAFT'
  | 'PLANNING'
  | 'RECOMMENDATION_READY'
  | 'READY_FOR_ISSUE'
  | 'ISSUED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'PARTIALLY_COMPLETED'
  | 'COMPLETED'
  | 'COMPLETED_WITH_EXCEPTIONS'
  | 'CANCELLED'
  | 'SUPERSEDED'

export type PutawayTaskStatus =
  | 'CREATED'
  | 'RECOMMENDATION_PENDING'
  | 'READY'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'PRODUCT_SCAN_REQUIRED'
  | 'LOCATION_SCAN_REQUIRED'
  | 'QUANTITY_CONFIRMATION_REQUIRED'
  | 'VALIDATING'
  | 'PARTIALLY_COMPLETED'
  | 'COMPLETED'
  | 'EXCEPTION'
  | 'REPLAN_REQUIRED'
  | 'PAUSED'
  | 'CANCELLED'
  | 'SUPERSEDED'

export type PutawayScannerType =
  | 'KEYBOARD_WEDGE'
  | 'MOBILE_CAMERA'
  | 'HANDHELD_TERMINAL'
  | 'APPROVED_HARDWARE_SDK'
  | 'MANUAL_AUTHORIZED'

export type PutawayExecutionSessionStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED'

export type PutawayScanType =
  | 'PRODUCT'
  | 'LOCATION'
  | 'SOURCE_LOCATION_OPTIONAL'
  | 'PACKAGE_REFERENCE'
  | 'MANUAL_AUTHORIZED'

export type PutawayScanResolutionStatus =
  | 'RECORDED'
  | 'VALID'
  | 'INVALID'
  | 'DUPLICATE'
  | 'REJECTED'
  | 'COMPENSATED'
  // The F045 service emits these two values while validating scans.
  | 'MATCHED'
  | 'MISMATCH'

export type PutawayScanValidationStatus =
  | 'MATCH'
  | 'WRONG_PRODUCT'
  | 'AMBIGUOUS_CODE'
  | 'UNKNOWN_CODE'
  | 'INACTIVE_IDENTIFIER'
  | 'PACKAGE_MISMATCH'
  | 'REQUIRES_MANUAL_REVIEW'
  | 'MATCH_RECOMMENDED'
  | 'VALID_ALTERNATIVE'
  | 'LOCATION_BLOCKED'
  | 'LOCATION_INCOMPATIBLE'
  | 'LOCATION_CAPACITY_INSUFFICIENT'
  | 'WRONG_WAREHOUSE'
  | 'UNKNOWN_LOCATION'
  | 'RESERVATION_EXPIRED'
  | 'REPLAN_REQUIRED'
  | 'MANUAL_REVIEW_REQUIRED'
  // The F045 service currently serializes the validation outcome this way.
  | 'VALID'
  | 'INVALID'

export type PutawayPlacementConfirmationStatus =
  | 'CONFIRMED'
  | 'CONFIRMED_WITH_WARNING'
  | 'PARTIAL'
  | 'REVERSED_BY_COMPENSATION'
  | 'SUPERSEDED'

export type PutawayOperationalPlacementStatus =
  | 'PLACED_PENDING_MOVEMENT_LEDGER'
  | 'PARTIALLY_PLACED'
  | 'SUPERSEDED'
  | 'REVERSED_FUTURE'
  | 'CANCELLED'

export interface PutawayOrderApi {
  id: string
  organization_id: string
  branch_id: string
  warehouse_id: string
  order_code: string
  status: PutawayOrderStatus
  source_type: string
  priority: number
  task_count: number
  completed_task_count: number
  exception_task_count: number
  issued_at: string | null
  issued_by: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  current_revision_number: number
  created_by: string
  created_at: string
  updated_at: string
  row_version: number
}

export interface PutawayTaskApi {
  id: string
  organization_id: string
  warehouse_id: string
  putaway_order_id: string
  task_number: string
  source_allocation_id: string
  recommendation_run_id: string | null
  recommended_location_id: string | null
  selected_location_id: string | null
  source_stage_location_id: string | null
  status: PutawayTaskStatus
  priority: number
  assignment_status: string
  assigned_user_id: string | null
  assigned_team_id: string | null
  assigned_at: string | null
  required_quantity: string | number
  required_unit_id: string
  required_base_quantity: string | number
  placed_quantity: string | number
  placed_base_quantity: string | number
  remaining_quantity: string | number
  remaining_base_quantity: string | number
  scan_policy: string
  expected_product_id: string
  started_at: string | null
  paused_at: string | null
  completed_at: string | null
  exception_count: number
  created_at: string
  updated_at: string
  row_version: number
}

export interface PutawayListApi<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface PutawayExecutionSessionCreateRequest {
  scanner_type?: PutawayScannerType
  device_reference_hash?: string | null
  client_session_reference?: string | null
}

export interface PutawayExecutionSessionApi {
  id: string
  task_id: string
  operator_user_id: string
  device_reference_hash: string | null
  scanner_type: PutawayScannerType
  status: PutawayExecutionSessionStatus
  started_at: string
  last_activity_at: string
  paused_at: string | null
  completed_at: string | null
  client_session_reference: string | null
  created_at: string
}

export interface PutawayScanRecordRequest {
  client_scan_id: string
  scan_type: PutawayScanType
  normalized_code: string
  code_hash: string
  symbology?: string | null
  raw_code_encrypted?: string | null
}

export interface PutawayScanValidationRequest {
  expected_product_id?: string | null
  expected_location_id?: string | null
}

export interface PutawayScanEventApi {
  id: string
  organization_id: string
  warehouse_id: string
  task_id: string
  execution_session_id: string
  client_scan_id: string
  server_sequence: number
  scan_type: PutawayScanType
  normalized_code: string
  code_hash: string
  symbology: string | null
  resolution_status: PutawayScanResolutionStatus
  resolved_product_id: string | null
  resolved_location_id: string | null
  validation_status: PutawayScanValidationStatus | null
  received_at: string
  operator_user_id: string
  status: PutawayScanResolutionStatus
  created_at: string
}

export interface PutawayPlacementConfirmRequest {
  source_allocation_id: string
  location_id: string
  quantity: string | number
  unit_id: string
  product_scan_event_id?: string | null
  location_scan_event_id?: string | null
  reservation_id?: string | null
  observation?: string | null
}

export interface PutawayPlacementConfirmationApi {
  id: string
  organization_id: string
  warehouse_id: string
  task_id: string
  source_allocation_id: string
  location_id: string
  quantity: string | number
  unit_id: string
  base_quantity: string | number
  product_scan_event_id: string | null
  location_scan_event_id: string | null
  reservation_id: string | null
  confirmation_status: PutawayPlacementConfirmationStatus
  confirmed_by: string
  confirmed_at: string
  observation: string | null
  content_hash: string | null
  created_at: string
}

export interface PutawayOperationalPlacementApi {
  id: string
  organization_id: string
  warehouse_id: string
  location_id: string
  source_allocation_id: string
  putaway_order_id: string
  putaway_task_id: string
  placement_confirmation_id: string
  product_id: string
  product_version_id: string | null
  quantity: string | number
  unit_id: string
  base_quantity: string | number
  quality_release_hash: string | null
  status: PutawayOperationalPlacementStatus
  placed_at: string
  placed_by: string
  content_hash: string | null
  created_at: string
}

export interface PutawayCapacityProjectionApi {
  organization_id: string
  warehouse_id: string
  location_id: string
  capacity_profile_id: string
  capacity_type: string
  maximum_value: string | number
  safety_margin_value: string | number
  operational_occupied_value: string | number
  active_reserved_value: string | number
  projected_free_value: string | number
  unit_id: string
  data_quality_status: string
  last_placement_at: string | null
  calculated_at: string
  projection_version: number
}
