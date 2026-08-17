import { apiRequest } from './api-client'
import type {
  AuditEventListQuery,
  AuditEventSummaryResponse,
  BranchCreate,
  BranchResponse,
  BranchStatusUpdate,
  BranchUpdate,
  ListQuery,
  LogisticsWarehouseCreate,
  LogisticsWarehouseResponse,
  LogisticsWarehouseSetDefault,
  LogisticsWarehouseStatusUpdate,
  OrganizationCreate,
  OrganizationResponse,
  OrganizationStatusUpdate,
  OrganizationUpdate,
  PaginatedResponse,
  PermissionResponse,
  RoleCreate,
  RoleMatrixResponse,
  RolePermissionsUpdate,
  RoleStatusUpdate,
  RoleUpdate,
  RoleAssignmentCreate,
  RoleAssignmentDateUpdate,
  RoleAssignmentResponse,
  RoleAssignmentRevoke,
  RolePermissionResponse,
  RoleResponse,
} from '../types/logistics-resources'

function buildQuery(query: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const logisticsApi = {
  organizations: {
    list: (query: ListQuery = {}) =>
      apiRequest<PaginatedResponse<OrganizationResponse>>({
        path: `/logistics/organizations${buildQuery(query as Record<string, unknown>)}`,
        method: 'GET',
      }),
    get: (id: string) =>
      apiRequest<OrganizationResponse>({ path: `/logistics/organizations/${id}` }),
    create: (body: OrganizationCreate) =>
      apiRequest<OrganizationResponse>({ path: '/logistics/organizations', method: 'POST', body }),
    update: (id: string, body: OrganizationUpdate) =>
      apiRequest<OrganizationResponse>({ path: `/logistics/organizations/${id}`, method: 'PATCH', body }),
    changeStatus: (id: string, body: OrganizationStatusUpdate) =>
      apiRequest<OrganizationResponse>({ path: `/logistics/organizations/${id}/status`, method: 'PATCH', body }),
    branches: (id: string, query: ListQuery = {}) =>
      apiRequest<PaginatedResponse<BranchResponse>>({
        path: `/logistics/organizations/${id}/branches${buildQuery(query as Record<string, unknown>)}`,
      }),
  },
  branches: {
    get: (id: string) =>
      apiRequest<BranchResponse>({ path: `/logistics/branches/${id}` }),
    create: (organizationId: string, body: BranchCreate) =>
      apiRequest<BranchResponse>({
        path: `/logistics/organizations/${organizationId}/branches`,
        method: 'POST',
        body,
      }),
    update: (id: string, body: BranchUpdate) =>
      apiRequest<BranchResponse>({ path: `/logistics/branches/${id}`, method: 'PATCH', body }),
    changeStatus: (id: string, body: BranchStatusUpdate) =>
      apiRequest<BranchResponse>({ path: `/logistics/branches/${id}/status`, method: 'PATCH', body }),
    warehouses: (id: string, query: ListQuery = {}) =>
      apiRequest<PaginatedResponse<LogisticsWarehouseResponse>>({
        path: `/logistics/branches/${id}/warehouses${buildQuery(query as Record<string, unknown>)}`,
      }),
  },
  /**
   * Almacén como entidad estructural (F004). La jerarquía es
   * Organization -> Branch -> Warehouse, así que no hay listado global: se lista
   * por sede. El módulo rico de F022 (`/logistics/warehouses`, ubicaciones,
   * layouts, QR) vive en `warehouses-modeling-api` y responde otro contrato.
   */
  warehouses: {
    listByBranch: (branchId: string, query: ListQuery = {}) =>
      apiRequest<PaginatedResponse<LogisticsWarehouseResponse>>({
        path: `/logistics/branches/${branchId}/warehouses${buildQuery(query as Record<string, unknown>)}`,
      }),
    get: (branchId: string, id: string) =>
      apiRequest<LogisticsWarehouseResponse>({
        path: `/logistics/branches/${branchId}/warehouses/${id}`,
      }),
    create: (branchId: string, body: LogisticsWarehouseCreate) =>
      apiRequest<LogisticsWarehouseResponse>({
        path: `/logistics/branches/${branchId}/warehouses`,
        method: 'POST',
        body,
      }),
    changeStatus: (id: string, body: LogisticsWarehouseStatusUpdate) =>
      apiRequest<LogisticsWarehouseResponse>({ path: `/logistics/warehouses/${id}/status`, method: 'PATCH', body }),
    setDefault: (id: string, body: LogisticsWarehouseSetDefault) =>
      apiRequest<LogisticsWarehouseResponse>({ path: `/logistics/warehouses/${id}/set-default`, method: 'POST', body }),
  },
  roles: {
    list: (query: ListQuery = {}) =>
      apiRequest<PaginatedResponse<RoleResponse>>({
        path: `/logistics/roles${buildQuery(query as Record<string, unknown>)}`,
      }),
    get: (id: string) =>
      apiRequest<RoleResponse>({ path: `/logistics/roles/${id}` }),
    permissions: (id: string) =>
      apiRequest<RolePermissionResponse[]>({ path: `/logistics/roles/${id}/permissions` }),
    create: (body: RoleCreate) =>
      apiRequest<RoleResponse>({ path: '/logistics/roles', method: 'POST', body }),
    update: (id: string, body: RoleUpdate) =>
      apiRequest<RoleResponse>({ path: `/logistics/roles/${id}`, method: 'PATCH', body }),
    changeStatus: (id: string, body: RoleStatusUpdate) =>
      apiRequest<RoleResponse>({ path: `/logistics/roles/${id}/status`, method: 'PATCH', body }),
    replacePermissions: (id: string, body: RolePermissionsUpdate) =>
      apiRequest<string[]>({ path: `/logistics/roles/${id}/permissions`, method: 'PUT', body }),
    /** Roles, permisos y sus vínculos en una sola respuesta. */
    matrix: () => apiRequest<RoleMatrixResponse>({ path: '/logistics/roles-matrix' }),
  },
  roleAssignments: {
    list: async (query: ListQuery & { user_id?: string } = {}): Promise<PaginatedResponse<RoleAssignmentResponse>> => {
      if (query.user_id) {
        const res = await apiRequest<RoleAssignmentResponse[] | PaginatedResponse<RoleAssignmentResponse>>({
          path: `/logistics/users/${query.user_id}/role-assignments`,
        })
        if (Array.isArray(res)) {
          return { items: res, page: 1, page_size: res.length, total: res.length, total_pages: 1 }
        }
        return res
      }
      return { items: [], page: 1, page_size: 20, total: 0, total_pages: 1 }
    },
    create: (body: RoleAssignmentCreate) =>
      apiRequest<RoleAssignmentResponse>({ path: '/logistics/role-assignments', method: 'POST', body }),
    updateDates: (id: string, body: RoleAssignmentDateUpdate) =>
      apiRequest<RoleAssignmentResponse>({ path: `/logistics/role-assignments/${id}/dates`, method: 'PATCH', body }),
    revoke: (id: string, body: RoleAssignmentRevoke) =>
      apiRequest<RoleAssignmentResponse>({ path: `/logistics/role-assignments/${id}/revoke`, method: 'POST', body }),
    byUser: (userId: string, query: ListQuery = {}) =>
      apiRequest<PaginatedResponse<RoleAssignmentResponse>>({
        path: `/logistics/users/${userId}/role-assignments${buildQuery(query as Record<string, unknown>)}`,
      }),
  },
  permissions: {
    list: (query: ListQuery = {}) =>
      apiRequest<PermissionResponse[]>({
        path: `/logistics/permissions${buildQuery(query as Record<string, unknown>)}`,
      }),
    get: (id: string) =>
      apiRequest<PermissionResponse>({ path: `/logistics/permissions/${id}` }),
  },
  auditEvents: {
    list: (query: AuditEventListQuery = {}) =>
      apiRequest<PaginatedResponse<AuditEventSummaryResponse>>({
        path: `/logistics/audit-events${buildQuery(query as Record<string, unknown>)}`,
      }),
  },
}