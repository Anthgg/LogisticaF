export interface PaginatedResponse<T> {
  items: T[]
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface OrganizationResponse {
  id: string
  code: string
  name: string
  status: string
  country_code: string
  timezone: string
  created_at: string
  updated_at: string
}

export interface OrganizationCreate {
  code: string
  name: string
  country_code: string
  timezone: string
}

export interface OrganizationUpdate {
  name?: string
  country_code?: string
  timezone?: string
}

export interface OrganizationStatusUpdate {
  status: string
}

export interface BranchResponse {
  id: string
  organization_id: string
  code: string
  name: string
  status: string
  timezone: string
  address_text: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

/** `organization_id` viaja en la ruta (`/organizations/{id}/branches`), no en el cuerpo. */
export interface BranchCreate {
  code: string
  name: string
  timezone: string
  address_text?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface BranchUpdate {
  name?: string
  timezone?: string
  address_text?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface BranchStatusUpdate {
  status: string
}

/**
 * Copia exacta de `LogisticsWarehouseResponse` (backend, módulo organization).
 * El backend NO emite `status` para almacenes: emite `is_active`. Y `address`,
 * `district`, `province` y `department` son nullable porque la columna lo es.
 */
export interface LogisticsWarehouseResponse {
  id: string
  organization_id: string | null
  branch_id: string | null
  code: string
  name: string
  warehouse_type: string
  address: string | null
  district: string | null
  province: string | null
  department: string | null
  capacity: number | null
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * `branch_id` viaja en la ruta, no en el cuerpo, y `organization_id` lo deriva el
 * backend desde la sede: enviarlo no tendría efecto.
 */
export interface LogisticsWarehouseCreate {
  code: string
  name: string
  warehouse_type: string
  address: string
  district: string
  province: string
  department: string
  capacity?: number | null
  is_default?: boolean
}

export interface LogisticsWarehouseStatusUpdate {
  status: string
}

export interface LogisticsWarehouseSetDefault {
  is_default: boolean
}

export interface RoleResponse {
  id: string
  code: string
  name: string
  description: string
  role_type: string
  is_system: boolean
  status: string
  created_at: string
  updated_at: string
}

export interface RoleAssignmentResponse {
  id: string
  user_id: string
  role_id: string
  scope_type: string
  organization_id: string | null
  branch_id: string | null
  warehouse_id: string | null
  status: string
  starts_at: string | null
  ends_at: string | null
  assigned_by: string | null
  assigned_at: string
  revoked_by: string | null
  revoked_at: string | null
  revocation_reason: string | null
  created_at: string
  updated_at: string
}

export interface RoleAssignmentCreate {
  user_id: string
  role_id: string
  scope_type: string
  organization_id?: string | null
  branch_id?: string | null
  warehouse_id?: string | null
  starts_at?: string | null
  ends_at?: string | null
}

export interface RoleAssignmentRevoke {
  reason: string
}

export interface RoleAssignmentDateUpdate {
  starts_at?: string | null
  ends_at?: string | null
}

export interface RolePermissionResponse {
  id: string
  role_id: string
  permission_id: string
  effect: string
  created_at: string
}

export interface AuditEventSummaryResponse {
  id: string
  event_code: string
  event_category: string
  actor_user_id: string | null
  actor_display_name_snapshot: string | null
  action: string | null
  result: string
  severity: string
  resource_type: string | null
  resource_id: string | null
  organization_id: string | null
  branch_id: string | null
  warehouse_id: string | null
  occurred_at: string
}

export interface PermissionResponse {
  id: string
  code: string
  resource: string
  action: string
  name: string
  description: string
  category: string
  risk_level: string
  is_sensitive: boolean
  requires_reason: boolean
  requires_step_up: boolean
  is_system: boolean
  status: string
  created_at: string
  updated_at: string
}

export interface DocumentResponse {
  id: string
  code: string
  document_type: string
  status: string
  [key: string]: unknown
}

export interface ListQuery {
  page?: number
  page_size?: number
  search?: string
  status?: string | null
  role?: string | null
  family?: string | null
  document_type?: string | null
  branch_id?: string | null
  warehouse_id?: string | null
  date_from?: string | null
  date_to?: string | null
}

export interface AuditEventListQuery extends ListQuery {
  event_code?: string | null
  severity?: string | null
  resource_type?: string | null
  actor_user_id?: string | null
  organization_id?: string | null
  start_date?: string | null
  end_date?: string | null
}
