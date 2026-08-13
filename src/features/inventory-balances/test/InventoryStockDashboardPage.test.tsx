import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InventoryStockDashboardPage } from '../pages/InventoryStockDashboardPage'
import * as apiClient from '../../../api/api-client'

const ORG_A = '11111111-1111-1111-1111-111111111111'
const ORG_B = '99999999-9999-9999-9999-999999999999'
const LONG_DECIMAL = '12345678901234567890.123456789012345678'

const permissionState = {
  permissions: new Set<string>(['logistics.inventory.read']),
  stepUp: new Set<string>(),
  isLoading: false,
}

const contextState = { organization_id: ORG_A as string | null }

vi.mock('../../logistics-permissions/hooks/useLogisticsPermissions', () => ({
  useLogisticsPermissions: () => ({
    isLoading: permissionState.isLoading,
    hasPermission: (code: string) => permissionState.permissions.has(code),
    hasAnyPermission: (codes: readonly string[]) =>
      codes.some((code) => permissionState.permissions.has(code)),
    requiresStepUp: (code: string) => permissionState.stepUp.has(code),
  }),
}))

vi.mock('../../logistics-permissions/hooks/useLogisticsContextSelector', () => ({
  useLogisticsContextSelector: () => ({
    context: contextState,
    options: {
      organizations: [
        { id: ORG_A, label: 'Organización A' },
        { id: ORG_B, label: 'Organización B' },
      ],
      branches: [],
      warehouses: [{ id: '22222222-2222-2222-2222-222222222222', label: 'Almacén Central' }],
    },
    selectContext: async (next: { organization_id: string | null }) => {
      contextState.organization_id = next.organization_id
    },
  }),
}))

vi.mock('../../../api/products-catalog-api', () => ({
  productsCatalogApi: {
    list: async () => ({
      items: [{ id: '33333333-3333-3333-3333-333333333333', sku: 'SKU-1', name: 'Producto 1' }],
    }),
  },
}))

function summaryPayload(value: string) {
  return {
    physical_on_hand: value,
    available_to_promise: value,
    reserved_stock: value,
    blocked_stock: value,
    quarantine_stock: value,
    in_transit_stock: value,
    damaged_stock: value,
    expired_stock: value,
  }
}

let requestSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  permissionState.permissions = new Set(['logistics.inventory.read'])
  permissionState.stepUp = new Set()
  permissionState.isLoading = false
  contextState.organization_id = ORG_A
  requestSpy = vi.spyOn(apiClient, 'apiRequest')
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <InventoryStockDashboardPage />
    </MemoryRouter>,
  )
}

describe('Saldos de inventario · las 8 métricas', () => {
  it('renderiza las 8 métricas del contrato con su valor exacto', async () => {
    requestSpy.mockResolvedValue(summaryPayload(LONG_DECIMAL) as never)
    renderPage()

    const claves = [
      'physical_on_hand',
      'available_to_promise',
      'reserved_stock',
      'blocked_stock',
      'quarantine_stock',
      'in_transit_stock',
      'damaged_stock',
      'expired_stock',
    ]

    for (const clave of claves) {
      const tarjeta = await screen.findByTestId(`metric-${clave}`)
      // El valor canónico completo queda accesible, sin pasar por Number().
      expect(within(tarjeta).getByTestId('decimal-display')).toHaveAttribute(
        'data-exact',
        LONG_DECIMAL,
      )
    }
    expect(screen.getAllByTestId(/^metric-/)).toHaveLength(8)
  })

  it('muestra las etiquetas en español del contrato', async () => {
    requestSpy.mockResolvedValue(summaryPayload('10') as never)
    renderPage()

    for (const etiqueta of [
      'Stock físico',
      'Disponible',
      'Reservado',
      'Bloqueado',
      'Cuarentena',
      'En tránsito',
      'Dañado',
      'Vencido',
    ]) {
      expect(await screen.findByText(etiqueta)).toBeInTheDocument()
    }
  })
})

