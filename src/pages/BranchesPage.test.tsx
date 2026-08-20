import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BranchesPage } from './BranchesPage'
import { logisticsApi } from '../api/logistics-api'
import { geographyApi } from '../api/geography-api'
import { referenceCatalogsApi } from '../api/reference-catalogs-api'
import { renderWithAuth } from '../test/test-utils'

vi.mock('../api/logistics-api', () => ({
  logisticsApi: {
    organizations: {
      list: vi.fn(),
      branches: vi.fn(),
    },
    branches: {
      create: vi.fn(),
      update: vi.fn(),
      changeStatus: vi.fn(),
    },
  },
}))

vi.mock('../api/geography-api', () => ({
  geographyApi: {
    listDepartments: vi.fn(),
    listProvincesByDepartment: vi.fn(),
    listDistrictsByProvince: vi.fn(),
  },
}))

vi.mock('../api/reference-catalogs-api', () => ({
  referenceCatalogsApi: {
    listTimezones: vi.fn(),
  },
}))

// LocationMap uses maplibre-gl which cannot run in jsdom — mock it
vi.mock('../components/logistics/LocationMap', () => ({
  LocationMap: ({ latitude, longitude }: { latitude?: number | null; longitude?: number | null }) => (
    <div data-testid="location-map" data-lat={latitude} data-lon={longitude} />
  ),
}))

// geocodingApi calls backend — not needed for these tests
vi.mock('../api/geocoding-api', () => ({
  geocodingApi: {
    search: vi.fn().mockResolvedValue({ success: true, data: { results: [], count: 0 } }),
    reverse: vi.fn().mockResolvedValue({ success: true, data: null }),
  },
  wgs84ToMapLibreLngLat: (lat: number, lon: number) => [lon, lat],
  mapLibreLngLatToWgs84: (lngLat: { lng: number; lat: number }) => [lngLat.lat, lngLat.lng],
}))

vi.mock('../features/logistics-me/hooks/useLogisticsAccess', () => ({
  useLogisticsAccess: () => ({
    hasPermission: () => true,
  }),
}))

vi.mock('../features/logistics-permissions/hooks/useLogisticsPermissions', () => ({
  useLogisticsPermissions: () => ({
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
    canAccessScope: () => true,
    isLoading: false,
  }),
}))

const mockOrg = {
  id: 'org-1',
  code: 'ORG01',
  name: 'Org Lima',
  country_code: 'PE',
  timezone: 'America/Lima',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockBranch = {
  id: 'branch-1',
  organization_id: 'org-1',
  code: 'BR001',
  name: 'Sede Principal',
  timezone: 'America/Lima',
  ubigeo_code: '150101',
  ubigeo: {
    code: '150101',
    formatted: 'Lima / Lima / Lima',
    department_code: '15',
    province_code: '1501',
    district_code: '150101',
    department_name: 'Lima',
    province_name: 'Lima',
    district_name: 'Lima',
  },
  address_text: 'Av. Argentina 123',
  latitude: null,
  longitude: null,
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('BranchesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(logisticsApi.organizations.list).mockResolvedValue({
      items: [mockOrg],
      page: 1,
      page_size: 100,
      total: 1,
      total_pages: 1,
    })
    vi.mocked(logisticsApi.organizations.branches).mockResolvedValue({
      items: [mockBranch],
      page: 1,
      page_size: 20,
      total: 1,
      total_pages: 1,
    })
    vi.mocked(geographyApi.listDepartments).mockResolvedValue([
      { code: '15', name: 'LIMA' },
    ])
    vi.mocked(referenceCatalogsApi.listTimezones).mockResolvedValue([
      { code: 'America/Lima', name: 'Lima', country_code: 'PE' },
    ])
  })

  it('renders branches for the selected organization', async () => {
    renderWithAuth(<BranchesPage />)

    expect(await screen.findByText('Sede Principal')).toBeInTheDocument()
    expect(screen.getByText('BR001')).toBeInTheDocument()
    expect(screen.getByText('Lima / Lima / Lima')).toBeInTheDocument()
    expect(screen.getByText('Av. Argentina 123')).toBeInTheDocument()
  })

  it('opens new branch modal when clicking button', async () => {
    const user = userEvent.setup()
    renderWithAuth(<BranchesPage />)

    await screen.findByText('Sede Principal')
    const newBtn = screen.getByRole('button', { name: 'Nueva sede' })
    await user.click(newBtn)

    expect(await screen.findByRole('heading', { name: 'Nueva sede' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument()
  })
})
