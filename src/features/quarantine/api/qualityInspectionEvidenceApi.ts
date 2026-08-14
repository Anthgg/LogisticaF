import { apiRequest, getCsrfToken } from '../../../api/api-client'
import { contractGap } from '../../../api/contract-availability'
import type {
  QualityInspectionEvidence,
} from '../types/quarantine'

function generateKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function withCsrf(): Promise<Record<string, string>> {
  const token = await getCsrfToken()
  return { 'X-CSRF-Token': token }
}

export const qualityInspectionEvidenceApi = {
  /** GET /quality-inspections/{inspectionId}/evidence */
  async list(inspectionId: string): Promise<QualityInspectionEvidence[]> {
    return apiRequest({ path: `/logistics/quality-inspections/${inspectionId}/evidence` })
  },

  /** POST /quality-inspections/{inspectionId}/evidence-links */
  async createLink(inspectionId: string, data: Record<string, unknown>): Promise<QualityInspectionEvidence> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `/logistics/quality-inspections/${inspectionId}/evidence-links`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  /**
   * Sin contrato: el backend no publica una sesión de carga para la evidencia.
   * Solo existe `POST /quality-inspections/{id}/evidence-links`, que enlaza un
   * archivo ya subido por el repositorio de archivos.
   */
  async createUploadSession(_inspectionId: string, _data: Record<string, unknown>): Promise<never> {
    throw contractGap('La carga directa de evidencia')
  },

  /** Sin contrato: el backend no publica el archivado de evidencia. */
  async archive(_evidenceId: string): Promise<never> {
    throw contractGap('Archivar evidencia')
  },
}
