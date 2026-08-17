import { useCallback, useEffect, useMemo, useState } from 'react'
import { logisticsApi } from '../api/logistics-api'
import { Alert } from '../components/common/Alert'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { OperationsTable, type TableColumn } from '../components/common/OperationsTable'
import { PageHeader } from '../components/common/PageHeader'
import { QueryBar } from '../components/common/QueryBar'
import { ResourceDialog } from '../components/common/ResourceDialog'
import { StatusBadge } from '../components/common/StatusBadge'
import { PermissionSelector } from '../components/logistics/PermissionSelector'
import { useLogisticsAccess } from '../features/logistics-me/hooks/useLogisticsAccess'
import { LOGISTICS_PERMISSIONS } from '../features/logistics-permissions/logistics-permissions-map'
import type {
  RoleCreate,
  RoleMatrixPermission,
  RoleMatrixRole,
} from '../types/logistics-resources'
import { getErrorMessage } from '../utils/errors'

const emptyForm: RoleCreate = {
  code: '',
  name: '',
  description: '',
  permission_codes: [],
}

export function RolesPage() {
  const access = useLogisticsAccess()
  // La escritura se apoya en el permiso que el catálogo ya define para mutar
  // definiciones RBAC; F005 no añadió códigos nuevos.
  const canManage = access.hasPermission(LOGISTICS_PERMISSIONS.rolePermissions.update)

  const [roles, setRoles] = useState<RoleMatrixRole[]>([])
  const [permissions, setPermissions] = useState<RoleMatrixPermission[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'matrix'>('list')

  const [form, setForm] = useState<RoleCreate>(emptyForm)
  const [editing, setEditing] = useState<RoleMatrixRole | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Una sola petición trae roles, permisos y sus vínculos.
  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const matrix = await logisticsApi.roles.matrix()
      setRoles(matrix.roles)
      setPermissions(matrix.permissions)
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visibleRoles = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return roles
    return roles.filter(
      (role) =>
        role.code.toLowerCase().includes(term) || role.name.toLowerCase().includes(term),
    )
  }, [roles, search])

  const openDialog = (role?: RoleMatrixRole) => {
    setError(null)
    setEditing(role ?? null)
    setForm(
      role
        ? {
            code: role.code,
            name: role.name,
            description: '',
            permission_codes: role.permission_codes,
          }
        : emptyForm,
    )
    setIsOpen(true)
  }

  const save = async () => {
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      if (editing) {
        await logisticsApi.roles.update(editing.id, {
          name: form.name,
          description: form.description,
        })
        await logisticsApi.roles.replacePermissions(editing.id, {
          permission_codes: form.permission_codes,
        })
      } else {
        await logisticsApi.roles.create(form)
      }
      setIsOpen(false)
      setEditing(null)
      await load()
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    } finally {
      setIsSaving(false)
    }
  }

  const toggleStatus = async (role: RoleMatrixRole) => {
    setError(null)
    try {
      await logisticsApi.roles.changeStatus(role.id, {
        status: role.status === 'active' ? 'inactive' : 'active',
      })
      await load()
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
    }
  }

  const columns: TableColumn<RoleMatrixRole>[] = [
    {
      key: 'name',
      label: 'Rol',
      render: (row) => (
        <div className="table-primary">
          <strong>{row.name}</strong>
          <small>{row.code}</small>
        </div>
      ),
    },
    {
      key: 'is_system',
      label: 'Tipo',
      render: (row) =>
        row.is_system ? (
          <StatusBadge value="active">Sistema</StatusBadge>
        ) : (
          <StatusBadge value="inactive">Personalizado</StatusBadge>
        ),
    },
    {
      key: 'permissions',
      label: 'Permisos',
      render: (row) => row.permission_codes.length,
    },
    {
      key: 'status',
      label: 'Estado',
      render: (row) => (
        <StatusBadge value={row.status === 'active' ? 'active' : 'inactive'}>
          {row.status === 'active' ? 'Activo' : 'Inactivo'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      label: 'Acciones',
      align: 'right',
      render: (row) =>
        canManage && !row.is_system ? (
          <div className="table-actions">
            <Button size="small" variant="ghost" onClick={() => openDialog(row)}>
              Editar
            </Button>
            <Button size="small" variant="ghost" onClick={() => void toggleStatus(row)}>
              {row.status === 'active' ? 'Desactivar' : 'Activar'}
            </Button>
          </div>
        ) : (
          // Los roles del sistema los administra la plataforma: no se ofrecen
          // acciones que el backend va a rechazar.
          <span className="text-xs text-slate-500">Administrado por la plataforma</span>
        ),
    },
  ]

  const updateText = (key: 'code' | 'name' | 'description', value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="page">
      <PageHeader
        eyebrow="Control de acceso"
        title="Roles logísticos"
        description="Catálogo de roles y sus acciones permitidas. Los roles de sistema son administrados centralmente."
        actions={
          canManage ? <Button onClick={() => openDialog()}>Nuevo rol</Button> : undefined
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      <section className="panel operations-section">
        <div className="flex items-center gap-3 mb-3">
          <Button
            size="small"
            variant={view === 'list' ? 'primary' : 'secondary'}
            onClick={() => setView('list')}
          >
            Listado
          </Button>
          <Button
            size="small"
            variant={view === 'matrix' ? 'primary' : 'secondary'}
            onClick={() => setView('matrix')}
          >
            Matriz
          </Button>
        </div>

        <QueryBar search={search} onSearch={setSearch} />

        {isLoading ? (
          <div className="loading-panel">
            <span className="spinner" />
            <p>Cargando roles…</p>
          </div>
        ) : view === 'list' ? (
          <OperationsTable
            rows={visibleRoles}
            columns={columns}
            getRowKey={(row) => row.id}
          />
        ) : (
          <RoleMatrixTable roles={visibleRoles} permissions={permissions} />
        )}
      </section>

      <ResourceDialog
        isOpen={isOpen}
        title={editing ? `Editar rol · ${editing.code}` : 'Nuevo rol'}
        submitLabel={editing ? 'Guardar cambios' : 'Crear rol'}
        isSubmitting={isSaving}
        onClose={() => {
          setIsOpen(false)
          setEditing(null)
        }}
        onSubmit={() => void save()}
      >
        {/* El Alert de la página queda detrás del modal. */}
        {error && <Alert variant="error">{error}</Alert>}
        <div className="form-grid">
          <Input
            label="Código"
            value={form.code}
            onChange={(e) => updateText('code', e.target.value)}
            required
            // El código identifica al rol de forma estable: no se edita.
            disabled={Boolean(editing)}
          />
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => updateText('name', e.target.value)}
            required
          />
          <Input
            label="Descripción"
            value={form.description}
            onChange={(e) => updateText('description', e.target.value)}
          />
        </div>

        <h4 className="field__label">Permisos</h4>
        <PermissionSelector
          permissions={permissions}
          selected={form.permission_codes}
          disabled={isSaving}
          onChange={(codes) =>
            setForm((current) => ({ ...current, permission_codes: codes }))
          }
        />
      </ResourceDialog>
    </div>
  )
}

/**
 * Matriz rol × permiso, agregada por dominio.
 *
 * Una columna por cada permiso del catálogo sería ilegible, así que cada celda
 * resume cuántos permisos del grupo tiene el rol. El detalle exacto vive en el
 * editor del rol.
 */
function RoleMatrixTable({
  roles,
  permissions,
}: {
  roles: RoleMatrixRole[]
  permissions: RoleMatrixPermission[]
}) {
  const groups = useMemo(() => {
    const byGroup = new Map<string, string[]>()
    for (const permission of permissions) {
      const list = byGroup.get(permission.group) ?? []
      list.push(permission.code)
      byGroup.set(permission.group, list)
    }
    return [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [permissions])

  if (roles.length === 0) {
    return <p className="text-sm text-slate-500">Sin roles que mostrar.</p>
  }

  return (
    <div className="matrix-scroll" style={{ overflowX: 'auto' }}>
      <table className="matrix-table">
        <thead>
          <tr>
            <th scope="col">Rol</th>
            {groups.map(([group]) => (
              <th key={group} scope="col">
                {group}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => {
            const held = new Set(role.permission_codes)
            return (
              <tr key={role.id}>
                <th scope="row">
                  {role.name}
                  <small> {role.code}</small>
                </th>
                {groups.map(([group, codes]) => {
                  const count = codes.filter((code) => held.has(code)).length
                  return (
                    <td key={group} title={`${count} de ${codes.length} en ${group}`}>
                      {count === 0 ? '—' : `${count}/${codes.length}`}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
