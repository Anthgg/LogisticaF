import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_ROOT } from '../../../api/config'
import { clearCsrfToken } from '../../../api/api-client'
import { putawayExceptionsApi } from './putawayExceptionsApi'
import { putawayMobileApi } from './putawayMobileApi'
import { putawayProximityApi } from './putawayProximityApi'
import { putawayTasksApi } from './putawayTasksApi'
import type { PutawayTaskApi } from '../types/putaway-api'

const task: PutawayTaskApi = {
  id: '11111111-1111-4111-8111-111111111111',
  organization_id: '22222222-2222-4222-8222-222222222222',
  warehouse_id: '33333333-3333-4333-8333-333333333333',
  putaway_order_id: '44444444-4444-4444-8444-444444444444',
  task_number: 'PUT-0001',
  source_allocation_id: '55555555-5555-4555-8555-555555555555',
  recommendation_run_id: null,
  recommended_location_id: '66666666-6666-4666-8666-666666666666',
  selected_location_id: null,
  source_stage_location_id: null,
  status: 'PRODUCT_SCAN_REQUIRED',
  priority: 10,
  assignment_status: 'ACCEPTED',
  assigned_user_id: '77777777-7777-4777-8777-777777777777',
  assigned_team_id: null,
  assigned_at: '2026-08-14T10:00:00Z',
  required_quantity: '5.000000',
  required_unit_id: '88888888-8888-4888-8888-888888888888',
  required_base_quantity: '5.000000',
  placed_quantity: '0.000000',
  placed_base_quantity: '0.000000',
  remaining_quantity: '5.000000',
  remaining_base_quantity: '5.000000',
  scan_policy: 'PRODUCT_THEN_LOCATION',
  expected_product_id: '99999999-9999-4999-8999-999999999999',
  started_at: '2026-08-14T10:00:00Z',
  paused_at: null,
  completed_at: null,
  exception_count: 0,
  created_at: '2026-08-14T10:00:00Z',
  updated_at: '2026-08-14T10:00:00Z',
  row_version: 1,
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('putaway mobile F043 contract', () => {
  beforeEach(() => {
    clearCsrfToken()
    let sequence = 0
    vi.stubGlobal('crypto', {
      randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
      subtle: {
        digest: async () => new Uint8Array(32).fill(0xab).buffer,
      },
    } as unknown as Crypto)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('ejecuta task -> session -> scans -> validations -> confirmation -> complete -> finalize', async () => {
    const businessRequests: Array<{ url: string; init: RequestInit }> = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input)
      if (url === `${API_ROOT}/auth/csrf`) return jsonResponse({ csrf_token: 'csrf-putaway' })
      businessRequests.push({ url, init })

      if (url.endsWith(`/putaway/tasks/${task.id}/sessions`)) {
        return jsonResponse({ id: 'session-id', task_id: task.id, status: 'ACTIVE' }, 201)
      }
      if (url.endsWith('/putaway/sessions/session-id/scans')) {
        const body = JSON.parse(String(init.body)) as { scan_type: string }
        return jsonResponse({
          id: body.scan_type === 'PRODUCT' ? 'product-event-id' : 'location-event-id',
          scan_type: body.scan_type,
          validation_status: null,
        }, 201)
      }
      if (url.endsWith('/scans/product-event-id/validate-product')) {
        return jsonResponse({ id: 'product-event-id', scan_type: 'PRODUCT', validation_status: 'VALID' })
      }
      if (url.endsWith('/scans/location-event-id/validate-location')) {
        return jsonResponse({ id: 'location-event-id', scan_type: 'LOCATION', validation_status: 'VALID' })
      }
      if (url.endsWith(`/putaway/tasks/${task.id}/placements`)) {
        return jsonResponse({ id: 'confirmation-id', confirmation_status: 'CONFIRMED' }, 201)
      }
      if (url.endsWith('/putaway/sessions/session-id/complete')) {
        return jsonResponse({ id: 'session-id', task_id: task.id, status: 'COMPLETED' })
      }
      if (url.endsWith('/putaway/placements/confirmation-id/finalize')) {
        return jsonResponse({ id: 'placement-id', status: 'PLACED_PENDING_MOVEMENT_LEDGER' })
      }
      return jsonResponse({ error: { code: 'UNEXPECTED_TEST_ROUTE', message: url } }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(putawayMobileApi.completeWorkflow({
      task,
      productCode: 'QR:PRODUCT-001',
      locationCode: 'LOC:A-01-02',
    })).resolves.toMatchObject({
      session: { id: 'session-id', status: 'ACTIVE' },
      productScan: { id: 'product-event-id', validation_status: 'VALID' },
      locationScan: { id: 'location-event-id', validation_status: 'VALID' },
      confirmation: { id: 'confirmation-id' },
      completedSession: { id: 'session-id', status: 'COMPLETED' },
      placement: { id: 'placement-id', status: 'PLACED_PENDING_MOVEMENT_LEDGER' },
    })

    expect(businessRequests.map(({ url }) => url.replace(API_ROOT, ''))).toEqual([
      `/logistics/putaway/tasks/${task.id}/sessions`,
      '/logistics/putaway/sessions/session-id/scans',
      '/logistics/putaway/sessions/session-id/scans/product-event-id/validate-product',
      '/logistics/putaway/sessions/session-id/scans',
      '/logistics/putaway/sessions/session-id/scans/location-event-id/validate-location',
      `/logistics/putaway/tasks/${task.id}/placements`,
      '/logistics/putaway/sessions/session-id/complete',
      '/logistics/putaway/placements/confirmation-id/finalize',
    ])

    const bodies = businessRequests.map(({ init }) => init.body ? JSON.parse(String(init.body)) : undefined)
    expect(bodies[0]).toEqual({ scanner_type: 'MOBILE_CAMERA' })
    expect(bodies[1]).toMatchObject({
      scan_type: 'PRODUCT',
      normalized_code: 'QR:PRODUCT-001',
      code_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      client_scan_id: expect.any(String),
    })
    expect(bodies[2]).toEqual({ expected_product_id: task.expected_product_id })
    expect(bodies[3]).toMatchObject({
      scan_type: 'LOCATION',
      normalized_code: 'LOC:A-01-02',
      code_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      client_scan_id: expect.any(String),
    })
    expect(bodies[4]).toEqual({ expected_location_id: task.recommended_location_id })
    expect(bodies[5]).toEqual({
      source_allocation_id: task.source_allocation_id,
      location_id: task.recommended_location_id,
      quantity: task.remaining_quantity,
      unit_id: task.required_unit_id,
      product_scan_event_id: 'product-event-id',
      location_scan_event_id: 'location-event-id',
    })
    expect(bodies[6]).toBeUndefined()
    expect(bodies[7]).toBeUndefined()

    for (const { init } of businessRequests) {
      const headers = new Headers(init.headers)
      expect(headers.get('X-CSRF-Token')).toBe('csrf-putaway')
      expect(headers.get('Idempotency-Key')).toBeTruthy()
      expect(init.credentials).toBe('include')
    }
  })

  it('no hace request cuando la tarea no tiene ubicación confirmable', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(putawayMobileApi.completeWorkflow({
      task: { ...task, recommended_location_id: null, selected_location_id: null },
      productCode: 'PRODUCT',
      locationCode: 'LOCATION',
    })).rejects.toMatchObject({ code: 'PUTAWAY_LOCATION_REQUIRED' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('no conserva helpers futuros que simulaban extras sin backend', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(putawayMobileApi).not.toHaveProperty('scanCode')
    expect(putawayMobileApi).not.toHaveProperty('getWorkspace')
    expect(putawayExceptionsApi).not.toHaveProperty('listExceptions')
    expect(putawayProximityApi).not.toHaveProperty('getNearbyDestinations')
    expect(putawayTasksApi).not.toHaveProperty('updatePriority')
    expect(putawayTasksApi).not.toHaveProperty('cancelTask')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
