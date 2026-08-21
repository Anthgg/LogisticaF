import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { warehousesApi } from '../api/warehouses-modeling-api'
import { renderWithAuth } from '../test/test-utils'
import type { Warehouse } from '../types/warehouse-modeling'
import { WarehouseDetailPage } from './WarehouseDetailPage'

vi.mock('../api/warehouses-modeling-api', () => ({
  warehousesApi: {
    get: vi.fn(),
    blockLocation: vi.fn(),
  },
}))

vi.mock('../components/warehouses/WarehouseLocationTree', () => ({
  WarehouseLocationTree: () => <div>Árbol de ubicaciones</div>,
}))

vi.mock('../components/warehouses/WarehouseLocationDetailPanel', () => ({
  WarehouseLocationDetailPanel: () => <div>Detalle de ubicación</div>,
}))

vi.mock('../components/warehouses/WarehouseLocationGenerationWizard', () => ({
  WarehouseLocationGenerationWizard: () => null,
}))

vi.mock('../components/warehouses/WarehouseLogicalMapPage', () => ({
  WarehouseLogicalMapPage: () => <div>Mapa lógico</div>,
}))

vi.mock('../components/logistics/LocationMap', () => ({
  LocationMap: () => <div>Mapa geográfico</div>,
}))

const canonicalWarehouse = {
  id: 'warehouse-1',
  organization_id: 'org-1',
  branch_id: 'branch-1',
  code: 'ALM000007',
  name: 'Almacén Central',
  description: null,
  warehouse_type: 'receiving',
  status: 'active',
  address: 'Nave B',
  uses_branch_location: true,
  effective_latitude: -12.161086,
  effective_longitude: -76.958308,
  location_source: 'BRANCH',
  layout_status: 'draft',
  inventory_enabled: true,
  temperature_controlled: false,
  hazardous_materials_allowed: false,
  created_at: '2026-08-21T00:00:00Z',
  updated_at: '2026-08-21T00:00:00Z',
} as unknown as Warehouse

describe('WarehouseDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(warehousesApi.get).mockResolvedValue(canonicalWarehouse)
  })

  it('renders a canonical warehouse response without a legacy capabilities object', async () => {
    renderWithAuth(
      <Routes>
        <Route
          path="/logistics/settings/warehouses/:warehouseId"
          element={<WarehouseDetailPage />}
        />
      </Routes>,
      { initialEntries: ['/logistics/settings/warehouses/warehouse-1'] },
    )

    expect(await screen.findByRole('heading', { name: 'Almacén Central (ALM000007)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generación Masiva' })).not.toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(3)
    expect(screen.getByText('Árbol de ubicaciones')).toBeInTheDocument()
  })
})
