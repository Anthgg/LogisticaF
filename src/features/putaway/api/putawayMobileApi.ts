import { ApiRequestError } from '../../../types/api'

/**
 * Terminal móvil de putaway.
 *
 * NINGUNO de los tres endpoints que consumía existe en el backend:
 * `/putaway/scan`, `/putaway/users/{id}/workspace` y
 * `/putaway/users/{id}/active-task` devuelven 404.
 *
 * El escaneo real del contrato es `POST /putaway/sessions/{session_id}/scans`,
 * que exige una sesión de putaway que este flujo todavía no abre. Migrarlo
 * requiere decidir dónde se crea esa sesión, así que no se hace aquí: inventar
 * la ruta solo producía 404 en runtime.
 */
const NOT_AVAILABLE = new ApiRequestError(
  'El terminal móvil de ubicación todavía no está disponible.',
  { code: 'NOT_IMPLEMENTED_IN_CONTRACT', status: 501 },
)

export const putawayMobileApi = {
  async getWorkspace(_userId: string): Promise<unknown> {
    throw NOT_AVAILABLE
  },

  async scanCode(_code: string, _context?: Record<string, unknown>): Promise<unknown> {
    throw NOT_AVAILABLE
  },

  async getActiveTask(_userId: string): Promise<unknown> {
    throw NOT_AVAILABLE
  },
}