describe('Saldos de inventario · estados de UX', () => {
  it('pide el resumen con organization_id y no inventa endpoints', async () => {
    requestSpy.mockResolvedValue(summaryPayload('1') as never)
    renderPage()

    await waitFor(() => expect(requestSpy).toHaveBeenCalled())
    const rutas = requestSpy.mock.calls.map((call: unknown[]) => (call[0] as apiClient.ApiRequestOptions).path)
    const rutasDeSaldos = rutas.filter((path: string) => path.includes('/inventory/balances'))

    expect(rutasDeSaldos.length).toBeGreaterThan(0)
    for (const ruta of rutasDeSaldos) {
      expect(ruta).toMatch(/^\/logistics\/inventory\/balances\/summary\?/)
      expect(ruta).toContain(`organization_id=${ORG_A}`)
    }
  })

  it('avisa cuando no hay saldos en vez de mostrar tarjetas vacías sin contexto', async () => {
    requestSpy.mockResolvedValue(summaryPayload('0') as never)
    renderPage()

    expect(
      await screen.findByText(/no registra saldos para los filtros seleccionados/i),
    ).toBeInTheDocument()
  })

  it('traduce el 403 a un mensaje de acceso, sin JSON técnico', async () => {
    const { ApiRequestError } = await import('../../../types/api')
    requestSpy.mockRejectedValue(
      new ApiRequestError('forbidden', { code: 'CROSS_TENANT_ACCESS_DENIED', status: 403 }),
    )
    renderPage()

    expect(await screen.findByText(/No tienes acceso a los saldos/i)).toBeInTheDocument()
  })

  it('bloquea la pantalla sin logistics.inventory.read', () => {
    permissionState.permissions = new Set()
    renderPage()

    expect(screen.getByText(/no tienes el permiso/i)).toBeInTheDocument()
    expect(requestSpy).not.toHaveBeenCalled()
  })

  it('pide seleccionar organización cuando no hay tenant activo', () => {
    contextState.organization_id = null
    renderPage()

    expect(screen.getByText(/Selecciona una organización para consultar/i)).toBeInTheDocument()
  })
})

describe('Saldos de inventario · aislamiento multi-tenant', () => {
  it('el selector de organización cambia el tenant del contexto', async () => {
    const user = userEvent.setup()
    requestSpy.mockResolvedValue(summaryPayload('111') as never)
    renderPage()

    await user.selectOptions(screen.getByLabelText('Organización'), ORG_B)
    expect(contextState.organization_id).toBe(ORG_B)
  })

  it('descarta el saldo del tenant anterior al cambiar de organización', async () => {
    requestSpy.mockImplementation(async (options: apiClient.ApiRequestOptions) => {
      if (options.path.includes(`organization_id=${ORG_A}`)) return summaryPayload('111') as never
      return summaryPayload('222') as never
    })

    const { rerender } = renderPage()
    await waitFor(() =>
      expect(
        within(screen.getByTestId('metric-physical_on_hand')).getByTestId('decimal-display'),
      ).toHaveAttribute('data-exact', '111'),
    )

    contextState.organization_id = ORG_B
    rerender(
      <MemoryRouter>
        <InventoryStockDashboardPage />
      </MemoryRouter>,
    )

    // Al cambiar la clave de consulta el dato anterior se descarta de inmediato:
    // nunca se ve el 111 del tenant A mientras el tenant activo es B.
    expect(screen.queryByTestId('metric-physical_on_hand')).not.toBeInTheDocument()

    await waitFor(() =>
      expect(
        within(screen.getByTestId('metric-physical_on_hand')).getByTestId('decimal-display'),
      ).toHaveAttribute('data-exact', '222'),
    )

    const consultas = requestSpy.mock.calls
      .map((call: unknown[]) => (call[0] as apiClient.ApiRequestOptions).path)
      .filter((path: string) => path.includes('/balances/summary'))
    expect(consultas.at(-1)).toContain(`organization_id=${ORG_B}`)
  })

  it('limpia los filtros del tenant anterior al cambiar de organización', async () => {
    const user = userEvent.setup()
    requestSpy.mockResolvedValue(summaryPayload('1') as never)
    const { rerender } = renderPage()

    const almacen = await screen.findByLabelText('Almacén (opcional)')
    await user.selectOptions(almacen, '22222222-2222-2222-2222-222222222222')
    expect(almacen).toHaveValue('22222222-2222-2222-2222-222222222222')

    contextState.organization_id = ORG_B
    rerender(
      <MemoryRouter>
        <InventoryStockDashboardPage />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(screen.getByLabelText('Almacén (opcional)')).toHaveValue(''),
    )
  })
})

