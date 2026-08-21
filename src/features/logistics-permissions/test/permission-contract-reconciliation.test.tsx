/**
 * Las pantallas que F006 PR 3.1 reconcilió, una por una.
 *
 * Cada caso monta el proveedor real con **solo** el permiso canónico que el backend
 * exige en el endpoint correspondiente, y comprueba dos cosas: que con ese permiso el
 * gate abre, y que con otro cualquiera no. Antes de la reconciliación el primer aserto
 * fallaba en todas: el código que pedía la pantalla no existía en el catálogo, así que
 * ningún usuario podía tenerlo y la función quedaba oculta para todo el mundo.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { LogisticsAuthorizationProvider } from '../contexts/LogisticsAuthorizationProvider'
import { useLogisticsPermissions } from '../hooks/useLogisticsPermissions'
import { LOGISTICS_PERMISSIONS } from '../logistics-permissions-map'
import {
  UNPUBLISHED_OPERATIONS,
  isUnpublishedOperation,
} from '../unpublished-operations'
import type { LogisticsPermissionsResponse } from '../../../types/logistics-permissions'

const getMyLogisticsPermissions = vi.fn<() => Promise<LogisticsPermissionsResponse>>()

vi.mock('../api/logistics-permissions-api', () => ({
  getMyLogisticsPermissions: () => getMyLogisticsPermissions(),
  refreshMyLogisticsPermissions: () => getMyLogisticsPermissions(),
  getCachedPermissions: () => null,
  invalidatePermissionsCache: () => undefined,
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'u1' } }),
}))

vi.mock('../../logistics-me/hooks/useLogisticsAccess', () => ({
  useLogisticsAccess: () => ({
    isLoading: false,
    isError: false,
    accessStatus: 'enabled',
  }),
}))

function wrapper({ children }: { children: ReactNode }) {
  return <LogisticsAuthorizationProvider>{children}</LogisticsAuthorizationProvider>
}

async function withPermissions(permissions: string[]) {
  getMyLogisticsPermissions.mockResolvedValue({
    success: true,
    catalog_version: '1.2.0',
    user_id: 'u1',
    permissions,
    sensitive_permissions: [],
    step_up_permissions: [],
    roles: [],
  })
  const { result } = renderHook(() => useLogisticsPermissions(), { wrapper })
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  return result
}

/** Un permiso real cualquiera, para comprobar que tener *algo* no basta. */
const OTRO_PERMISO = LOGISTICS_PERMISSIONS.organizations.read

/**
 * Pantalla, permiso canónico y endpoint que lo exige en el backend.
 * El endpoint es la evidencia: ningún permiso se eligió por parecido de nombre.
 */
