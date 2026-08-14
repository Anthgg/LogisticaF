import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, getCsrfToken } from '../../../api/api-client'
import { receptionDifferenceCasesApi } from './receptionDifferenceCasesApi'

vi.mock('../../../api/api-client', () => ({ apiRequest: vi.fn(), getCsrfToken: vi.fn() }))

const request = vi.mocked(apiRequest)
const csrf = vi.mocked(getCsrfToken)

describe('receptionDifferenceCasesApi', () => {
  beforeEach(() => {
    request.mockReset()
    csrf.mockReset()
    csrf.mockResolvedValue('csrf-token')
    request.mockResolvedValue({} as never)
  })

  it('consulta el resumen publicado', async () => {
    await receptionDifferenceCasesApi.getSummary()
    expect(request).toHaveBeenCalledWith({
      path: '/logistics/reception-difference-cases/summary',
      method: 'GET',
    })
  })

  it('crea el caso desde la recepción seleccionada', async () => {
    await receptionDifferenceCasesApi.createFromReceipt({ receipt_id: 'receipt-1' })
    expect(request).toHaveBeenCalledWith({
      path: '/logistics/reception-difference-cases/from-receipt',
      method: 'POST',
      headers: { 'X-CSRF-Token': 'csrf-token', 'Idempotency-Key': expect.any(String) },
      body: { receipt_id: 'receipt-1' },
    })
  })
})
