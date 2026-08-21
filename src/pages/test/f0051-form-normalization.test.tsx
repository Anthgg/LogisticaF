/**
 * F005.1 — formularios normalizados.
 *
 * Lo que se comprueba aquí es sobre todo lo que la UI **deja de hacer**: no pide
 * códigos, no pide geografía manual del almacén y no manda ninguna de las dos cosas
 * en la petición. Es lo que impide volver a registrar un almacén de una sede de
 * Lima declarando Arequipa.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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
import { BranchFormPage } from '../BranchFormPage'
import { OrganizationFormPage } from '../OrganizationFormPage'
import { OrganizationsPage } from '../OrganizationsPage'
import { WarehouseFormPage } from '../WarehouseFormPage'
import { WarehousesPage } from '../WarehousesPage'

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
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      changeStatus: vi.fn(),
      setDefault: vi.fn(),
    },
  },
}))

vi.mock('../../api/reference-catalogs-api', () => ({
  referenceCatalogsApi: {
    listCountries: vi.fn(),
    listTimezones: vi.fn(),
    listWarehouseTypes: vi.fn(),
  },
}))

vi.mock('../../api/geography-api', () => ({
  geographyApi: {
    listDepartments: vi.fn(),
    listProvincesByDepartment: vi.fn(),
    listDistrictsByProvince: vi.fn(),
    getDistrictByCode: vi.fn(),
  },
}))

// geocoding-api needed by LocationPicker (rendered inside BranchesPage dialog)
vi.mock('../../api/geocoding-api', () => ({
  geocodingApi: {
    search: vi.fn().mockResolvedValue({ success: true, data: { results: [], count: 0 } }),
    reverse: vi.fn().mockResolvedValue({ success: true, data: null }),
  },
  wgs84ToMapLibreLngLat: (lat: number, lon: number) => [lon, lat],
  mapLibreLngLatToWgs84: (lngLat: { lng: number; lat: number }) => [lngLat.lat, lngLat.lng],
}))

const { logisticsApi } = await import('../../api/logistics-api')
const { referenceCatalogsApi } = await import('../../api/reference-catalogs-api')
const { geographyApi } = await import('../../api/geography-api')

const COUNTRIES = [
  { code: 'PE', name: 'Perú' },
  { code: 'CL', name: 'Chile' },
]
const TIMEZONES_PE = [
  { code: 'America/Lima', name: 'Lima', country_code: 'PE' },
  { code: 'UTC', name: 'UTC', country_code: '' },
]
const TIMEZONES_CL = [
  { code: 'America/Santiago', name: 'Santiago', country_code: 'CL' },
  { code: 'UTC', name: 'UTC', country_code: '' },
]
const WAREHOUSE_TYPES = [
  { code: 'general', name: 'General' },
  { code: 'receiving', name: 'Recepción' },
]

const ORG = {
  id: 'org-1',
  code: 'ORG000001',
  name: 'Andes Logistics',
  status: 'active',
  country_code: 'PE',
  timezone: 'America/Lima',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const UBIGEO = {
  code: '150122',
  department_code: '15',
  department_name: 'Lima',
  province_code: '1501',
  province_name: 'Lima',
  district_name: 'Miraflores',
  formatted: 'Miraflores, Lima, Lima',
}

const BRANCH = {
  id: 'branch-1',
  organization_id: ORG.id,
  code: 'SED000001',
  name: 'Lima Sur',
  status: 'active',
  timezone: 'America/Lima',
  ubigeo_code: '150122',
  ubigeo: UBIGEO,
  address_text: null,
  latitude: null,
  longitude: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const WAREHOUSE = {
  id: 'wh-1',
  organization_id: ORG.id,
  branch_id: BRANCH.id,
  code: 'ALM000001',
  name: 'Almacén Central',
  warehouse_type: 'general',
  address: 'Nave B',
  district: 'Miraflores',
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
            <Routes>
              <Route path="/logistics/organizations/new" element={<OrganizationFormPage />} />
              <Route path="/logistics/organizations/:organizationId/edit" element={<OrganizationFormPage />} />
              <Route path="/logistics/branches/new" element={<BranchFormPage />} />
              <Route path="/logistics/branches/:branchId/edit" element={<BranchFormPage />} />
              <Route path="/logistics/warehouses/new" element={<WarehouseFormPage />} />
              <Route path="/logistics/warehouses/:warehouseId/edit" element={<WarehouseFormPage />} />
              <Route path="*" element={ui} />
            </Routes>
          </LogisticsAccessContext.Provider>
        </LogisticsAuthorizationContext.Provider>
      </MemoryRouter>
    </I18nContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(logisticsApi.organizations.list).mockResolvedValue(page([ORG]))
  vi.mocked(logisticsApi.organizations.get).mockResolvedValue(ORG)
  vi.mocked(logisticsApi.organizations.branches).mockResolvedValue(page([BRANCH]))
  vi.mocked(logisticsApi.organizations.create).mockResolvedValue(ORG)
  vi.mocked(logisticsApi.organizations.update).mockResolvedValue(ORG)
  vi.mocked(logisticsApi.branches.create).mockResolvedValue(BRANCH)
  vi.mocked(logisticsApi.branches.get).mockResolvedValue(BRANCH)
  vi.mocked(logisticsApi.branches.update).mockResolvedValue(BRANCH)
  vi.mocked(logisticsApi.warehouses.listByBranch).mockResolvedValue(page([WAREHOUSE]))
  vi.mocked(logisticsApi.warehouses.create).mockResolvedValue(WAREHOUSE)
  vi.mocked(logisticsApi.warehouses.getById).mockResolvedValue(WAREHOUSE)
  vi.mocked(logisticsApi.warehouses.update).mockResolvedValue(WAREHOUSE)
  vi.mocked(referenceCatalogsApi.listCountries).mockResolvedValue(COUNTRIES)
  vi.mocked(referenceCatalogsApi.listTimezones).mockImplementation(
    async (countryCode?: string) => (countryCode === 'CL' ? TIMEZONES_CL : TIMEZONES_PE),
  )
  vi.mocked(referenceCatalogsApi.listWarehouseTypes).mockResolvedValue(WAREHOUSE_TYPES)
  vi.mocked(geographyApi.listDepartments).mockResolvedValue([{ code: '15', name: 'Lima' }])
  vi.mocked(geographyApi.listProvincesByDepartment).mockResolvedValue([
    { code: '1501', department_code: '15', name: 'Lima' },
  ])
  vi.mocked(geographyApi.listDistrictsByProvince).mockResolvedValue([
    { code: '150122', province_code: '1501', department_code: '15', name: 'Miraflores' },
  ])
})

// ---------------------------------------------------------------------------
// Organizaciones
// ---------------------------------------------------------------------------

describe('OrganizationsPage · F005.1', () => {
  it('abre la ruta dedicada y muestra el preview cartográfico del país sin modal', async () => {
    const user = userEvent.setup()
    renderPage(<OrganizationsPage />)
    await screen.findByText('Andes Logistics')
    await user.click(screen.getByRole('button', { name: 'Nueva organización' }))

    expect(await screen.findByRole('heading', { name: 'Nueva organización' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('country-map-preview')).toHaveTextContent('Perú (PE)')
    expect(screen.getByLabelText('Mapa de contexto de Perú')).toBeInTheDocument()
  })

  it('no ofrece un campo de código editable al crear', async () => {
    const user = userEvent.setup()
    renderPage(<OrganizationsPage />)
    await screen.findByText('Andes Logistics')
    await user.click(screen.getByRole('button', { name: 'Nueva organización' }))

    expect(screen.queryByLabelText('Código')).not.toBeInTheDocument()
    expect(screen.getByText('Se generará automáticamente')).toBeInTheDocument()
  })

  it('usa selects para país y zona horaria, no texto libre', async () => {
    const user = userEvent.setup()
    renderPage(<OrganizationsPage />)
    await screen.findByText('Andes Logistics')
    await user.click(screen.getByRole('button', { name: 'Nueva organización' }))

    await waitFor(() => expect(referenceCatalogsApi.listCountries).toHaveBeenCalled())
    const country = screen.getByLabelText('País')
    expect(country.tagName).toBe('SELECT')
    expect(within(country).getByRole('option', { name: 'Perú' })).toBeInTheDocument()

    const timezone = screen.getByLabelText('Zona horaria')
    expect(timezone.tagName).toBe('SELECT')
  })

  it('no envía el código al crear', async () => {
    const user = userEvent.setup()
    renderPage(<OrganizationsPage />)
    await screen.findByText('Andes Logistics')
    await user.click(screen.getByRole('button', { name: 'Nueva organización' }))
    await waitFor(() => expect(referenceCatalogsApi.listCountries).toHaveBeenCalled())
    await user.type(screen.getByLabelText('Nombre'), 'Nueva Org')
    await user.click(screen.getByRole('button', { name: 'Crear organización' }))

    await waitFor(() => expect(logisticsApi.organizations.create).toHaveBeenCalled())
    const [body] = vi.mocked(logisticsApi.organizations.create).mock.calls[0]
    // Omitido, no vacío: el backend distingue ambas cosas.
    expect(body).not.toHaveProperty('code')
    expect(body).toMatchObject({ country_code: 'PE', timezone: 'America/Lima' })
  })

  it('al editar muestra el código existente en solo lectura', async () => {
    const user = userEvent.setup()
    renderPage(<OrganizationsPage />)
    await screen.findByText('Andes Logistics')
    await user.click(screen.getByRole('button', { name: 'Editar' }))

    const field = screen.getByTestId('entity-code-field')
    expect(within(field).getByText('ORG000001')).toBeInTheDocument()
    expect(screen.queryByLabelText('Código')).not.toBeInTheDocument()
  })

  it('limpia la zona horaria si deja de pertenecer al país elegido', async () => {
    const user = userEvent.setup()
    renderPage(<OrganizationsPage />)
    await screen.findByText('Andes Logistics')
    await user.click(screen.getByRole('button', { name: 'Nueva organización' }))
    await waitFor(() => expect(referenceCatalogsApi.listCountries).toHaveBeenCalled())

    await user.selectOptions(screen.getByLabelText('País'), 'CL')
    await waitFor(() =>
      expect(referenceCatalogsApi.listTimezones).toHaveBeenCalledWith('CL'),
    )
    // America/Lima no está en el catálogo chileno: mantenerla sería imposible.
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLSelectElement>('Zona horaria').value).toBe(''),
    )
  })
})

// ---------------------------------------------------------------------------
// Sedes
// ---------------------------------------------------------------------------

describe('BranchesPage · F005.1', () => {
  it('no pide código y anuncia que se genera', async () => {
    const user = userEvent.setup()
    renderPage(<BranchesPage />)
    await screen.findByText('Lima Sur')
    await user.click(screen.getByRole('button', { name: 'Nueva sede' }))

    expect(screen.queryByLabelText('Código')).not.toBeInTheDocument()
    expect(screen.getByText('Se generará automáticamente')).toBeInTheDocument()
  })

  it('usa select para la zona horaria', async () => {
    const user = userEvent.setup()
    renderPage(<BranchesPage />)
    await screen.findByText('Lima Sur')
    await user.click(screen.getByRole('button', { name: 'Nueva sede' }))

    await waitFor(() => expect(referenceCatalogsApi.listTimezones).toHaveBeenCalled())
    expect(screen.getByLabelText('Zona horaria').tagName).toBe('SELECT')
  })

  it('no envía el código al crear', async () => {
    const user = userEvent.setup()
    renderPage(<BranchesPage />)
    await screen.findByText('Lima Sur')
    await user.click(screen.getByRole('button', { name: 'Nueva sede' }))
    await user.type(screen.getByLabelText('Nombre'), 'Sede Norte')
    await user.click(screen.getByRole('button', { name: 'Crear sede' }))

    await waitFor(() => expect(logisticsApi.branches.create).toHaveBeenCalled())
    const [, body] = vi.mocked(logisticsApi.branches.create).mock.calls[0]
    expect(body).not.toHaveProperty('code')
  })

  it('conserva el selector UBIGEO de F004.5', async () => {
    const user = userEvent.setup()
    renderPage(<BranchesPage />)
    await screen.findByText('Lima Sur')
    await user.click(screen.getByRole('button', { name: 'Nueva sede' }))

    await waitFor(() => expect(geographyApi.listDepartments).toHaveBeenCalled())
    expect(screen.getByLabelText('Departamento')).toBeInTheDocument()
    expect(screen.getByLabelText('Provincia')).toBeInTheDocument()
    expect(screen.getByLabelText('Distrito')).toBeInTheDocument()
  })

  it('al editar muestra el código existente en solo lectura', async () => {
    const user = userEvent.setup()
    renderPage(<BranchesPage />)
    await screen.findByText('Lima Sur')
    await user.click(screen.getByRole('button', { name: 'Editar' }))

    const field = screen.getByTestId('entity-code-field')
    expect(within(field).getByText('SED000001')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Almacenes
// ---------------------------------------------------------------------------

describe('WarehousesPage · F005.1', () => {
  it('abre la página dedicada en modo heredado por defecto y sin modal', async () => {
    const user = userEvent.setup()
    renderPage(<WarehousesPage />)
    await screen.findByText('Almacén Central')
    await user.click(screen.getByRole('button', { name: 'Nuevo almacén' }))

    expect(await screen.findByRole('heading', { name: 'Nuevo almacén' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Usar ubicación de la sede/ })).toBeChecked()
    expect(screen.getByTestId('warehouse-inherited-location')).toBeInTheDocument()
    expect(screen.getByLabelText('Mapa de ubicación heredada de la sede')).toBeInTheDocument()
  })

  it('exige confirmación y envía coordenadas propias del almacén', async () => {
    const user = userEvent.setup()
    renderPage(<WarehousesPage />)
    await screen.findByText('Almacén Central')
    await user.click(screen.getByRole('button', { name: 'Nuevo almacén' }))
    await screen.findByRole('heading', { name: 'Nuevo almacén' })

    await user.click(screen.getByRole('checkbox', { name: /Usar ubicación de la sede/ }))
    expect(screen.getByTestId('warehouse-custom-location')).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: 'Crear almacén' })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('Nombre'), 'Almacén con punto propio')
    await user.type(screen.getByLabelText('Latitud'), '-12.3456789')
    await user.tab()
    await user.clear(screen.getByLabelText('Longitud'))
    await user.type(screen.getByLabelText('Longitud'), '-77.3456789')
    await user.tab()
    await user.click(screen.getByRole('button', { name: 'Confirmar esta ubicación' }))
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)

    await waitFor(() => expect(logisticsApi.warehouses.create).toHaveBeenCalled())
    expect(vi.mocked(logisticsApi.warehouses.create).mock.calls[0]).toEqual([
      BRANCH.id,
      expect.objectContaining({
        name: 'Almacén con punto propio',
        uses_branch_location: false,
        latitude: -12.3456789,
        longitude: -77.3456789,
      }),
    ])
  })

  it('al editar custom y volver a heredado envía coordenadas nulas', async () => {
    const user = userEvent.setup()
    vi.mocked(logisticsApi.warehouses.getById).mockResolvedValue({
      ...WAREHOUSE,
      uses_branch_location: false,
      latitude: -12.4444444,
      longitude: -77.4444444,
      effective_latitude: -12.4444444,
      effective_longitude: -77.4444444,
      location_source: 'WAREHOUSE',
    })
    renderPage(<WarehousesPage />)
    const warehouseName = await screen.findByText('Almacén Central')
    const row = warehouseName.closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Editar' }))

    expect(await screen.findByRole('heading', { name: 'Editar almacén' })).toBeInTheDocument()
    const inherited = screen.getByRole('checkbox', { name: /Usar ubicación de la sede/ })
    expect(inherited).not.toBeChecked()
    await user.click(inherited)
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(logisticsApi.warehouses.update).toHaveBeenCalledWith(
        BRANCH.id,
        WAREHOUSE.id,
        expect.objectContaining({
          uses_branch_location: true,
          latitude: null,
          longitude: null,
        }),
      ),
    )
  })

  it('trae los tipos del backend, sin lista embebida', async () => {
    const user = userEvent.setup()
    renderPage(<WarehousesPage />)
    await screen.findByText('Almacén Central')
    await user.click(screen.getByRole('button', { name: 'Nuevo almacén' }))

    await waitFor(() =>
      expect(referenceCatalogsApi.listWarehouseTypes).toHaveBeenCalled(),
    )
    const select = screen.getByLabelText('Tipo')
    expect(within(select).getByRole('option', { name: 'Recepción' })).toBeInTheDocument()
  })

  it('ya no pide distrito, provincia ni departamento', async () => {
    const user = userEvent.setup()
    renderPage(<WarehousesPage />)
    await screen.findByText('Almacén Central')
    await user.click(screen.getByRole('button', { name: 'Nuevo almacén' }))

    // No basta con ocultarlos: no deben existir en el árbol.
    expect(screen.queryByLabelText('Distrito')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Provincia')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Departamento')).not.toBeInTheDocument()
  })

  it('muestra la ubicación heredada de la sede', async () => {
    const user = userEvent.setup()
    renderPage(<WarehousesPage />)
    await screen.findByText('Almacén Central')
    await user.click(screen.getByRole('button', { name: 'Nuevo almacén' }))

    expect(screen.getByTestId('warehouse-inherited-location')).toHaveTextContent(
      'Miraflores, Lima, Lima',
    )
  })

  it('avisa cuando la sede aún no tiene UBIGEO', async () => {
    const user = userEvent.setup()
    vi.mocked(logisticsApi.organizations.branches).mockResolvedValue(
      page([{ ...BRANCH, ubigeo_code: null, ubigeo: null }]),
    )
    renderPage(<WarehousesPage />)
    await screen.findByText('Almacén Central')
    await user.click(screen.getByRole('button', { name: 'Nuevo almacén' }))

    expect(screen.getByTestId('warehouse-inherited-location')).toHaveTextContent(
      'UBIGEO pendiente',
    )
    // Y no reaparecen los campos manuales como alternativa.
    expect(screen.queryByLabelText('Distrito')).not.toBeInTheDocument()
  })

  it('no envía código ni geografía al crear', async () => {
    const user = userEvent.setup()
    renderPage(<WarehousesPage />)
    await screen.findByText('Almacén Central')
    await user.click(screen.getByRole('button', { name: 'Nuevo almacén' }))
    await waitFor(() =>
      expect(referenceCatalogsApi.listWarehouseTypes).toHaveBeenCalled(),
    )
    await user.type(screen.getByLabelText('Nombre'), 'Almacén Nuevo')
    await user.type(screen.getByLabelText('Dirección / referencia del almacén'), 'Nave B — Puerta 4')
    await user.click(screen.getByRole('button', { name: 'Crear almacén' }))

    await waitFor(() => expect(logisticsApi.warehouses.create).toHaveBeenCalled())
    const [branchId, body] = vi.mocked(logisticsApi.warehouses.create).mock.calls[0]
    expect(branchId).toBe(BRANCH.id)
    expect(body).not.toHaveProperty('code')
    // El caso crítico de la fase: la UI no puede contradecir a la sede.
    expect(body).not.toHaveProperty('district')
    expect(body).not.toHaveProperty('province')
    expect(body).not.toHaveProperty('department')
    expect(body).toMatchObject({ name: 'Almacén Nuevo', warehouse_type: 'general' })
  })

  it('no ofrece un campo de código editable', async () => {
    const user = userEvent.setup()
    renderPage(<WarehousesPage />)
    await screen.findByText('Almacén Central')
    await user.click(screen.getByRole('button', { name: 'Nuevo almacén' }))

    expect(screen.queryByLabelText('Código')).not.toBeInTheDocument()
    expect(screen.getByText('Se generará automáticamente')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Selectores de catálogo
// ---------------------------------------------------------------------------

describe('Selectores de catálogo · estados', () => {
  it('muestra el estado de carga', async () => {
    const user = userEvent.setup()
    vi.mocked(referenceCatalogsApi.listCountries).mockImplementation(
      () => new Promise(() => {}),
    )
    renderPage(<OrganizationsPage />)
    await screen.findByText('Andes Logistics')
    await user.click(screen.getByRole('button', { name: 'Nueva organización' }))

    expect(screen.getByLabelText('País')).toBeDisabled()
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })

  it('explica un fallo de carga del catálogo', async () => {
    const user = userEvent.setup()
    vi.mocked(referenceCatalogsApi.listCountries).mockRejectedValue(
      new ApiRequestError('No se pudo cargar el catálogo de países.', {
        code: 'INTERNAL_ERROR',
        status: 503,
      }),
    )
    renderPage(<OrganizationsPage />)
    await screen.findByText('Andes Logistics')
    await user.click(screen.getByRole('button', { name: 'Nueva organización' }))

    expect(
      await screen.findByText(/No se pudo cargar el catálogo de países/),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('País')).toBeDisabled()
  })

  it('avisa cuando el catálogo llega vacío', async () => {
    const user = userEvent.setup()
    vi.mocked(referenceCatalogsApi.listCountries).mockResolvedValue([])
    renderPage(<OrganizationsPage />)
    await screen.findByText('Andes Logistics')
    await user.click(screen.getByRole('button', { name: 'Nueva organización' }))

    expect(await screen.findByText('Sin países')).toBeInTheDocument()
  })
})
