import { Link, useLocation } from 'react-router-dom'
import { LogisticsIcon } from '../common/LogisticsIcon'
import {
  NAVIGATION_GROUPS,
  getGroupModules,
  resolveActiveModuleId,
} from './nav-modules.config'
import { useAllowedNavigationModules } from './useAllowedNavigationModules'

/**
 * Sub-navegación compacta del grupo activo, en la parte superior de la página.
 * Estilo de tabs empresariales modernos con indicador de pestaña activa de 2px.
 */
export function ModuleGroupNav() {
  const location = useLocation()
  const allowedModules = useAllowedNavigationModules()

  const activeModuleId = resolveActiveModuleId(location.pathname, allowedModules)
  const activeModule = allowedModules.find((module) => module.id === activeModuleId)
  const groupId = activeModule?.navigationGroup

  if (!groupId) return null

  const group = NAVIGATION_GROUPS[groupId]
  const modules = getGroupModules(groupId, allowedModules)

  // Con una sola opción visible el grupo no aporta nada
  if (modules.length < 2) return null

  return (
    <nav
      aria-label={`Secciones de ${group.label}`}
      className="mb-3.5 flex items-center gap-2 border-b border-slate-200/80 overflow-x-auto scrollbar-none"
    >
      <div className="flex shrink-0 items-center gap-1.5 py-1.5 pr-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <LogisticsIcon name={group.iconName} size={14} aria-hidden="true" />
        <span>{group.label}</span>
      </div>
      <div className="h-4 w-px bg-slate-200 shrink-0" aria-hidden="true" />

      <div className="flex min-w-max items-center gap-1">
        {modules.map((module) => {
          const isActive = module.id === activeModuleId
          return (
            <Link
              key={module.id}
              to={module.route}
              title={module.description}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
                isActive
                  ? 'text-primary'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 rounded-md'
              }`}
            >
              <LogisticsIcon
                name={module.iconName}
                size={14}
                aria-hidden="true"
                className={isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'}
              />
              <span>{module.label}</span>

              {/* Indicador de pestaña activa de 2px */}
              {isActive && (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-primary rounded-t"
                  aria-hidden="true"
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
