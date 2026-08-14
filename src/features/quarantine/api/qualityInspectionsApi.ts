import { apiRequest, getCsrfToken } from '../../../api/api-client'
import { contractGap } from '../../../api/contract-availability'
import type {
  QualityInspection,
  QualityInspectionControl,
  QualityMeasurement,
  QualityInspectionSampleSet,
  QualityCertificateReview,
  QualityInspectionEvidence,
} from '../types/quarantine'

const BASE = '/logistics/quality-inspections'
const CONTROLS_BASE = '/logistics/quality-inspection-controls'

function generateKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function withCsrf(): Promise<Record<string, string>> {
  const token = await getCsrfToken()
  return { 'X-CSRF-Token': token }
}

function buildQuery(params: Record<string, unknown>): string {
  const entries: [string, string][] = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) {
      for (const item of v) entries.push([k, String(item)])
    } else {
      entries.push([k, String(v)])
    }
  }
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : ''
}

export const qualityInspectionsApi = {
  /** GET /quality-inspections */
  async list(query?: Record<string, unknown>): Promise<QualityInspection[]> {
    return apiRequest({ path: `${BASE}${query ? buildQuery(query) : ''}`, method: 'GET' })
  },

  /** GET /quality-inspections/{inspectionId} */
  async get(inspectionId: string): Promise<QualityInspection> {
    return apiRequest({ path: `${BASE}/${inspectionId}`, method: 'GET' })
  },

  /** POST /quality-inspections/{inspectionId}/start */
  async start(inspectionId: string): Promise<QualityInspection> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/${inspectionId}/start`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: {},
    })
  },

  /** Sin contrato: F045 no publica pausa de inspecciones. */
  async pause(_inspectionId: string, _data?: { reason?: string }): Promise<never> {
    throw contractGap('Pausar una inspección de calidad')
  },

  /** Sin contrato: F045 no publica reanudación de inspecciones. */
  async resume(_inspectionId: string, _data?: { reason?: string }): Promise<never> {
    throw contractGap('Reanudar una inspección de calidad')
  },

  /** POST /quality-inspections/{inspectionId}/complete */
  async complete(inspectionId: string, data?: { overall_result?: string; summary?: string }): Promise<QualityInspection> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/${inspectionId}/complete`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data ?? {},
    })
  },

  /** GET /quality-inspections/{inspectionId}/controls */
  async listControls(inspectionId: string): Promise<QualityInspectionControl[]> {
    return apiRequest({ path: `${BASE}/${inspectionId}/controls`, method: 'GET' })
  },

  /** POST /quality-inspection-controls/{controlId}/results */
  async recordControlResult(controlId: string, data: Record<string, unknown>): Promise<QualityInspectionControl> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${CONTROLS_BASE}/${controlId}/results`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  /** Sin contrato: F045 no publica correcciones de resultados de control. */
  async requestControlResultCorrection(_controlId: string, _data: Record<string, unknown>): Promise<never> {
    throw contractGap('Solicitar la corrección de un resultado')
  },

  /** Sin contrato: los controles se registran directamente mediante /results. */
  async startControl(_controlId: string): Promise<never> {
    throw contractGap('Iniciar un control de inspección')
  },

  /** Sin contrato: no existe una transición separada a no aplicable. */
  async markControlNotApplicable(_controlId: string): Promise<never> {
    throw contractGap('Marcar un control como no aplicable')
  },

  /** GET /quality-inspections/{inspectionId}/measurements */
  async listMeasurements(inspectionId: string): Promise<QualityMeasurement[]> {
    return apiRequest({ path: `${BASE}/${inspectionId}/measurements`, method: 'GET' })
  },

  /** POST /quality-inspections/{inspectionId}/measurements */
  async createMeasurement(inspectionId: string, data: Record<string, unknown>): Promise<QualityMeasurement> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/${inspectionId}/measurements`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },

  /** GET /quality-inspections/{inspectionId}/sample-sets */
  async listSampleSets(inspectionId: string): Promise<QualityInspectionSampleSet[]> {
    return apiRequest({ path: `${BASE}/${inspectionId}/sample-sets`, method: 'GET' })
  },

  /** GET /quality-inspections/{inspectionId}/certificate-reviews */
  async listCertificateReviews(inspectionId: string): Promise<QualityCertificateReview[]> {
    return apiRequest({ path: `${BASE}/${inspectionId}/certificate-reviews`, method: 'GET' })
  },

  /** GET /quality-inspections/{inspectionId}/evidence */
  async listEvidence(inspectionId: string): Promise<QualityInspectionEvidence[]> {
    return apiRequest({ path: `${BASE}/${inspectionId}/evidence`, method: 'GET' })
  },

  /** POST /quality-inspections/{inspectionId}/evidence-links */
  async createEvidenceLink(inspectionId: string, data: Record<string, unknown>): Promise<QualityInspectionEvidence> {
    const csrf = await withCsrf()
    return apiRequest({
      path: `${BASE}/${inspectionId}/evidence-links`,
      method: 'POST',
      headers: { ...csrf, 'Idempotency-Key': generateKey() },
      body: data,
    })
  },
}
