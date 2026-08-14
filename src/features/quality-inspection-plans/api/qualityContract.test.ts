import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, getCsrfToken } from '../../../api/api-client'
import { qualityCertificateRequirementsApi } from './qualityCertificateRequirementsApi'
import { qualityControlsApi } from './qualityControlsApi'
import { qualityPlanAnalyticsApi } from './qualityPlanResolutionApi'
import { qualityPlanScopesApi } from './qualityPlanScopesApi'
import { qualitySamplingPlansApi } from './qualitySamplingPlansApi'
import { qualityTolerancesApi } from './qualityTolerancesApi'

vi.mock('../../../api/api-client', () => ({
  apiRequest: vi.fn(),
  getCsrfToken: vi.fn(),
}))

const mockedApiRequest = vi.mocked(apiRequest)
const mockedGetCsrfToken = vi.mocked(getCsrfToken)

describe('contrato de planes de inspección de calidad', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedApiRequest.mockResolvedValue({} as never)
    mockedGetCsrfToken.mockResolvedValue('csrf-quality')
  })

  it('lista y crea controles bajo el plan real', async () => {
    await qualityControlsApi.list('plan-41')
    await qualityControlsApi.create('plan-41', {
      code: 'PESO-1',
      name: 'Control de peso',
      control_type: 'WEIGHT',
      result_value_type: 'DECIMAL',
    })

    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, {
      path: '/logistics/quality-inspection-plans/plan-41/controls',
      method: 'GET',
    })
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
      path: '/logistics/quality-inspection-plans/plan-41/controls',
      method: 'POST',
      headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-quality', 'Idempotency-Key': expect.any(String) }),
    }))
  })

  it('lista y crea ámbitos bajo el plan real', async () => {
    await qualityPlanScopesApi.list('plan-41')
    await qualityPlanScopesApi.create('plan-41', {
      scope_type: 'PRODUCT',
      action: 'INCLUDE',
      product_id: 'product-8',
    })

    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, {
      path: '/logistics/quality-inspection-plans/plan-41/scopes',
      method: 'GET',
    })
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
      path: '/logistics/quality-inspection-plans/plan-41/scopes',
      method: 'POST',
    }))
  })

  it('ancla certificados al control y modifica/elimina por requirement_id', async () => {
    const input = { code: 'CERT-1', name: 'Certificado sanitario', required: true }

    await qualityCertificateRequirementsApi.create('control-9', input)
    await qualityCertificateRequirementsApi.update('certificate-2', input)
    await qualityCertificateRequirementsApi.delete('certificate-2')

    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, expect.objectContaining({
      path: '/logistics/quality-inspection-plans/controls/control-9/certificates',
      method: 'POST',
      body: input,
    }))
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
      path: '/logistics/quality-inspection-plans/certificates/certificate-2',
      method: 'PATCH',
      body: input,
    }))
    expect(mockedApiRequest).toHaveBeenNthCalledWith(3, expect.objectContaining({
      path: '/logistics/quality-inspection-plans/certificates/certificate-2',
      method: 'DELETE',
    }))
  })

  it('valida mediante GET del plan y no mediante una versión', async () => {
    await qualityPlanAnalyticsApi.validate('plan-41')

    expect(mockedApiRequest).toHaveBeenCalledWith({
      path: '/logistics/quality-inspection-plans/plan-41/validate',
      method: 'GET',
    })
  })

  it('mantiene el muestreo bajo control con payload F045 exacto', async () => {
    const input = {
      sampling_type: 'FIXED',
      fixed_count: 5,
      percentage: null,
      minimum_count: 2,
      package_level: null,
      lot_level: null,
      custom_formula: null,
      description: 'Cinco unidades por lote',
    }

    await qualitySamplingPlansApi.list('control-9')
    await qualitySamplingPlansApi.create('control-9', input)
    await qualitySamplingPlansApi.update('sampling-3', input)
    await qualitySamplingPlansApi.delete('sampling-3')

    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, {
      path: '/logistics/quality-inspection-plans/controls/control-9/samplings',
      method: 'GET',
    })
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
      path: '/logistics/quality-inspection-plans/controls/control-9/samplings',
      method: 'POST',
      body: input,
    }))
    expect(mockedApiRequest).toHaveBeenNthCalledWith(3, expect.objectContaining({
      path: '/logistics/quality-inspection-plans/samplings/sampling-3',
      method: 'PATCH',
      body: input,
    }))
    expect(mockedApiRequest).toHaveBeenNthCalledWith(4, expect.objectContaining({
      path: '/logistics/quality-inspection-plans/samplings/sampling-3',
      method: 'DELETE',
    }))
  })

  it('mantiene tolerancias bajo control con payload F045 exacto', async () => {
    const input = {
      tolerance_type: 'RANGE',
      min_value: '2.5',
      max_value: '3.5',
      target_value: '3.0',
      absolute_deviation: '0.5',
      percentage_deviation: null,
      valid_options: null,
      default_value: null,
      unit_code: 'KG',
      description: 'Peso aceptable',
    }

    await qualityTolerancesApi.list('control-9')
    await qualityTolerancesApi.create('control-9', input)
    await qualityTolerancesApi.update('tolerance-4', input)
    await qualityTolerancesApi.delete('tolerance-4')

    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, {
      path: '/logistics/quality-inspection-plans/controls/control-9/tolerances',
      method: 'GET',
    })
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
      path: '/logistics/quality-inspection-plans/controls/control-9/tolerances',
      method: 'POST',
      body: input,
    }))
    expect(mockedApiRequest).toHaveBeenNthCalledWith(3, expect.objectContaining({
      path: '/logistics/quality-inspection-plans/tolerances/tolerance-4',
      method: 'PATCH',
      body: input,
    }))
    expect(mockedApiRequest).toHaveBeenNthCalledWith(4, expect.objectContaining({
      path: '/logistics/quality-inspection-plans/tolerances/tolerance-4',
      method: 'DELETE',
    }))
  })
})
