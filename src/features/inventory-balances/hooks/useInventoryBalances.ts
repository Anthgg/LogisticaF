import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '../../inbound-docks/hooks/useQuery'
import type { QueryState } from '../../inbound-docks/hooks/useQuery'
import { ApiRequestError } from '../../../types/api'
import { getErrorMessage } from '../../../utils/errors'
import {
  BALANCES_BASE_PATH,
  inventoryBalancesApi,
  normalizePositionBalance,
  normalizeSummary,
} from '../api/inventory-balances-api'
import type {
  InventoryBalanceSummary,
  InventoryPositionBalance,
  RebuildJobCreate,
  RebuildJobRead,
} from '../types/inventory-balances'

/**
 * Claves de consulta de Fase 045.
 *
 * La organización va SIEMPRE en la clave: al cambiar de tenant la clave cambia,
 * el hook descarta el dato anterior y vuelve a pedir. Nunca se muestra el saldo
 * del tenant A bajo el tenant B.
 */
export const balancesQueryKeys = {
  summary: (
    organizationId: string | null,
    warehouseId: string | null,
    productId: string | null,
  ) => ['inventory-balances', 'summary', organizationId, warehouseId, productId] as const,
  position: (positionId: string | null) =>
    ['inventory-balances', 'position', positionId] as const,
}

export interface UseBalanceSummaryArgs {
  organizationId: string | null
  warehouseId?: string | null
  productId?: string | null
}

/** `GET /logistics/inventory/balances/summary` con normalización decimal. */
export function useBalanceSummary({
  organizationId,
  warehouseId = null,
  productId = null,
}: UseBalanceSummaryArgs): QueryState<InventoryBalanceSummary> {
  const key = useMemo(
    () => balancesQueryKeys.summary(organizationId, warehouseId, productId),
    [organizationId, warehouseId, productId],
  )

  const params = useMemo(
    () => ({
      organization_id: organizationId ?? undefined,
      warehouse_id: warehouseId ?? undefined,
      product_id: productId ?? undefined,
    }),
    [organizationId, warehouseId, productId],
  )

  const query = useQuery<unknown>(key, `${BALANCES_BASE_PATH}/summary`, params, {
    enabled: Boolean(organizationId),
  })

  const data = useMemo(
    () => (query.data === undefined ? undefined : normalizeSummary(query.data)),
    [query.data],
  )

  return { ...query, data } as QueryState<InventoryBalanceSummary>
}

/** `GET /logistics/inventory/balances/positions/{position_id}`. */
export function usePositionBalance(
  positionId: string | null,
): QueryState<InventoryPositionBalance> {
  const key = useMemo(() => balancesQueryKeys.position(positionId), [positionId])

  const query = useQuery<unknown>(
    key,
    `${BALANCES_BASE_PATH}/positions/${positionId ?? ''}`,
    undefined,
    { enabled: Boolean(positionId) },
  )

  const data = useMemo(
    () => (query.data === undefined ? undefined : normalizePositionBalance(query.data)),
    [query.data],
  )

  return { ...query, data } as QueryState<InventoryPositionBalance>
}

export interface RebuildMutationState {
  isPending: boolean
  error: string | null
  errorCode: string | null
  status: number | null
  job: RebuildJobRead | null
  requestRebuild: (
    payload: RebuildJobCreate,
    options?: { stepUpProofId?: string | null },
  ) => Promise<RebuildJobRead | undefined>
  reset: () => void
}

/**
 * `POST /logistics/inventory/balances/rebuild`.
 *
 * El CSRF lo resuelve `apiRequest` (`requiresCsrf`). El Step-Up se envía como
 * cabecera solo si la infraestructura central ya obtuvo una prueba real; aquí
 * nunca se genera un proof id.
 */
export function useRebuildBalances(
  onSuccess?: (job: RebuildJobRead) => void,
): RebuildMutationState {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [status, setStatus] = useState<number | null>(null)
  const [job, setJob] = useState<RebuildJobRead | null>(null)

  const reset = useCallback(() => {
    setError(null)
    setErrorCode(null)
    setStatus(null)
    setJob(null)
  }, [])

  const requestRebuild = useCallback(
    async (
      payload: RebuildJobCreate,
      options: { stepUpProofId?: string | null } = {},
    ): Promise<RebuildJobRead | undefined> => {
      setIsPending(true)
      setError(null)
      setErrorCode(null)
      setStatus(null)
      try {
        const result = await inventoryBalancesApi.requestRebuild(payload, {
          stepUpProofId: options.stepUpProofId ?? null,
        })
        setJob(result)
        onSuccess?.(result)
        return result
      } catch (caught) {
        setError(getErrorMessage(caught))
        if (caught instanceof ApiRequestError) {
          setErrorCode(caught.code)
          setStatus(caught.status)
        }
        return undefined
      } finally {
        setIsPending(false)
      }
    },
    [onSuccess],
  )

  return { isPending, error, errorCode, status, job, requestRebuild, reset }
}
