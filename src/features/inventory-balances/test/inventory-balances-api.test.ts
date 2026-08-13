import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inventoryBalancesApi } from '../api/inventory-balances-api'
import * as apiClient from '../../../api/api-client'

const ORG = '11111111-1111-1111-1111-111111111111'
const WAREHOUSE = '22222222-2222-2222-2222-222222222222'
const PRODUCT = '33333333-3333-3333-3333-333333333333'
const POSITION = '44444444-4444-4444-4444-444444444444'

let requestSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  requestSpy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({} as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function lastCall() {
  return requestSpy.mock.calls.at(-1)?.[0] as apiClient.ApiRequestOptions
}

describe('contrato de la API de saldos', () => {
  it('solo expone las tres operaciones publicadas por el backend', () => {
    expect(Object.keys(inventoryBalancesApi).toSorted()).toEqual([
      'getPositionBalance',
      'getSummary',
      'requestRebuild',
    ])
  })

  it('summary usa la ruta real y envía los filtros del contrato', async () => {
    await inventoryBalancesApi.getSummary({
      organization_id: ORG,
      warehouse_id: WAREHOUSE,
      product_id: PRODUCT,
    })

    const call = lastCall()
    expect(call.method).toBe('GET')
    expect(call.path).toBe(
      `/logistics/inventory/balances/summary?organization_id=${ORG}&warehouse_id=${WAREHOUSE}&product_id=${PRODUCT}`,
    )
    expect(call.path).not.toContain('/api/v1')
  })

  it('omite los filtros opcionales vacíos', async () => {
    await inventoryBalancesApi.getSummary({ organization_id: ORG })
    expect(lastCall().path).toBe(
      `/logistics/inventory/balances/summary?organization_id=${ORG}`,
    )
  })

  it('el detalle usa el InventoryPosition id en la ruta', async () => {
    await inventoryBalancesApi.getPositionBalance(POSITION)
    const call = lastCall()
    expect(call.method).toBe('GET')
    expect(call.path).toBe(`/logistics/inventory/balances/positions/${POSITION}`)
  })

  it('el rebuild es POST con CSRF y sin cabecera de step-up por defecto', async () => {
    await inventoryBalancesApi.requestRebuild({
      organization_id: ORG,
      rebuild_mode: 'FULL',
    })

    const call = lastCall()
    expect(call.path).toBe('/logistics/inventory/balances/rebuild')
    expect(call.method).toBe('POST')
    expect(call.requiresCsrf).toBe(true)
    expect(call.headers).toEqual({})
    expect(call.body).toEqual({ organization_id: ORG, rebuild_mode: 'FULL' })
  })

  it('adjunta X-Step-Up-Proof-ID solo con una prueba real', async () => {
    await inventoryBalancesApi.requestRebuild(
      { organization_id: ORG, rebuild_mode: 'PARTIAL_WAREHOUSE', target_warehouse_id: WAREHOUSE },
      { stepUpProofId: 'proof-de-infraestructura' },
    )

    expect(lastCall().headers).toEqual({
      'X-Step-Up-Proof-ID': 'proof-de-infraestructura',
    })
  })

  it('propaga el error del servidor sin enmascararlo', async () => {
    requestSpy.mockRejectedValueOnce(new Error('403 forbidden'))
    await expect(inventoryBalancesApi.getSummary({ organization_id: ORG })).rejects.toThrow(
      '403 forbidden',
    )
  })
})
