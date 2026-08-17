/**
 * F005 — administración de roles logísticos.
 *
 * Los fixtures copian la forma real de `RoleMatrixResponse`: una sola respuesta con
 * roles, permisos y sus vínculos. La página no hace una petición por rol.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nContext } from '../../contexts/i18n-context'
import { ApiRequestError } from '../../types/api'
import { createI18nValue } from '../../test/test-utils'
import {
  LogisticsAccessContext,
  defaultLogisticsAccessState,
  type LogisticsAccessState,
} from '../../features/logistics-me/contexts/logistics-access-context'
import { RolesPage } from '../RolesPage'

vi.mock('../../api/logistics-api', () => ({
  logisticsApi: {
    roles: {
      list: vi.fn(),
      get: vi.fn(),
      permissions: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      changeStatus: vi.fn(),
      replacePermissions: vi.fn(),
      matrix: vi.fn(),
    },
  },
}))

const { logisticsApi } = await import('../../api/logistics-api')

const PERMISSIONS = [
  {
    code: 'logistics.warehouses.read',
    name: 'Leer almacenes',
    description: '',
    group: 'warehouses',
    resource: 'warehouses',
    action: 'read',
    is_sensitive: false,
    requires_step_up: false,
  },
  {
    code: 'logistics.warehouses.create',
    name: 'Crear almacenes',
    description: '',
    group: 'warehouses',
    resource: 'warehouses',
    action: 'create',
    is_sensitive: false,
    requires_step_up: false,
  },
  {
    code: 'logistics.role_permissions.update',
    name: 'Editar permisos de rol',
    description: '',
    group: 'role_permissions',
    resource: 'role_permissions',
    action: 'update',
    is_sensitive: true,
    requires_step_up: true,
  },
]

const CUSTOM_ROLE = {
  id: 'role-custom',
  code: 'LOGISTICS_CUSTOM_SUPERVISOR',
  name: 'Supervisor de recepción',
  role_type: 'custom',
  is_system: false,
  status: 'active',
  permission_codes: ['logistics.warehouses.read'],
}

const SYSTEM_ROLE = {
  id: 'role-system',
  code: 'RECEIVING',
  name: 'Recepción',
  role_type: 'system',
  is_system: true,
  status: 'active',
  permission_codes: ['logistics.warehouses.read', 'logistics.warehouses.create'],
}

function matrix() {
  return {
    roles: [CUSTOM_ROLE, SYSTEM_ROLE],
    permissions: PERMISSIONS,
    total_mappings: 3,
  }
}

function access(canManage = true): LogisticsAccessState {
  return {
    ...defaultLogisticsAccessState,
    isLoading: false,
    isLogisticsEnabled: true,
    hasPermission: (code: string) =>
      code === 'logistics.role_permissions.update' ? canManage : true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  }
}

function renderPage(ui: ReactElement, canManage = true) {
  return render(
    <I18nContext.Provider value={createI18nValue()}>
      <MemoryRouter>
        <LogisticsAccessContext.Provider value={access(canManage)}>
          {ui}
        </LogisticsAccessContext.Provider>
      </MemoryRouter>
    </I18nContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(logisticsApi.roles.matrix).mockResolvedValue(matrix())
  vi.mocked(logisticsApi.roles.create).mockResolvedValue(CUSTOM_ROLE as never)
  vi.mocked(logisticsApi.roles.update).mockResolvedValue(CUSTOM_ROLE as never)
  vi.mocked(logisticsApi.roles.changeStatus).mockResolvedValue(CUSTOM_ROLE as never)
  vi.mocked(logisticsApi.roles.replacePermissions).mockResolvedValue([
    'logistics.warehouses.read',
  ])
})

describe('RolesPage · listado', () => {
  it('carga la matriz con una sola petición, no una por rol', async () => {
    renderPage(<RolesPage />)
    await screen.findByText('Supervisor de recepción')
    expect(logisticsApi.roles.matrix).toHaveBeenCalledTimes(1)
    expect(logisticsApi.roles.permissions).not.toHaveBeenCalled()
  })

  it('distingue visualmente los roles del sistema', async () => {
    renderPage(<RolesPage />)
    const row = (await screen.findByText('Recepción')).closest('tr') as HTMLElement
    expect(within(row).getByText('Sistema')).toBeInTheDocument()
  })

  it('no ofrece acciones sobre un rol del sistema', async () => {
    renderPage(<RolesPage />)
    const row = (await screen.findByText('Recepción')).closest('tr') as HTMLElement
    expect(within(row).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(within(row).getByText(/Administrado por la plataforma/)).toBeInTheDocument()
  })

  it('oculta la administración sin el permiso correspondiente', async () => {
    renderPage(<RolesPage />, false)
    await screen.findByText('Supervisor de recepción')
    expect(screen.queryByRole('button', { name: 'Nuevo rol' })).not.toBeInTheDocument()
  })

  it('filtra por código o nombre', async () => {
    const user = userEvent.setup()
    renderPage(<RolesPage />)
    await screen.findByText('Supervisor de recepción')
    await user.type(screen.getByRole('searchbox'), 'RECEIVING')
    await waitFor(() =>
      expect(screen.queryByText('Supervisor de recepción')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Recepción')).toBeInTheDocument()
  })
})

describe('RolesPage · creación y edición', () => {
  it('crea un rol enviando solo los códigos de permiso', async () => {
    const user = userEvent.setup()
    renderPage(<RolesPage />)
    await screen.findByText('Supervisor de recepción')

    await user.click(screen.getByRole('button', { name: 'Nuevo rol' }))
    await user.type(screen.getByLabelText('Código'), 'CALIDADSUP')
    await user.type(screen.getByLabelText('Nombre'), 'Supervisor de calidad')
    await user.click(screen.getByRole('button', { name: /warehouses \(/ }))
    await user.click(screen.getByRole('checkbox', { name: /logistics.warehouses.read/ }))
    await user.click(screen.getByRole('button', { name: 'Crear rol' }))

    await waitFor(() => expect(logisticsApi.roles.create).toHaveBeenCalled())
    const [body] = vi.mocked(logisticsApi.roles.create).mock.calls[0]
    expect(body).toMatchObject({
      code: 'CALIDADSUP',
      name: 'Supervisor de calidad',
      permission_codes: ['logistics.warehouses.read'],
    })
    // El cliente nunca decide si un rol es del sistema.
    expect(body).not.toHaveProperty('is_system')
  })

  it('al editar no permite cambiar el código', async () => {
    const user = userEvent.setup()
    renderPage(<RolesPage />)
    await screen.findByText('Supervisor de recepción')
    const row = screen.getByText('Supervisor de recepción').closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Editar' }))

    expect(screen.getByLabelText('Código')).toBeDisabled()
    expect(screen.getByLabelText<HTMLInputElement>('Código').value).toBe(
      'LOGISTICS_CUSTOM_SUPERVISOR',
    )
  })

  it('al editar actualiza el rol y reemplaza sus permisos', async () => {
    const user = userEvent.setup()
    renderPage(<RolesPage />)
    await screen.findByText('Supervisor de recepción')
    const row = screen.getByText('Supervisor de recepción').closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Editar' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(logisticsApi.roles.update).toHaveBeenCalled())
    expect(logisticsApi.roles.replacePermissions).toHaveBeenCalledWith('role-custom', {
      permission_codes: ['logistics.warehouses.read'],
    })
  })

  it('activa y desactiva roles personalizados', async () => {
    const user = userEvent.setup()
    renderPage(<RolesPage />)
    await screen.findByText('Supervisor de recepción')
    const row = screen.getByText('Supervisor de recepción').closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Desactivar' }))

    await waitFor(() =>
      expect(logisticsApi.roles.changeStatus).toHaveBeenCalledWith('role-custom', {
        status: 'inactive',
      }),
    )
  })
})

describe('RolesPage · selector de permisos', () => {
  it('agrupa por dominio sin alterar el código canónico', async () => {
    const user = userEvent.setup()
    renderPage(<RolesPage />)
    await screen.findByText('Supervisor de recepción')
    await user.click(screen.getByRole('button', { name: 'Nuevo rol' }))

    expect(screen.getByRole('button', { name: /warehouses \(/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /warehouses \(/ }))
    expect(screen.getByText('logistics.warehouses.read')).toBeInTheDocument()
  })

  it('busca permisos por código', async () => {
    const user = userEvent.setup()
    renderPage(<RolesPage />)
    await screen.findByText('Supervisor de recepción')
    await user.click(screen.getByRole('button', { name: 'Nuevo rol' }))

    await user.type(screen.getByLabelText('Buscar permiso'), 'role_permissions')
    expect(await screen.findByText('logistics.role_permissions.update')).toBeInTheDocument()
    expect(screen.queryByText('logistics.warehouses.read')).not.toBeInTheDocument()
  })

  it('no ofrece un seleccionar-todo global', async () => {
    const user = userEvent.setup()
    renderPage(<RolesPage />)
    await screen.findByText('Supervisor de recepción')
    await user.click(screen.getByRole('button', { name: 'Nuevo rol' }))

    expect(
      screen.queryByRole('button', { name: /seleccionar todo/i }),
    ).not.toBeInTheDocument()
  })

  it('lleva la cuenta de permisos seleccionados', async () => {
    const user = userEvent.setup()
    renderPage(<RolesPage />)
    await screen.findByText('Supervisor de recepción')
    const row = screen.getByText('Supervisor de recepción').closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Editar' }))

    expect(screen.getByTestId('permission-selected-count')).toHaveTextContent(
      '1 seleccionados',
    )
  })
})

describe('RolesPage · matriz', () => {
  it('muestra la cobertura por dominio de cada rol', async () => {
    const user = userEvent.setup()
    renderPage(<RolesPage />)
    await screen.findByText('Supervisor de recepción')
    await user.click(screen.getByRole('button', { name: 'Matriz' }))

    const table = await screen.findByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'warehouses' })).toBeInTheDocument()
    const systemRow = within(table).getByText('Recepción').closest('tr') as HTMLElement
    expect(within(systemRow).getByText('2/2')).toBeInTheDocument()
  })
})

describe('RolesPage · errores', () => {
  it('explica un conflicto de separación de funciones', async () => {
    const user = userEvent.setup()
    vi.mocked(logisticsApi.roles.create).mockRejectedValue(
      new ApiRequestError(
        'Conflicto de separación de funciones entre PURCHASING y PURCHASING_APPROVER: quien origina no puede aprobar.',
        { code: 'SOD_CONFLICT', status: 409 },
      ),
    )
    renderPage(<RolesPage />)
    await screen.findByText('Supervisor de recepción')
    await user.click(screen.getByRole('button', { name: 'Nuevo rol' }))
    await user.type(screen.getByLabelText('Código'), 'CONFLICTO')
    await user.type(screen.getByLabelText('Nombre'), 'Rol en conflicto')
    await user.click(screen.getByRole('button', { name: 'Crear rol' }))

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByText(/separación de funciones/i),
    ).toBeInTheDocument()
  })

  it('explica un intento de escalación de privilegios', async () => {
    const user = userEvent.setup()
    vi.mocked(logisticsApi.roles.create).mockRejectedValue(
      new ApiRequestError('No puede otorgar permisos que usted mismo no tiene.', {
        code: 'PRIVILEGE_ESCALATION_DENIED',
        status: 403,
      }),
    )
    renderPage(<RolesPage />)
    await screen.findByText('Supervisor de recepción')
    await user.click(screen.getByRole('button', { name: 'Nuevo rol' }))
    await user.type(screen.getByLabelText('Código'), 'ESCALADA')
    await user.type(screen.getByLabelText('Nombre'), 'Rol escalada')
    await user.click(screen.getByRole('button', { name: 'Crear rol' }))

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByText(/no puede otorgar permisos/i),
    ).toBeInTheDocument()
  })

  it('explica un código duplicado', async () => {
    const user = userEvent.setup()
    vi.mocked(logisticsApi.roles.create).mockRejectedValue(
      new ApiRequestError("Ya existe un rol con el código 'LOGISTICS_CUSTOM_X'.", {
        code: 'ROLE_CODE_ALREADY_EXISTS',
        status: 409,
      }),
    )
    renderPage(<RolesPage />)
    await screen.findByText('Supervisor de recepción')
    await user.click(screen.getByRole('button', { name: 'Nuevo rol' }))
    await user.type(screen.getByLabelText('Código'), 'X')
    await user.type(screen.getByLabelText('Nombre'), 'Rol duplicado')
    await user.click(screen.getByRole('button', { name: 'Crear rol' }))

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText(/Ya existe un rol/)).toBeInTheDocument()
  })

  it('muestra un fallo de carga sin romper la página', async () => {
    vi.mocked(logisticsApi.roles.matrix).mockRejectedValue(
      new ApiRequestError('No tiene permisos para realizar esta acción.', {
        code: 'FORBIDDEN',
        status: 403,
      }),
    )
    renderPage(<RolesPage />)
    expect(await screen.findByText(/No tiene permisos/)).toBeInTheDocument()
  })
})
