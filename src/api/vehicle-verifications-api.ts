import { apiRequest, getCsrfToken } from './api-client'
import { contractGap } from './contract-availability'
import type { PaginatedResponse } from '../types/logistics-resources'
import type {
  AssistedVehicleVerification,
  AssistedVehicleVerificationCreate,
  VehicleVerification,
  VehicleVerificationApplyRequest,
  VehicleVerificationCompliance,
  VehicleVerificationConflict,
  VehicleVerificationConflictResolve,
  VehicleVerificationConflictReviewStart,
  VehicleVerificationEvidence,
  VehicleVerificationListQuery,
  VehicleVerificationRequest,
  VehicleVerificationRequirement,
  VehicleVerificationRequirementCreate,
  VehicleVerificationRequirementUpdate,
  VehicleVerificationReviewTask,
  VehicleVerificationReviewTaskAssign,
  VehicleVerificationReviewTaskComplete,
  VehicleVerificationReviewTaskStart,
  VehicleVerificationSourceHealth,
  VehicleVerificationSourceType,
  VehicleVerificationStats,
  VehicleVerificationSummary,
} from '../types/vehicle-verifications'

export const vehicleVerificationsApi = {
  // ── Verifications List & Detail ───────────────────────────────────────────

  /**
   * El contrato solo permite listar las verificaciones **de un vehiculo**. Sin
   * `vehicle_id` no hay consulta posible: se falla en vez de devolver una lista
   * vacia, que se leeria como "este vehiculo no tiene verificaciones".
   */
  async list(query?: VehicleVerificationListQuery): Promise<PaginatedResponse<VehicleVerificationSummary>> {
    if (!query?.vehicle_id) {
      throw contractGap('El listado global de verificaciones')
    }
    const items = await this.listByVehicle(query.vehicle_id)
    return {
      items: items as unknown as VehicleVerificationSummary[],
      page: 1,
      page_size: items.length,
      total: items.length,
      total_pages: 1,
    }
  },

  /**
   * El contrato no publica el detalle por `verification_id`: la verificacion
   * solo es alcanzable desde su vehiculo (`listByVehicle`). Devolver un objeto
   * inventado aqui haria pasar por verificada una unidad que nadie verifico,
   * asi que se falla de forma explicita.
   */
  async get(_id: string): Promise<VehicleVerification> {
    throw contractGap('El detalle de una verificacion por identificador')
  },

  async getStats(): Promise<VehicleVerificationStats> {
    // Sin contrato: el backend no publica /stats y "stats" caeria en un path
    // param UUID (422). Se falla explicitamente en vez de devolver ceros: un
    // agregado en cero se lee como dato confirmado, y aqui no hay dato. El
    // consumidor ya trata el fallo mostrando la seccion como no disponible.
    throw contractGap('El resumen de verificaciones')
  },

  async listByVehicle(vehicleId: string): Promise<VehicleVerification[]> {
    const res = await apiRequest<VehicleVerification[] | { items: VehicleVerification[] }>({
      path: `/logistics/vehicles/${vehicleId}/verifications`,
    })
    if (Array.isArray(res)) return res
    if (res && 'items' in res && Array.isArray(res.items)) return res.items
    throw new Error('El backend devolvió un listado de verificaciones con formato inválido.')
  },

  async getVehicleCompliance(vehicleId: string): Promise<VehicleVerificationCompliance> {
    return apiRequest({ path: `/logistics/vehicles/${vehicleId}/verification-compliance` })
  },

  // ── Requests & Operations ─────────────────────────────────────────────────

  async requestVerification(data: VehicleVerificationRequest): Promise<VehicleVerification> {
    const csrfToken = await getCsrfToken()
    return apiRequest({
      path: `/logistics/vehicles/${data.vehicle_id}/verifications`,
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: data,
    })
  },

  async retryVerification(_id: string): Promise<VehicleVerification> {
    throw contractGap('Reintentar una verificacion')
  },

  async cancelVerification(_id: string, _reason: string): Promise<VehicleVerification> {
    throw contractGap('Cancelar una verificacion')
  },

  async revokeVerification(_id: string, _reason: string): Promise<VehicleVerification> {
    throw contractGap('Revocar una verificacion')
  },

  async applyVerification(id: string, data: VehicleVerificationApplyRequest): Promise<VehicleVerification> {
    const csrfToken = await getCsrfToken()
    return apiRequest({
      path: `/logistics/vehicle-verifications/${id}/apply`,
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: data,
    })
  },

  /**
   * La evidencia viaja embebida en la verificacion (`evidences`); el contrato
   * no publica un recurso de metadatos por evidencia.
   */
  async getEvidenceMetadata(_id: string, _evidenceId: string): Promise<VehicleVerificationEvidence> {
    throw contractGap('Los metadatos de una evidencia de verificacion')
  },

  // ── Assisted Verifications ────────────────────────────────────────────────

  async listAssistedVerifications(): Promise<AssistedVehicleVerification[]> {
    throw contractGap('El listado de verificaciones asistidas')
  },

  async createAssistedVerification(data: AssistedVehicleVerificationCreate): Promise<AssistedVehicleVerification> {
    const csrfToken = await getCsrfToken()
    return apiRequest({
      path: `/logistics/vehicles/${data.vehicle_id}/assisted-verifications`,
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: data,
    })
  },

  async updateAssistedVerification(_id: string, _data: Partial<AssistedVehicleVerificationCreate>): Promise<never> {
    throw contractGap('Editar una verificación asistida')
  },

  async submitAssistedVerification(_id: string): Promise<never> {
    throw contractGap('Enviar una verificación asistida')
  },

  async approveAssistedVerification(id: string, notes?: string): Promise<AssistedVehicleVerification> {
    const csrfToken = await getCsrfToken()
    return apiRequest({
      path: `/logistics/assisted-vehicle-verifications/${id}/approve`,
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: { notes },
    })
  },

  async rejectAssistedVerification(_id: string, _reason: string): Promise<never> {
    throw contractGap('Rechazar una verificación asistida')
  },

  // ── Sources & Health ──────────────────────────────────────────────────────

  async listSourcesHealth(): Promise<VehicleVerificationSourceHealth[]> {
    const res = await apiRequest<VehicleVerificationSourceHealth[] | { items: VehicleVerificationSourceHealth[] }>({
      path: '/logistics/vehicle-verification-sources',
    })
    if (Array.isArray(res)) return res
    if (res && 'items' in res && Array.isArray(res.items)) return res.items
    throw new Error('El backend devolvió las fuentes de verificación con formato inválido.')
  },

  async getSource(_sourceType: VehicleVerificationSourceType): Promise<never> {
    throw contractGap('El detalle individual de una fuente de verificación')
  },

  async checkSourceHealth(_sourceType: VehicleVerificationSourceType): Promise<never> {
    throw contractGap('La comprobación individual de una fuente de verificación')
  },

  async enableSource(_sourceType: VehicleVerificationSourceType, _reason: string): Promise<never> {
    throw contractGap('Habilitar una fuente de verificación')
  },

  async disableSource(_sourceType: VehicleVerificationSourceType, _reason: string): Promise<never> {
    throw contractGap('Deshabilitar una fuente de verificación')
  },

  // ── Conflicts ─────────────────────────────────────────────────────────────

  async listConflicts(_status?: string): Promise<VehicleVerificationConflict[]> {
    throw contractGap('El listado de conflictos de verificaciones vehiculares')
  },

  async getConflict(_conflictId: string): Promise<never> {
    throw contractGap('El detalle de un conflicto de verificación')
  },

  async startConflictReview(_conflictId: string, _data: VehicleVerificationConflictReviewStart): Promise<never> {
    throw contractGap('Iniciar la revisión de un conflicto de verificación')
  },

  async resolveConflict(_conflictId: string, _data: VehicleVerificationConflictResolve): Promise<never> {
    throw contractGap('Resolver un conflicto de verificación')
  },

  async dismissConflict(_conflictId: string, _reason: string): Promise<never> {
    throw contractGap('Descartar un conflicto de verificación')
  },

  // ── Requirements & Policies ───────────────────────────────────────────────

  async listRequirements(): Promise<VehicleVerificationRequirement[]> {
    throw contractGap('El listado de requisitos de verificación vehicular')
  },

  async createRequirement(_data: VehicleVerificationRequirementCreate): Promise<never> {
    throw contractGap('Crear un requisito de verificación vehicular')
  },

  async updateRequirement(_id: string, _data: VehicleVerificationRequirementUpdate): Promise<never> {
    throw contractGap('Editar un requisito de verificación vehicular')
  },

  async validateRequirement(_id: string): Promise<never> {
    throw contractGap('Validar un requisito de verificación vehicular')
  },

  async activateRequirement(_id: string): Promise<never> {
    throw contractGap('Activar un requisito de verificación vehicular')
  },

  async retireRequirement(_id: string, _reason: string): Promise<never> {
    throw contractGap('Retirar un requisito de verificación vehicular')
  },

  // ── Review Tasks ──────────────────────────────────────────────────────────

  async listReviewTasks(): Promise<VehicleVerificationReviewTask[]> {
    throw contractGap('El listado de tareas de revisión vehicular')
  },

  async assignReviewTask(_taskId: string, _data: VehicleVerificationReviewTaskAssign): Promise<never> {
    throw contractGap('Asignar una tarea de revisión vehicular')
  },

  async startReviewTask(_taskId: string, _data: VehicleVerificationReviewTaskStart): Promise<never> {
    throw contractGap('Iniciar una tarea de revisión vehicular')
  },

  async completeReviewTask(_taskId: string, _data: VehicleVerificationReviewTaskComplete): Promise<never> {
    throw contractGap('Completar una tarea de revisión vehicular')
  },
}
