import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InboundDockCalendarPage } from '../pages/InboundDockCalendarPage'
import { InboundDockQueuePage } from '../pages/InboundDockQueuePage'
import { LogisticsAuthorizationContext } from '../../logistics-permissions/contexts/logistics-authorization-context'
import { createLogisticsAuthState } from '../../logistics-permissions/test/test-utils'
import { LOGISTICS_PERMISSIONS } from '../../logistics-permissions/logistics-permissions-map'

/**
 * Regresión de RBAC canónico para Inbound Docks.
 *
 * Fija que las pantallas se autorizan con las capabilities REALES del backend
 * (`logistics.inbound_dock_queue.*`) y no con el namespace legacy
 * `logistics.inbound_docks.*`, que no existe en el catálogo.
 */

const QUEUE_ENTRY = {
  id: 'q-1',
  position: 1,
  priority: 'NORMAL' as const,
  status: 'WAITING' as const,
  check_in_id: 'chk-1',
  cpv_code: 'CPV-777',
  cit_code: 'CIT-777',
  warehouse_id: 'wh-1',
  warehouse_name: 'Almacén Central',
  supplier_id: null,
  supplier_name: 'Proveedor Uno',
  carrier_id: null,
  carrier_name: null,
  vehicle_id: null,
  vehicle_plate: 'ABC-123',
  vehicle_type: null,
  driver_name_redacted: null,
  gate_clearance_at: null,
  entered_queue_at: '2026-08-01T10:00:00Z',
  assigned_dock_id: null,
  assigned_dock_code: null,
  assigned_dock_name: null,
  cit_window_start: null,
  cit_window_end: null,
  pallets: null,
  packages: null,
  weight: null,
  special_requirements: [],
  compatible_dock_ids: [],
  alerts: [],
  waiting_seconds: 120,
  server_time: '2026-08-01T10:02:00Z',
}

const SUMMARY = {
  server_time: '2026-08-01T10:02:00Z',
  timezone: 'UTC',
  total_in_queue: 1,
  total_assigned: 0,
  total_unloading: 0,
  total_waiting: 1,
  docks_available: 2,
  docks_reserved: 0,
  docks_occupied: 0,
  total_paused: 0,
  total_completed_pending_release: 0,
  prolonged_waits: 0,
  operations_with_anomalies: 0,
  operations_with_incomplete_data: 0,
  avg_waiting_seconds: 120,
}

const emptyList = { data: { items: [], total: 0 }, isLoading: false, isError: false, error: null, refetch: vi.fn() }

vi.mock('../hooks/useInboundDocksQueries', () => ({
  useInboundDockQueueSummary: vi.fn(() => ({ data: SUMMARY, isLoading: false, isError: false, error: null, refetch: vi.fn() })),
  useInboundDockQueue: vi.fn(() => ({
    data: { items: [QUEUE_ENTRY], total: 1, total_pages: 1 },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })),
  useInboundDockAssignments: vi.fn(() => emptyList),
  useUnloadingOperationsList: vi.fn(() => emptyList),
}))

// Solo se sustituye useQuery (el calendario pide los muelles); el resto del
// módulo, como useMutation, se conserva.
vi.mock('../hooks/useQuery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useQuery')>()),
  useQuery: vi.fn(() => ({ data: { items: [] }, isLoading: false, isError: false, error: null, refetch: vi.fn() })),
}))

vi.mock('../../logistics-permissions/hooks/useSensitiveActionGuard', () => ({
  useSensitiveActionGuard: () => ({
    run: async (action: (reason: string) => Promise<void>) => {
      await action('Motivo valido test')
      return true
    },
    isPending: false,
    stepUpRequired: false,
    errorMessage: null,
  }),
}))

function renderWith(permissions: string[], ui: React.ReactElement) {
  return render(
    <LogisticsAuthorizationContext.Provider value={createLogisticsAuthState({ permissions })}>
      <MemoryRouter>{ui}</MemoryRouter>
    </LogisticsAuthorizationContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Calendario de muelles · RBAC canónico', () => {
  it('A · se visualiza con la capability canónica de lectura', () => {
    renderWith([LOGISTICS_PERMISSIONS.inboundDocks.view], <InboundDockCalendarPage />)

    expect(screen.queryByText(/No tienes capability/i)).not.toBeInTheDocument()
    // El calendario operativo solo se monta cuando la capability autoriza.
    expect(screen.getByText('Fase 038')).toBeInTheDocument()
  })

  it('B · sin capability queda bloqueado', () => {
    renderWith([], <InboundDockCalendarPage />)

    expect(screen.getByText(/No tienes capability/i)).toBeInTheDocument()
  })

  it('la capability legacy ya no habilita la pantalla', () => {
    renderWith(['logistics.inbound_docks.read'], <InboundDockCalendarPage />)

    expect(screen.getByText(/No tienes capability/i)).toBeInTheDocument()
  })
})

describe('Cola de muelles · RBAC canónico', () => {
  it('C · con viewQueue canónico se lista la cola', () => {
    renderWith([LOGISTICS_PERMISSIONS.inboundDocks.viewQueue], <InboundDockQueuePage />)

    expect(screen.queryByText('No tienes capability para visualizar la cola.')).not.toBeInTheDocument()
    expect(screen.getByText(/CPV-777/)).toBeInTheDocument()
  })

  it('D · sin viewQueue se muestra el estado prohibido y no hay datos', () => {
    renderWith([], <InboundDockQueuePage />)

    expect(screen.getByText('No tienes capability para visualizar la cola.')).toBeInTheDocument()
    expect(screen.queryByText(/CPV-777/)).not.toBeInTheDocument()
  })

  it('E · con changePriority la acción de prioridad está disponible', () => {
    renderWith(
      [LOGISTICS_PERMISSIONS.inboundDocks.viewQueue, LOGISTICS_PERMISSIONS.inboundDocks.changePriority],
      <InboundDockQueuePage />,
    )

    expect(screen.getByRole('button', { name: 'Prioridad' })).toBeInTheDocument()
  })

  it('F · sin changePriority la acción no se ofrece', () => {
    renderWith([LOGISTICS_PERMISSIONS.inboundDocks.viewQueue], <InboundDockQueuePage />)

    expect(screen.getByText(/CPV-777/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Prioridad' })).not.toBeInTheDocument()
  })

  it('la capability legacy ya no habilita la cola', () => {
    renderWith(['logistics.inbound_docks.view_queue'], <InboundDockQueuePage />)

    expect(screen.getByText('No tienes capability para visualizar la cola.')).toBeInTheDocument()
  })
})
