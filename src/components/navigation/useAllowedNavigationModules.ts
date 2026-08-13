import { useMemo } from 'react'
import { useLogisticsPermissions } from '../../features/logistics-permissions/hooks/useLogisticsPermissions'
import { ALL_NAVIGATION_MODULES, type NavigationModule } from './nav-modules.config'

/**
 * Módulos que el usuario puede ver según RBAC. Lo comparten la barra flotante y
 * la sub-navegación superior para que ambas partan de la misma fuente y no
 * dupliquen la lógica de permisos.
 */
export function useAllowedNavigationModules(): NavigationModule[] {
  const auth = useLogisticsPermissions()

  return useMemo(() => {
    return ALL_NAVIGATION_MODULES.filter((item) => {
      if (item.legacyAlwaysAllowed) return true
      if (auth.isLoading) return false
      if (item.permission && auth.hasPermission(item.permission)) return true
      if (
        item.anyOfPermissions &&
        item.anyOfPermissions.length > 0 &&
        auth.hasAnyPermission(item.anyOfPermissions)
      ) {
        return true
      }
      return false
    })
  }, [auth])
}
