import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { WarehousesPage } from './WarehousesPage'
import { logisticsApi } from '../api/logistics-api'
import { referenceCatalogsApi } from '../api/reference-catalogs-api'
import { renderWithAuth } from '../test/test-utils'

vi.mock('../api/logistics-api', () => ({
  logisticsApi: {
    organizations: {
      list: vi.fn(),
      branches: vi.fn(),
    },
    warehouses: {
      listByBranch: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      changeStatus: vi.fn(),
    },
  },
}))

vi.mock('../api/reference-catalogs-api', () => ({
  referenceCatalogsApi: {
    listWarehouseTypes: vi.fn(),
  },
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

const mockWarehouse = {
  id: 'wh-1',
  organization_id: 'org-1',
  branch_id: 'branch-1',
  code: 'WH001',
  name: 'Almacén Central',
  warehouse_type: 'general',
  address: 'Nave A - Puerta 1',
  department: 'Lima',
  province: 'Lima',
  district: 'Lima',
  capacity: null,
  is_default: true,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('WarehousesPage', () => {
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
      page_size: 100,
      total: 1,
      total_pages: 1,
    })
    vi.mocked(logisticsApi.warehouses.listByBranch).mockResolvedValue({
      items: [mockWarehouse],
      page: 1,
      page_size: 20,
      total: 1,
      total_pages: 1,
    })
    vi.mocked(referenceCatalogsApi.listWarehouseTypes).mockResolvedValue([
      { code: 'general', name: 'General' },
    ])
  })

  it('renders warehouses for the selected branch', async () => {
    renderWithAuth(<WarehousesPage />)

    expect(await screen.findByText('Almacén Central')).toBeInTheDocument()
    expect(screen.getByText('WH001')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('uses a dedicated route instead of a CRUD dialog', async () => {
    renderWithAuth(<WarehousesPage />)

    await screen.findByText('Almacén Central')
    expect(screen.getByRole('button', { name: 'Nuevo almacén' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
