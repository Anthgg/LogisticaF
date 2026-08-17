import { useMemo, useState } from 'react'
import type { RoleMatrixPermission } from '../../types/logistics-resources'

/**
 * Selector de permisos agrupado por dominio.
 *
 * El catálogo tiene cientos de códigos: mostrarlos como una lista plana de casillas
 * no es utilizable. Se agrupan por el segmento de dominio que ya calcula el backend
 * (`logistics.warehouses.read` → `warehouses`) sin alterar el código canónico, que
 * es lo único que se envía.
 *
 * No hay «seleccionar todo» global a propósito: un clic no debería poder convertir
 * un rol operativo en superusuario.
 */
export function PermissionSelector({
  permissions,
  selected,
  onChange,
  disabled = false,
}: {
  permissions: RoleMatrixPermission[]
  selected: string[]
  onChange: (codes: string[]) => void
  disabled?: boolean
}) {
  const [search, setSearch] = useState('')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const selectedSet = useMemo(() => new Set(selected), [selected])

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase()
    const map = new Map<string, RoleMatrixPermission[]>()
    for (const permission of permissions) {
      if (
        term &&
        !permission.code.toLowerCase().includes(term) &&
        !permission.name.toLowerCase().includes(term)
      ) {
        continue
      }
      const list = map.get(permission.group) ?? []
      list.push(permission)
      map.set(permission.group, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [permissions, search])

  const toggle = (code: string) => {
    const next = new Set(selectedSet)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    onChange([...next])
  }

  const toggleGroup = (codes: string[]) => {
    const allSelected = codes.every((code) => selectedSet.has(code))
    const next = new Set(selectedSet)
    for (const code of codes) {
      if (allSelected) next.delete(code)
      else next.add(code)
    }
    onChange([...next])
  }

  return (
    <div className="permission-selector">
      <div className="flex items-center gap-3 mb-2">
        <input
          type="search"
          className="field__input"
          placeholder="Buscar permiso…"
          aria-label="Buscar permiso"
          value={search}
          disabled={disabled}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-sm text-slate-600" data-testid="permission-selected-count">
          {selected.length} seleccionados
        </span>
      </div>

      {grouped.length === 0 ? (
        <p className="text-sm text-slate-500">Sin permisos que coincidan con la búsqueda.</p>
      ) : (
        grouped.map(([group, items]) => {
          const codes = items.map((item) => item.code)
          const isOpen = openGroups[group] ?? Boolean(search.trim())
          const selectedInGroup = codes.filter((code) => selectedSet.has(code)).length
          return (
            <fieldset key={group} className="permission-group">
              <legend>
                <button
                  type="button"
                  className="permission-group__toggle"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setOpenGroups((current) => ({ ...current, [group]: !isOpen }))
                  }
                >
                  {group} ({selectedInGroup}/{codes.length})
                </button>
                <button
                  type="button"
                  className="permission-group__select"
                  disabled={disabled}
                  onClick={() => toggleGroup(codes)}
                >
                  {codes.every((code) => selectedSet.has(code))
                    ? 'Quitar grupo'
                    : 'Seleccionar grupo'}
                </button>
              </legend>
              {isOpen && (
                <ul className="permission-group__list">
                  {items.map((permission) => (
                    <li key={permission.code}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedSet.has(permission.code)}
                          disabled={disabled}
                          onChange={() => toggle(permission.code)}
                        />
                        <code>{permission.code}</code>
                        {permission.is_sensitive && (
                          <span className="permission-flag" title="Permiso sensible">
                            sensible
                          </span>
                        )}
                        {permission.requires_step_up && (
                          <span className="permission-flag" title="Requiere verificación reforzada">
                            step-up
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          )
        })
      )}
    </div>
  )
}
