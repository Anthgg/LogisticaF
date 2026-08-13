import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InventoryPositionBalanceDetailPage } from '../pages/InventoryPositionBalanceDetailPage'
import * as apiClient from '../../../api/api-client'

const POSITION = '44444444-4444-4444-4444-444444444444'
const LONG_DECIMAL = '12345678901234567890.123456789012345678'

const permissionState = { permissions: new Set<string>(['logistics.inventory.read']) }

vi.mock('../../logistics-permissions/hooks/useLogisticsPermissions', () => ({
  useLogisticsPermissions: () => ({
    isLoading: false,
    hasPermission: (code: string) => permissionState.permissions.has(code),
    hasAnyPermission: (codes: readonly string[]) =>
      codes.some((code) => permissionState.permissions.has(code)),
    requiresStepUp: () => false,
  }),
}))

const balancePayload = {
  id: 'row-1',
  organization_id: '11111111-1111-1111-1111-111111111111',
  branch_id: '55555555-5555-5555-5555-555555555555',
  warehouse_id: '22222222-2222-2222-2222-222222222222',
  warehouse_location_id: null,
  inventory_position_id: POSITION,
  product_id: '33333333-3333-3333-3333-333333333333',
  product_version_id: null,
  base_unit_id: '66666666-6666-6666-6666-666666666666',
  quantity: LONG_DECIMAL,
  availability_state: 'AVAILABLE',
  quality_state: 'RELEASED',
  transit_state: 'SETTLED',
  damage_state: 'INTACT',
  expiration_state: 'VALID',
  dimension_key: 'org|wh|prod',
  last_applied_ledger_sequence: 4821,
  data_quality_status: 'VERIFIED',
  reconciliation_status: 'RECONCILED',
  calculated_at: '2026-08-12T10:00:00Z',
}

let requestSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  permissionState.permissions = new Set(['logistics.inventory.read'])
  requestSpy = vi.spyOn(apiClient, 'apiRequest')
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderDetail(positionId = POSITION) {
  return render(
    <MemoryRouter initialEntries={[`/logistics/inventory/stock/positions/${positionId}`]}>
      <Routes>
        <Route
          path="/logistics/inventory/stock/positions/:positionId"
          element={<InventoryPositionBalanceDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Detalle de saldo por posición', () => {
  it('consulta el endpoint real con el InventoryPosition id', async () => {
    requestSpy.mockResolvedValue(balancePayload as never)
    renderDetail()

    expect(await screen.findByTestId('decimal-display')).toBeInTheDocument()
    const call = requestSpy.mock.calls.at(-1)?.[0] as apiClient.ApiRequestOptions
    expect(call.path).toBe(`/logistics/inventory/balances/positions/${POSITION}`)
  })

  it('muestra la cantidad sin perder precisión', async () => {
    requestSpy.mockResolvedValue(balancePayload as never)
    renderDetail()

    expect(await screen.findByTestId('decimal-display')).toHaveAttribute(
      'data-exact',
      LONG_DECIMAL,
    )
  })

  it('muestra los estados y la calidad del dato', async () => {
    requestSpy.mockResolvedValue(balancePayload as never)
    renderDetail()

    expect(await screen.findByText('Verificado')).toBeInTheDocument()
    expect(screen.getByText('AVAILABLE')).toBeInTheDocument()
    expect(screen.getByText(/Secuencia aplicada: 4821/)).toBeInTheDocument()
  })

  it('traduce el 404 a un mensaje claro', async () => {
    const { ApiRequestError } = await import('../../../types/api')
    requestSpy.mockRejectedValue(
      new ApiRequestError('not found', { code: 'NOT_FOUND', status: 404 }),
    )
    renderDetail()

    expect(
      await screen.findByText(/no tiene un saldo proyectado activo/i),
    ).toBeInTheDocument()
  })

  it('traduce el 403 cross-tenant', async () => {
    const { ApiRequestError } = await import('../../../types/api')
    requestSpy.mockRejectedValue(
      new ApiRequestError('forbidden', { code: 'CROSS_TENANT_ACCESS_DENIED', status: 403 }),
    )
    renderDetail()

    expect(
      await screen.findByText(/No tienes acceso a la organización propietaria/i),
    ).toBeInTheDocument()
  })

  it('bloquea la pantalla sin permiso de lectura', () => {
    permissionState.permissions = new Set()
    renderDetail()

    expect(screen.getByText(/no tienes el permiso/i)).toBeInTheDocument()
    expect(requestSpy).not.toHaveBeenCalled()
  })
})