describe('Saldos de inventario · rebuild', () => {
  it('oculta la acción sin permiso de rebuild', async () => {
    requestSpy.mockResolvedValue(summaryPayload('1') as never)
    renderPage()

    expect(screen.queryByRole('button', { name: /Reconstruir saldos/i })).not.toBeInTheDocument()
  })

  it('exige confirmación explícita y solo entonces llama al backend', async () => {
    const user = userEvent.setup()
    permissionState.permissions = new Set([
      'logistics.inventory.read',
      'logistics.inventory.rebuild',
    ])
    requestSpy.mockResolvedValue(summaryPayload('1') as never)
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Reconstruir saldos/i }))

    const dialogo = screen.getByRole('dialog', { name: /Confirmar reconstrucción/i })
    expect(dialogo).toBeInTheDocument()
    expect(
      requestSpy.mock.calls.some(
        (call: unknown[]) => (call[0] as apiClient.ApiRequestOptions).method === 'POST',
      ),
    ).toBe(false)

    requestSpy.mockResolvedValueOnce({
      id: 'job-1',
      organization_id: ORG_A,
      rebuild_mode: 'FULL',
      status: 'COMPLETED',
      positions_processed: 12,
      movements_replayed: 340,
      differences_count: 0,
      created_at: '2026-08-12T10:00:00Z',
      completed_at: '2026-08-12T10:00:05Z',
    } as never)

    await user.click(within(dialogo).getByRole('button', { name: /Confirmar reconstrucción/i }))

    await waitFor(() => {
      const post = requestSpy.mock.calls
        .map((call: unknown[]) => call[0] as apiClient.ApiRequestOptions)
        .find((options: apiClient.ApiRequestOptions) => options.method === 'POST')
      expect(post).toBeDefined()
      expect(post!.path).toBe('/logistics/inventory/balances/rebuild')
      expect(post!.requiresCsrf).toBe(true)
      expect(post!.body).toMatchObject({ organization_id: ORG_A, rebuild_mode: 'FULL' })
    })

    expect(await screen.findByText(/Reconstrucción encolada/i)).toBeInTheDocument()
  })

  it('avisa de la reverificación cuando el permiso exige step-up', async () => {
    const user = userEvent.setup()
    permissionState.permissions = new Set([
      'logistics.inventory.read',
      'logistics.inventory.rebuild',
    ])
    permissionState.stepUp = new Set(['logistics.inventory.rebuild'])
    requestSpy.mockResolvedValue(summaryPayload('1') as never)
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Reconstruir saldos/i }))
    expect(screen.getByText(/exige reverificación de identidad/i)).toBeInTheDocument()
  })

  it('muestra el error del rebuild sin cerrar el diálogo', async () => {
    const user = userEvent.setup()
    const { ApiRequestError } = await import('../../../types/api')
    permissionState.permissions = new Set([
      'logistics.inventory.read',
      'logistics.inventory.rebuild',
    ])
    requestSpy.mockResolvedValue(summaryPayload('1') as never)
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Reconstruir saldos/i }))
    const dialogo = screen.getByRole('dialog', { name: /Confirmar reconstrucción/i })

    requestSpy.mockRejectedValueOnce(
      new ApiRequestError('Se requiere reverificación.', { code: 'STEP_UP_REQUIRED', status: 403 }),
    )
    await user.click(within(dialogo).getByRole('button', { name: /Confirmar reconstrucción/i }))

    expect(await within(dialogo).findByText(/reverificación/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /Confirmar reconstrucción/i })).toBeInTheDocument()
  })
})