const RECONCILIADAS: ReadonlyArray<readonly [string, string, string]> = [
  [
    'Kardex · exportaciones',
    LOGISTICS_PERMISSIONS.inventoryLedger.export,
    'POST /inventory/kardex/exports',
  ],
  [
    'Ledger · verificar partición',
    LOGISTICS_PERMISSIONS.inventoryLedger.verifyPartition,
    'POST /inventory/ledger/partitions/{id}/verify',
  ],
  [
    'Ledger · preparación de saldo',
    LOGISTICS_PERMISSIONS.inventoryLedger.viewBalancePreparation,
    'GET /inventory/ledger/balance-preparation',
  ],
  [
    'Ledger · preparación de trazabilidad',
    LOGISTICS_PERMISSIONS.inventoryLedger.viewTraceabilityPreparation,
    'GET /inventory/ledger/traceability-preparation',
  ],
  [
    'OC · generar desde plan',
    LOGISTICS_PERMISSIONS.purchaseOrdersV2.generate,
    'POST /purchase-orders/plan-generation',
  ],
  [
    'OC · rechazar',
    LOGISTICS_PERMISSIONS.purchaseOrdersV2.reject,
    'POST /purchase-orders/{id}/reject',
  ],
  [
    'OC · devolver para cambios',
    LOGISTICS_PERMISSIONS.purchaseOrdersV2.return,
    'POST /purchase-orders/{id}/return-for-changes',
  ],
  [
    'OC · enviar a aprobación',
    LOGISTICS_PERMISSIONS.purchaseOrdersV2.submitForApproval,
    'POST /purchase-orders/{id}/submit',
  ],
  [
    'Calidad · planes de muestreo (leer)',
    LOGISTICS_PERMISSIONS.qualitySamplingPlans.read,
    'GET /quality-inspection-plans/controls/{id}/samplings',
  ],
  [
    'Calidad · planes de muestreo (crear)',
    LOGISTICS_PERMISSIONS.qualitySamplingPlans.create,
    'POST /quality-inspection-plans/controls/{id}/samplings',
  ],
  [
    'Calidad · tolerancias (leer)',
    LOGISTICS_PERMISSIONS.qualityTolerances.read,
    'GET /quality-inspection-plans/controls/{id}/tolerances',
  ],
  [
    'Calidad · tolerancias (crear)',
    LOGISTICS_PERMISSIONS.qualityTolerances.create,
    'POST /quality-inspection-plans/controls/{id}/tolerances',
  ],
  [
    'Evaluaciones · crear',
    LOGISTICS_PERMISSIONS.supplierEvaluations.create,
    'POST /supplier-evaluations/evaluations',
  ],
  [
    'Evaluaciones · calcular',
    LOGISTICS_PERMISSIONS.supplierEvaluations.calculate,
    'POST /supplier-evaluations/evaluations/{id}/calculate',
  ],
  [
    'Evaluaciones · registrar decisión',
    LOGISTICS_PERMISSIONS.supplierEvaluations.recordDecision,
    'POST /supplier-evaluations/evaluations/{id}/decisions',
  ],
  [
    'Evaluaciones · plantillas (leer)',
    LOGISTICS_PERMISSIONS.supplierEvaluations.templatesRead,
    'GET /supplier-evaluations/templates',
  ],
  [
    'Evaluaciones · plantillas (gestionar)',
    LOGISTICS_PERMISSIONS.supplierEvaluations.manageTemplates,
    'POST /supplier-evaluations/templates',
  ],
  [
    'Conductores · categorías de licencia',
    LOGISTICS_PERMISSIONS.drivers.manageCategories,
    'POST /driver-license-categories/seed',
  ],
]

beforeEach(() => {
  getMyLogisticsPermissions.mockReset()
})

describe('F006 PR 3.1 · pantallas reconciliadas', () => {
  it.each(RECONCILIADAS)('%s abre con su permiso canónico', async (_pantalla, code) => {
    const result = await withPermissions([code])
    expect(result.current.hasPermission(code)).toBe(true)
  })

  it.each(RECONCILIADAS)('%s sigue cerrada sin ese permiso', async (_pantalla, code) => {
    const result = await withPermissions([OTRO_PERMISO])
    expect(result.current.hasPermission(code)).toBe(false)
  })

  it('ninguna quedó apuntando a una operación sin publicar', () => {
    for (const [, code] of RECONCILIADAS) {
      expect(code.startsWith('logistics.')).toBe(true)
      expect(isUnpublishedOperation(code)).toBe(false)
    }
  })
})

describe('F006 PR 3.1 · operaciones que el backend no publica', () => {
  const NO_PUBLICADAS = Object.values(UNPUBLISHED_OPERATIONS)

  it.each(NO_PUBLICADAS)('%s no es un código de permiso', (code) => {
    expect(isUnpublishedOperation(code)).toBe(true)
    expect(code.startsWith('logistics.')).toBe(false)
  })

  it('ningún conjunto de permisos las habilita, ni el catálogo entero', async () => {
    const result = await withPermissions(
      Object.values(LOGISTICS_PERMISSIONS).flatMap((grupo) => Object.values(grupo)),
    )
    for (const code of NO_PUBLICADAS) {
      expect(result.current.hasPermission(code)).toBe(false)
    }
  })
})

describe('F006 PR 3.1 · rol personalizado', () => {
  it('un rol con tres permisos muestra exactamente esos tres', async () => {
    const concedidos = [
      LOGISTICS_PERMISSIONS.qualitySamplingPlans.read,
      LOGISTICS_PERMISSIONS.purchaseOrdersV2.view,
      LOGISTICS_PERMISSIONS.organizations.read,
    ]
    const result = await withPermissions(concedidos)

    for (const code of concedidos) {
      expect(result.current.hasPermission(code)).toBe(true)
    }
    expect(
      result.current.hasPermission(
        LOGISTICS_PERMISSIONS.purchaseOrdersV2.approveTransitional,
      ),
    ).toBe(false)
    expect(
      result.current.hasPermission(LOGISTICS_PERMISSIONS.supplierEvaluations.create),
    ).toBe(false)
    expect(
      result.current.hasPermission(LOGISTICS_PERMISSIONS.qualitySamplingPlans.create),
    ).toBe(false)
  })
})
