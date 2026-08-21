/**
 * F004.5 — selectores jerárquicos de UBIGEO en el formulario de sede.
 *
 * Los fixtures copian la forma real que emite el backend
 * (`app/modules/logistics/geography/schemas.py`): el catálogo devuelve arrays
 * planos con `code`/`name`, y la sede trae la jerarquía ya resuelta en `ubigeo`.
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
      branches: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      changeStatus: vi.fn(),
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
const { geographyApi } = await import('../../api/geography-api')

const ORG = {
  id: 'org-aaaa',
  code: 'ORGA',
  name: 'Organización A',
  status: 'active',
  country_code: 'PE',
  timezone: 'America/Lima',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const UBIGEO_MIRAFLORES = {
  code: '150122',
  department_code: '15',
  department_name: 'Lima',
  province_code: '1501',
  province_name: 'Lima',
  district_name: 'Miraflores',
  formatted: 'Miraflores, Lima, Lima',
}

const BRANCH = {
  id: 'branch-1111',
  organization_id: ORG.id,
  code: 'LIM',
  name: 'Sede Lima',
  status: 'active',
  timezone: 'America/Lima',
  ubigeo_code: '150122',
  ubigeo: UBIGEO_MIRAFLORES,
  address_text: 'Av. José Larco 123',
  latitude: null,
  longitude: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const DEPARTMENTS = [
  { code: '15', name: 'Lima' },
  { code: '04', name: 'Arequipa' },
]
const PROVINCES_LIMA = [
  { code: '1501', department_code: '15', name: 'Lima' },
  { code: '1502', department_code: '15', name: 'Barranca' },
]
const DISTRICTS_LIMA = [
  { code: '150101', province_code: '1501', department_code: '15', name: 'Lima' },
  { code: '150122', province_code: '1501', department_code: '15', name: 'Miraflores' },
]

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

function renderPage(ui: ReactElement, initialEntry = '/logistics/branches') {
  return render(
    <I18nContext.Provider value={createI18nValue()}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <LogisticsAuthorizationContext.Provider value={authorization()}>
          <LogisticsAccessContext.Provider value={access()}>
            {ui}
          </LogisticsAccessContext.Provider>
        </LogisticsAuthorizationContext.Provider>
      </MemoryRouter>
    </I18nContext.Provider>,
  )
}

function renderCreateForm() {
  return renderPage(
    <Routes>
      <Route path="/logistics/branches/new" element={<BranchFormPage />} />
      <Route path="/logistics/branches" element={<BranchesPage />} />
    </Routes>,
    `/logistics/branches/new?organizationId=${ORG.id}`,
  )
}

function renderEditForm() {
  return renderPage(
    <Routes>
      <Route path="/logistics/branches/:branchId/edit" element={<BranchFormPage />} />
      <Route path="/logistics/branches" element={<BranchesPage />} />
    </Routes>,
    `/logistics/branches/${BRANCH.id}/edit`,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(logisticsApi.organizations.list).mockResolvedValue(page([ORG]))
  vi.mocked(logisticsApi.organizations.branches).mockResolvedValue(page([BRANCH]))
  vi.mocked(logisticsApi.branches.get).mockResolvedValue(BRANCH)
  vi.mocked(logisticsApi.branches.create).mockResolvedValue(BRANCH)
  vi.mocked(logisticsApi.branches.update).mockResolvedValue(BRANCH)
  vi.mocked(geographyApi.listDepartments).mockResolvedValue(DEPARTMENTS)
  vi.mocked(geographyApi.listProvincesByDepartment).mockResolvedValue(PROVINCES_LIMA)
  vi.mocked(geographyApi.listDistrictsByProvince).mockResolvedValue(DISTRICTS_LIMA)
})

describe('F004.5 · ubicación normalizada de sede', () => {
  it('muestra la jerarquía resuelta en el listado, no el código', async () => {
    renderPage(<BranchesPage />)
    expect(await screen.findByText('Miraflores, Lima, Lima')).toBeInTheDocument()
  })

  it('indica cuándo una sede aún no tiene ubicación normalizada', async () => {
    vi.mocked(logisticsApi.organizations.branches).mockResolvedValue(
      page([{ ...BRANCH, ubigeo_code: null, ubigeo: null }]),
    )
    renderPage(<BranchesPage />)
    expect(await screen.findByText(/Pendiente de normalizar/)).toBeInTheDocument()
  })

  it('carga los departamentos desde el backend, sin listas embebidas', async () => {
    renderCreateForm()

    await waitFor(() => expect(geographyApi.listDepartments).toHaveBeenCalled())
    const department = screen.getByLabelText('Departamento')
    expect(within(department).getByRole('option', { name: 'Lima' })).toBeInTheDocument()
    expect(within(department).getByRole('option', { name: 'Arequipa' })).toBeInTheDocument()
  })

  it('encadena departamento → provincia → distrito', async () => {
    const user = userEvent.setup()
    renderCreateForm()
    await waitFor(() => expect(geographyApi.listDepartments).toHaveBeenCalled())

    // Provincia y distrito arrancan deshabilitados: no hay nada que elegir todavía.
    expect(screen.getByLabelText('Provincia')).toBeDisabled()
    expect(screen.getByLabelText('Distrito')).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Departamento'), '15')
    await waitFor(() =>
      expect(geographyApi.listProvincesByDepartment).toHaveBeenCalledWith('15'),
    )
    expect(screen.getByLabelText('Provincia')).toBeEnabled()

    await user.selectOptions(screen.getByLabelText('Provincia'), '1501')
    await waitFor(() =>
      expect(geographyApi.listDistrictsByProvince).toHaveBeenCalledWith('1501'),
    )
    expect(screen.getByLabelText('Distrito')).toBeEnabled()
  })

  it('al cambiar el departamento limpia provincia y distrito', async () => {
    const user = userEvent.setup()
    renderCreateForm()
    await waitFor(() => expect(geographyApi.listDepartments).toHaveBeenCalled())

    await user.selectOptions(screen.getByLabelText('Departamento'), '15')
    await waitFor(() => expect(screen.getByLabelText('Provincia')).toBeEnabled())
    await user.selectOptions(screen.getByLabelText('Provincia'), '1501')
    await waitFor(() => expect(screen.getByLabelText('Distrito')).toBeEnabled())
    await user.selectOptions(screen.getByLabelText('Distrito'), '150122')
    expect(screen.getByLabelText<HTMLSelectElement>('Distrito').value).toBe('150122')

    // Volver a elegir departamento no puede dejar viva una provincia de otro.
    vi.mocked(geographyApi.listProvincesByDepartment).mockResolvedValue([])
    await user.selectOptions(screen.getByLabelText('Departamento'), '04')

    await waitFor(() =>
      expect(screen.getByLabelText<HTMLSelectElement>('Provincia').value).toBe(''),
    )
    expect(screen.getByLabelText<HTMLSelectElement>('Distrito').value).toBe('')
  })

  it('envía solo el código UBIGEO, nunca los nombres', async () => {
    const user = userEvent.setup()
    renderCreateForm()
    await waitFor(() => expect(geographyApi.listDepartments).toHaveBeenCalled())

    // F005.1 quitó el campo Código del formulario.
    await user.type(screen.getByLabelText('Nombre'), 'Sede Nueva')
    await user.selectOptions(screen.getByLabelText('Departamento'), '15')
    await waitFor(() => expect(screen.getByLabelText('Provincia')).toBeEnabled())
    await user.selectOptions(screen.getByLabelText('Provincia'), '1501')
    await waitFor(() => expect(screen.getByLabelText('Distrito')).toBeEnabled())
    await user.selectOptions(screen.getByLabelText('Distrito'), '150122')

    await user.click(screen.getByRole('button', { name: 'Crear sede' }))

    await waitFor(() => expect(logisticsApi.branches.create).toHaveBeenCalled())
    const [, body] = vi.mocked(logisticsApi.branches.create).mock.calls[0]
    expect(body).toMatchObject({ ubigeo_code: '150122' })
    expect(body).not.toHaveProperty('department_name')
    expect(body).not.toHaveProperty('province_name')
    expect(body).not.toHaveProperty('district_name')
  })

  it('al editar precarga la jerarquía sin obligar a reseleccionar', async () => {
    renderEditForm()

    await waitFor(() =>
      expect(screen.getByLabelText<HTMLSelectElement>('Departamento').value).toBe('15'),
    )
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLSelectElement>('Provincia').value).toBe('1501'),
    )
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLSelectElement>('Distrito').value).toBe('150122'),
    )
  })

  it('conserva el UBIGEO al guardar una edición', async () => {
    const user = userEvent.setup()
    renderEditForm()
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLSelectElement>('Distrito').value).toBe('150122'),
    )

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(logisticsApi.branches.update).toHaveBeenCalled())
    const [, body] = vi.mocked(logisticsApi.branches.update).mock.calls[0]
    expect(body).toMatchObject({ ubigeo_code: '150122' })
  })

  it('muestra un error legible si el catálogo falla', async () => {
    vi.mocked(geographyApi.listDepartments).mockRejectedValue(
      new ApiRequestError('No se pudo cargar el catálogo geográfico.', {
        code: 'INTERNAL_ERROR',
        status: 503,
      }),
    )
    renderCreateForm()

    expect(
      await screen.findByText(/No se pudo cargar el catálogo geográfico/),
    ).toBeInTheDocument()
  })

  it('explica un 422 UBIGEO_NOT_FOUND en lugar de un fallo genérico', async () => {
    const user = userEvent.setup()
    vi.mocked(logisticsApi.branches.create).mockRejectedValue(
      new ApiRequestError("Código UBIGEO '999999' no existe en el catálogo.", {
        code: 'UBIGEO_NOT_FOUND',
        status: 422,
      }),
    )
    renderCreateForm()
    await user.type(await screen.findByLabelText('Nombre'), 'Sede Nueva')
    await user.click(screen.getByRole('button', { name: 'Crear sede' }))

    expect(
      await screen.findByText(/no existe en el catálogo/),
    ).toBeInTheDocument()
  })

  it('avisa cuando una provincia no tiene distritos', async () => {
    const user = userEvent.setup()
    vi.mocked(geographyApi.listDistrictsByProvince).mockResolvedValue([])
    renderCreateForm()
    await waitFor(() => expect(geographyApi.listDepartments).toHaveBeenCalled())

    await user.selectOptions(screen.getByLabelText('Departamento'), '15')
    await waitFor(() => expect(screen.getByLabelText('Provincia')).toBeEnabled())
    await user.selectOptions(screen.getByLabelText('Provincia'), '1501')

    expect(
      await screen.findByText(/Sin distritos en esta provincia/),
    ).toBeInTheDocument()
  })
})
