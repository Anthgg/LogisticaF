import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiClient from './api-client'
import { purchaseRequisitionsApi } from './purchase-requisitions-api'
import { vehicleVerificationsApi } from './vehicle-verifications-api'

/**
 * Semántica de los resúmenes sin contrato.
 *
 * El backend no publica `/stats` para estos recursos. Devolver un agregado en
 * cero haría pasar por dato confirmado algo que nadie ha medido: "0
 * requisiciones" y "no lo sabemos" no son lo mismo. Por eso el método falla y
 * la pantalla oculta el bloque.
 */

let requestSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  requestSpy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({} as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resúmenes sin respaldo en el contrato', () => {
  it('requisiciones: no inventa ceros ni llama a un endpoint inexistente', async () => {
    await expect(purchaseRequisitionsApi.getStats()).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED_IN_CONTRACT',
    })

    expect(requestSpy).not.toHaveBeenCalled()
  })

  it('verificaciones vehiculares: mismo criterio', async () => {
    await expect(vehicleVerificationsApi.getStats()).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED_IN_CONTRACT',
    })

    expect(requestSpy).not.toHaveBeenCalled()
  })

  it('el consumidor recibe null y no un agregado en cero', async () => {
    // Es el patrón que ya usan las páginas: .catch(() => null) y el bloque de
    // resumen solo se pinta si hay datos.
    const stats = await purchaseRequisitionsApi.getStats().catch(() => null)

    expect(stats).toBeNull()
  })
})
