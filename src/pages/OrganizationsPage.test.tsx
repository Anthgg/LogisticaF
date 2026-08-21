import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrganizationsPage } from './OrganizationsPage'
import { logisticsApi } from '../api/logistics-api'
import { referenceCatalogsApi } from '../api/reference-catalogs-api'
import { renderWithAuth } from '../test/test-utils'

vi.mock('../api/logistics-api', () => ({
  logisticsApi: {
    organizations: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      changeStatus: vi.fn(),
    },
  },
}))

vi.mock('../api/reference-catalogs-api', () => ({
  referenceCatalogsApi: {
    listCountries: vi.fn(),
    listTimezones: vi.fn(),
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
  id: 'org-123',
  code: 'ORG0001',
  name: 'Organización Principal',
  country_code: 'PE',
  timezone: 'America/Lima',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('OrganizationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(logisticsApi.organizations.list).mockResolvedValue({
      items: [mockOrg],
      page: 1,
      page_size: 20,
      total: 1,
      total_pages: 1,
    })
    vi.mocked(referenceCatalogsApi.listCountries).mockResolvedValue([
      { code: 'PE', name: 'Perú' },
    ])
    vi.mocked(referenceCatalogsApi.listTimezones).mockResolvedValue([
      { code: 'America/Lima', name: 'Lima', country_code: 'PE' },
    ])
  })

  it('renders organizations table with data', async () => {
    renderWithAuth(<OrganizationsPage />)

    expect(await screen.findByText('Organización Principal')).toBeInTheDocument()
    expect(screen.getByText('ORG0001')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('uses a dedicated route instead of a CRUD modal', async () => {
    renderWithAuth(<OrganizationsPage />)

    await screen.findByText('Organización Principal')
    expect(screen.getByRole('button', { name: 'Nueva organización' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls changeStatus when clicking Desactivar', async () => {
    const user = userEvent.setup()
    renderWithAuth(<OrganizationsPage />)

    await screen.findByText('Desactivar')
    await user.click(screen.getByText('Desactivar'))

    await waitFor(() => {
      expect(logisticsApi.organizations.changeStatus).toHaveBeenCalledWith('org-123', {
        status: 'inactive',
      })
    })
  })
})
