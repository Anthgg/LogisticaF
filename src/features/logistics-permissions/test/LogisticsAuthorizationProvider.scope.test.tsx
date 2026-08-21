/**
 * Regresión: el ámbito de una asignación no es un conjunto de permisos.
 *
 * Estas pruebas montan el Provider real. El resto de la suite de permisos inyecta un
 * estado de contexto falso, así que ninguna llegaba a `checkPermissionMatch` —motivo
 * por el que un usuario con un rol de ámbito global recibía todos los permisos de la
 * interfaz sin que nada fallara en verde.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { LogisticsAuthorizationProvider } from '../contexts/LogisticsAuthorizationProvider'
import { useLogisticsPermissions } from '../hooks/useLogisticsPermissions'
import type {
  LogisticsPermissionsResponse,
  LogisticsRoleScope,
} from '../../../types/logistics-permissions'

const getMyLogisticsPermissions = vi.fn<() => Promise<LogisticsPermissionsResponse>>()

vi.mock('../api/logistics-permissions-api', () => ({
  getMyLogisticsPermissions: () => getMyLogisticsPermissions(),
  refreshMyLogisticsPermissions: () => getMyLogisticsPermissions(),
  getCachedPermissions: () => null,
  invalidatePermissionsCache: () => undefined,
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'u1' } }),
}))

vi.mock('../../logistics-me/hooks/useLogisticsAccess', () => ({
  useLogisticsAccess: () => ({
    isLoading: false,
    isError: false,
    accessStatus: 'enabled',
  }),
}))

/** Un rol sin acotar a organización: ámbito global, no permisos globales. */
const globalRole: LogisticsRoleScope = {
  role_code: 'CUSTOM_AUDITOR',
  role_name: 'Auditor',
  scope_type: 'GLOBAL',
  organization_id: null,
  branch_id: null,
  warehouse_id: null,
  expires_at: null,
}

function respond(permissions: string[], roles: LogisticsRoleScope[]): void {
  getMyLogisticsPermissions.mockResolvedValue({
    success: true,
    catalog_version: '2026.006',
    user_id: 'u1',
    permissions,
    sensitive_permissions: [],
    step_up_permissions: [],
    roles,
  })
}

function wrapper({ children }: { children: ReactNode }) {
  return <LogisticsAuthorizationProvider>{children}</LogisticsAuthorizationProvider>
}

async function permissionsHook() {
  const { result } = renderHook(() => useLogisticsPermissions(), { wrapper })
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  return result
}

beforeEach(() => {
  getMyLogisticsPermissions.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('LogisticsAuthorizationProvider · ámbito global no concede permisos', () => {
  it('niega un permiso que el backend no concedió, aunque el rol sea global', async () => {
    respond(['logistics.warehouses.read'], [globalRole])
    const result = await permissionsHook()

    expect(result.current.hasPermission('logistics.warehouses.read')).toBe(true)
    expect(result.current.hasPermission('logistics.warehouses.delete')).toBe(false)
    expect(result.current.hasPermission('logistics.purchase_orders.approve')).toBe(false)
  })

  it('hasAllPermissions no se satisface con el ámbito global', async () => {
    respond(['logistics.warehouses.read'], [globalRole])
    const result = await permissionsHook()

    expect(
      result.current.hasAllPermissions([
        'logistics.warehouses.read',
        'logistics.warehouses.delete',
      ]),
    ).toBe(false)
  })

  it('el ámbito global sí sigue abriendo el alcance territorial', async () => {
    respond(['logistics.warehouses.read'], [globalRole])
    const result = await permissionsHook()

    expect(result.current.canAccessOrganization('cualquier-organizacion')).toBe(true)
  })

  it('sin ámbito global, el alcance queda acotado a la organización asignada', async () => {
    respond(
      ['logistics.warehouses.read'],
      [{ ...globalRole, scope_type: 'ORGANIZATION', organization_id: 'org-1' }],
    )
    const result = await permissionsHook()

    expect(result.current.canAccessOrganization('org-1')).toBe(true)
    expect(result.current.canAccessOrganization('org-2')).toBe(false)
  })
})

describe('LogisticsAuthorizationProvider · no hay comodines', () => {
  // El catálogo del backend tiene 555 permisos y ninguno es comodín: estas cadenas no
  // pueden llegar en la respuesta. Se fijan para que nadie reintroduzca el atajo.
  it.each(['*', 'admin', 'ALL', 'logistics.warehouses.*'])(
    'la cadena %s no concede otros permisos',
    async (wildcard) => {
      respond([wildcard], [])
      const result = await permissionsHook()

      expect(result.current.hasPermission('logistics.warehouses.delete')).toBe(false)
      expect(result.current.hasPermission('logistics.purchase_orders.approve')).toBe(false)
    },
  )
})
