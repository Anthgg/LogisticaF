import { ApiRequestError } from '../types/api'

/**
 * Capacidades que el backend de Fase 045 no publica.
 *
 * Cuando una pantalla ofrece una acción que el contrato no soporta, la llamada
 * NO se emite: se falla aquí de forma explícita. Así no se produce un 404 ni
 * un 422 en runtime, y la UI puede distinguir "el backend no ofrece esto" de
 * "no hay datos", que son cosas distintas.
 *
 * El inventario razonado de cada hueco vive en
 * `docs/audits/post-phase-045-backend-capability-gaps.md`.
 */
export const CONTRACT_GAP_CODE = 'NOT_IMPLEMENTED_IN_CONTRACT'

export function contractGap(capability: string): ApiRequestError {
  return new ApiRequestError(
    `${capability} todavía no está disponible en el backend.`,
    { code: CONTRACT_GAP_CODE, status: 501 },
  )
}

/** `true` si el error proviene de una capacidad ausente del contrato. */
export function isContractGap(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === CONTRACT_GAP_CODE
}
