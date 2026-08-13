import { Link, useLocation } from 'react-router-dom'
import { LogisticsIcon } from '../common/LogisticsIcon'
import {
  NAVIGATION_GROUPS,
  getGroupModules,
  resolveActiveModuleId,
} from './nav-modules.config'
import { useAllowedNavigationModules } from './useAllowedNavigationModules'

/**
 * Sub-navegación del grupo activo, en la parte superior de la página.
 *
 * El botón de la barra inferior entra directamente al módulo principal del
 * grupo; una vez dentro, las demás opciones del grupo se muestran aquí en vez
 * de en un desplegable flotante.
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

  // Con una sola opción visible el grupo no aporta nada: la barra inferior ya
  // muestra ese módulo como acceso directo.
  if (modules.length < 2) return null

  return (
    <nav
      aria-label={`Secciones de ${group.label}`}
      className="mb-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm backdrop-blur-sm"
    >
      <div className="flex min-w-max items-center gap-1">
        <span className="flex items-center gap-2 px-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
          <LogisticsIcon name={group.iconName} size={15} aria-hidden="true" />
          {group.label}
        </span>
        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />

        {modules.map((module) => {
          const isActive = module.id === activeModuleId
          return (
            <Link
              key={module.id}
              to={module.route}
              title={module.description}
              aria-current={isActive ? 'page' : undefined}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium no-underline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
                isActive
                  ? 'bg-orange-50 text-orange-800 shadow-sm ring-1 ring-orange-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              <LogisticsIcon
                name={module.iconName}
                size={16}
                aria-hidden="true"
                className={isActive ? 'text-orange-600' : 'text-slate-400'}
              />
              {module.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
