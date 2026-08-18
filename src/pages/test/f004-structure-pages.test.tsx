/**
 * F004 — regresión de las pantallas de estructura organizacional.
 *
 * Los fixtures copian la forma REAL de la respuesta del backend: la lista de
 * almacenes viene paginada bajo `/branches/{id}/warehouses` y el DTO trae
 * `is_active`, no `status`. Inventar aquí un contrato cómodo sería repetir el
 * fallo que hizo que la pantalla de almacenes saliera siempre vacía.
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
import {
  LogisticsAuthorizationContext,
  type LogisticsAuthorizationState,
} from '../../features/logistics-permissions/contexts/logistics-authorization-context'
import { BranchesPage } from '../BranchesPage'
import { OrganizationsPage } from '../OrganizationsPage'
import { WarehousesPage } from '../WarehousesPage'

vi.mock('../../api/reference-catalogs-api', () => ({
  referenceCatalogsApi: {
    listCountries: vi.fn(async () => [{ code: 'PE', name: 'Perú' }]),
    listTimezones: vi.fn(async () => [
      { code: 'America/Lima', name: 'Lima', country_code: 'PE' },
    ]),
    listWarehouseTypes: vi.fn(async () => [{ code: 'general', name: 'General' }]),
  },
}))

vi.mock('../../api/logistics-api', () => ({
  logisticsApi: {
    organizations: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      changeStatus: vi.fn(),
      branches: vi.fn(),
    },
    branches: {
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      changeStatus: vi.fn(),
      warehouses: vi.fn(),
    },
    warehouses: {
      listByBranch: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      changeStatus: vi.fn(),
      setDefault: vi.fn(),
    },
  },
}))

const { logisticsApi } = await import('../../api/logistics-api')

const ORG_A = {
  id: 'org-aaaa',
  code: 'ORGA',
  name: 'Organización A',
  status: 'active',
  country_code: 'PE',
  timezone: 'America/Lima',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const ORG_B = { ...ORG_A, id: 'org-bbbb', code: 'ORGB', name: 'Organización B' }

const BRANCH = {
  id: 'branch-1111',
  organization_id: ORG_A.id,
  code: 'LIM',
  name: 'Sede Lima',
  status: 'active',
  timezone: 'America/Lima',
  address_text: null,
  latitude: null,
  longitude: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

/** Copia exacta de `LogisticsWarehouseResponse`: `is_active`, sin `status`. */
const WAREHOUSE = {
  id: 'wh-1111',
  organization_id: ORG_A.id,
  branch_id: BRANCH.id,
  code: 'WH-LIM-01',
  name: 'Almacén Lima Uno',
  warehouse_type: 'general',
  address: 'Av. Operaciones 100',
  district: 'Ate',
  province: 'Lima',
  department: 'Lima',
  capacity: null,
  is_default: false,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function page<T>(items: T[]) {
  return { items, page: 1, page_size: 20, total: items.length, total_pages: 1 }
}

function access(): LogisticsAccessState {
  return {
    ...defaultLogisticsAccessState,
    isLoading: false,
    isLogisticsEnabled: true,
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
    canAccessOrganization: () => true,
    canAccessBranch: () => true,
    canAccessWarehouse: () => true,
  }
}

function authorization(): LogisticsAuthorizationState {
  return {
    isLoading: false,
    isError: false,
    error: null,
    permissions: new Set<string>(),
    sensitivePermissions: new Set<string>(),
    stepUpPermissions: new Set<string>(),
    roles: [],
    context: { organization_id: null, branch_id: null, warehouse_id: null },
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
    canAccessScope: () => true,
    refresh: async () => undefined,
  } as unknown as LogisticsAuthorizationState
}

function renderPage(ui: ReactElement) {
  return render(
    <I18nContext.Provider value={createI18nValue()}>
      <MemoryRouter>
        <LogisticsAuthorizationContext.Provider value={authorization()}>
          <LogisticsAccessContext.Provider value={access()}>
            {ui}
          </LogisticsAccessContext.Provider>
        </LogisticsAuthorizationContext.Provider>
      </MemoryRouter>
    </I18nContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(logisticsApi.organizations.list).mockResolvedValue(page([ORG_A, ORG_B]))
  vi.mocked(logisticsApi.organizations.branches).mockResolvedValue(page([BRANCH]))
  vi.mocked(logisticsApi.organizations.update).mockResolvedValue(ORG_A)
  vi.mocked(logisticsApi.organizations.changeStatus).mockResolvedValue(ORG_A)
  vi.mocked(logisticsApi.branches.create).mockResolvedValue(BRANCH)
  vi.mocked(logisticsApi.branches.update).mockResolvedValue(BRANCH)
  vi.mocked(logisticsApi.branches.changeStatus).mockResolvedValue(BRANCH)
  vi.mocked(logisticsApi.warehouses.listByBranch).mockResolvedValue(page([WAREHOUSE]))
  vi.mocked(logisticsApi.warehouses.create).mockResolvedValue(WAREHOUSE)
  vi.mocked(logisticsApi.warehouses.get).mockResolvedValue(WAREHOUSE)
})

// ---------------------------------------------------------------------------
// Organizaciones
// ---------------------------------------------------------------------------

describe('OrganizationsPage', () => {
  it('lista las organizaciones devueltas por el backend', async () => {
    renderPage(<OrganizationsPage />)
    expect(await screen.findByText('Organización A')).toBeInTheDocument()
    expect(screen.getByText('Organización B')).toBeInTheDocument()
  })

  it('edita la organización sobre la que se pulsó', async () => {
    const user = userEvent.setup()
    renderPage(<OrganizationsPage />)
    await screen.findByText('Organización B')

    const rowB = screen.getByText('Organización B').closest('tr') as HTMLElement
    await user.click(within(rowB).getByRole('button', { name: 'Editar' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(logisticsApi.organizations.update).toHaveBeenCalledWith(
        ORG_B.id,
        expect.objectContaining({ name: ORG_B.name }),
      ),
    )
  })

  it('cambia el estado de la fila pulsada aunque antes se abriera el editor de otra', async () => {
    // Regresión del defecto `editing?.id ?? org.id`: al cerrar el diálogo de A,
    // `editing` seguía apuntando a A y el PATCH de estado de B iba contra A.
    const user = userEvent.setup()
    renderPage(<OrganizationsPage />)
    await screen.findByText('Organización A')

    const rowA = screen.getByText('Organización A').closest('tr') as HTMLElement
    await user.click(within(rowA).getByRole('button', { name: 'Editar' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    const rowB = screen.getByText('Organización B').closest('tr') as HTMLElement
    await user.click(within(rowB).getByRole('button', { name: 'Desactivar' }))

    await waitFor(() =>
      expect(logisticsApi.organizations.changeStatus).toHaveBeenCalledWith(ORG_B.id, {
        status: 'inactive',
      }),
    )
  })

  it('muestra el error de la API sin romper la página', async () => {
    vi.mocked(logisticsApi.organizations.list).mockRejectedValue(
      new ApiRequestError('No tiene acceso a esta organización.', {
        code: 'FORBIDDEN',
        status: 403,
      }),
    )
    renderPage(<OrganizationsPage />)
    expect(
      await screen.findByText(/No tiene acceso a esta organización/),
    ).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Sedes
// ---------------------------------------------------------------------------

describe('BranchesPage', () => {
  it('crea una sede con la organización tomada del selector, sin pedir UUID', async () => {
    const user = userEvent.setup()
    renderPage(<BranchesPage />)
    await screen.findByText('Sede Lima')

    await user.click(screen.getByRole('button', { name: 'Nueva sede' }))
    // F005.1 quitó el campo Código: lo genera el backend.
    await user.type(screen.getByLabelText('Nombre'), 'Sede Arequipa')
    await user.click(screen.getByRole('button', { name: 'Crear sede' }))

    await waitFor(() =>
      expect(logisticsApi.branches.create).toHaveBeenCalledWith(
        ORG_A.id,
        expect.objectContaining({ name: 'Sede Arequipa' }),
      ),
    )
    // El formulario nunca expone un campo de UUID de organización.
    expect(screen.queryByLabelText(/organization_id/i)).not.toBeInTheDocument()
  })

  it('desactiva la sede pulsada', async () => {
    const user = userEvent.setup()
    renderPage(<BranchesPage />)
    await screen.findByText('Sede Lima')

    await user.click(screen.getByRole('button', { name: 'Desactivar' }))

    await waitFor(() =>
      expect(logisticsApi.branches.changeStatus).toHaveBeenCalledWith(BRANCH.id, {
        status: 'inactive',
      }),
    )
  })

  it('edita la sede mediante PATCH', async () => {
    const user = userEvent.setup()
    renderPage(<BranchesPage />)
    await screen.findByText('Sede Lima')

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(logisticsApi.branches.update).toHaveBeenCalledWith(
        BRANCH.id,
        expect.objectContaining({ name: BRANCH.name }),
      ),
    )
  })
})

// ---------------------------------------------------------------------------
// Almacenes
// ---------------------------------------------------------------------------

describe('WarehousesPage', () => {
  it('encadena organización -> sede -> listado por sede', async () => {
    renderPage(<WarehousesPage />)

    await waitFor(() =>
      expect(logisticsApi.organizations.branches).toHaveBeenCalledWith(
        ORG_A.id,
        expect.anything(),
      ),
    )
    await waitFor(() =>
      expect(logisticsApi.warehouses.listByBranch).toHaveBeenCalledWith(
        BRANCH.id,
        expect.anything(),
      ),
    )
    expect(await screen.findByText('Almacén Lima Uno')).toBeInTheDocument()
  })

  it('consume el sobre paginado real y no deriva NaN', async () => {
    renderPage(<WarehousesPage />)
    await screen.findByText('Almacén Lima Uno')

    const pagination = screen.getByLabelText('Paginación')
    expect(pagination.textContent).toContain('Página 1 de 1')
    expect(pagination.textContent).toContain('1 registros')
    expect(pagination.textContent).not.toContain('NaN')
    expect(pagination.textContent).not.toContain('undefined')
  })

  it('pinta el estado desde is_active, que es lo que emite el backend', async () => {
    vi.mocked(logisticsApi.warehouses.listByBranch).mockResolvedValue(
      page([{ ...WAREHOUSE, is_active: false }]),
    )
    renderPage(<WarehousesPage />)
    expect(await screen.findByText('Inactivo')).toBeInTheDocument()
  })

  it('crea el almacén con la sede en la ruta y sin organization_id en el cuerpo', async () => {
    const user = userEvent.setup()
    renderPage(<WarehousesPage />)
    await screen.findByText('Almacén Lima Uno')

    await user.click(screen.getByRole('button', { name: 'Nuevo almacén' }))
    // F005.1: ni código ni geografía manual; la ubicación sale de la sede.
    await user.type(screen.getByLabelText('Nombre'), 'Almacén UAT F004')
    await user.type(screen.getByLabelText('Dirección / referencia'), 'Nave B')
    await user.click(screen.getByRole('button', { name: 'Crear almacén' }))

    await waitFor(() => expect(logisticsApi.warehouses.create).toHaveBeenCalled())
    const [branchId, body] = vi.mocked(logisticsApi.warehouses.create).mock.calls[0]
    expect(branchId).toBe(BRANCH.id)
    expect(body).toMatchObject({
      name: 'Almacén UAT F004',
      warehouse_type: 'general',
    })
    expect(body).not.toHaveProperty('organization_id')
    expect(body).not.toHaveProperty('branch_id')
    expect(body).not.toHaveProperty('code')
    expect(body).not.toHaveProperty('district')
  })

  it('muestra el error de creación dentro del diálogo, no detrás del modal', async () => {
    // Un 409 de código duplicado se renderizaba en el Alert de la página, que queda
    // tapado por el modal: el usuario veía el formulario intacto y ningún motivo.
    const user = userEvent.setup()
    vi.mocked(logisticsApi.warehouses.create).mockRejectedValue(
      new ApiRequestError('El código de almacén ya existe en esta sede.', {
        code: 'WAREHOUSE_CODE_CONFLICT',
        status: 409,
      }),
    )
    renderPage(<WarehousesPage />)
    await screen.findByText('Almacén Lima Uno')

    await user.click(screen.getByRole('button', { name: 'Nuevo almacén' }))
    await user.type(screen.getByLabelText('Nombre'), 'Duplicado')
    await user.click(screen.getByRole('button', { name: 'Crear almacén' }))

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByText(/El código de almacén ya existe/),
    ).toBeInTheDocument()
    // Y el diálogo sigue abierto para poder corregir.
    expect(within(dialog).getByLabelText('Nombre')).toBeInTheDocument()
  })

  it('explica el vacío cuando la sede no tiene almacenes', async () => {
    vi.mocked(logisticsApi.warehouses.listByBranch).mockResolvedValue(page([]))
    renderPage(<WarehousesPage />)
    await waitFor(() => expect(logisticsApi.warehouses.listByBranch).toHaveBeenCalled())
    expect(screen.queryByText('Almacén Lima Uno')).not.toBeInTheDocument()
  })

  it('pide seleccionar sede cuando la organización no tiene ninguna', async () => {
    vi.mocked(logisticsApi.organizations.branches).mockResolvedValue(page([]))
    renderPage(<WarehousesPage />)
    expect(
      await screen.findByText(/no tiene sedes/i),
    ).toBeInTheDocument()
    expect(logisticsApi.warehouses.listByBranch).not.toHaveBeenCalled()
  })

  it('muestra el error de la API sin romper la página', async () => {
    vi.mocked(logisticsApi.warehouses.listByBranch).mockRejectedValue(
      new ApiRequestError('No tiene acceso a esta organización.', {
        code: 'FORBIDDEN',
        status: 403,
      }),
    )
    renderPage(<WarehousesPage />)
    expect(
      await screen.findByText(/No tiene acceso a esta organización/),
    ).toBeInTheDocument()
  })
})
