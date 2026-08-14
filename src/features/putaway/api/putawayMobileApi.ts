import { ApiRequestError } from '../../../types/api'
import { putawayPlacementsApi } from './putawayPlacementsApi'
import { putawaySessionsApi } from './putawaySessionsApi'
import { putawayTasksApi } from './putawayTasksApi'
import type {
  PutawayExecutionSessionApi,
  PutawayOperationalPlacementApi,
  PutawayPlacementConfirmationApi,
  PutawayScanEventApi,
  PutawayScanRecordRequest,
  PutawayScanType,
  PutawayScannerType,
  PutawayTaskApi,
} from '../types/putaway-api'

const PRODUCT_VALID_RESULTS = new Set(['VALID', 'MATCH'])
const LOCATION_VALID_RESULTS = new Set(['VALID', 'MATCH_RECOMMENDED', 'VALID_ALTERNATIVE'])

export interface PutawayMobileWorkflowInput {
  task: PutawayTaskApi
  productCode: string
  locationCode: string
  locationId?: string
  scannerType?: PutawayScannerType
  observation?: string
}

export interface PutawayMobileWorkflowResult {
  session: PutawayExecutionSessionApi
  productScan: PutawayScanEventApi
  locationScan: PutawayScanEventApi
  confirmation: PutawayPlacementConfirmationApi
  completedSession: PutawayExecutionSessionApi
  placement: PutawayOperationalPlacementApi
}

function clientScanId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function sha256(value: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new ApiRequestError('Este dispositivo no permite proteger el código escaneado.', {
      code: 'PUTAWAY_SCAN_HASH_UNAVAILABLE',
      status: null,
    })
  }

  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function scanRequest(scanType: PutawayScanType, code: string): Promise<PutawayScanRecordRequest> {
  const normalizedCode = code.trim()
  if (!normalizedCode) {
    throw new ApiRequestError('Escanea o escribe un código antes de continuar.', {
      code: 'PUTAWAY_SCAN_CODE_REQUIRED',
      status: 422,
    })
  }

  return {
    client_scan_id: clientScanId(),
    scan_type: scanType,
    normalized_code: normalizedCode,
    code_hash: await sha256(normalizedCode),
  }
}

function assertValidScan(
  event: PutawayScanEventApi,
  accepted: ReadonlySet<string>,
  label: string,
): PutawayScanEventApi {
  if (!event.validation_status || !accepted.has(event.validation_status)) {
    const reason = event.validation_status?.replaceAll('_', ' ').toLowerCase() ?? 'sin resultado'
    throw new ApiRequestError(`El backend rechazó el escaneo de ${label}: ${reason}.`, {
      code: `PUTAWAY_${label.toUpperCase()}_SCAN_INVALID`,
      status: 422,
    })
  }
  return event
}

function placementLocation(task: PutawayTaskApi, explicitLocationId?: string): string {
  const locationId = explicitLocationId || task.selected_location_id || task.recommended_location_id
  if (!locationId) {
    throw new ApiRequestError('La tarea no tiene una ubicación de destino confirmable.', {
      code: 'PUTAWAY_LOCATION_REQUIRED',
      status: 422,
    })
  }
  return locationId
}

function placementQuantity(task: PutawayTaskApi): string | number {
  const quantity = Number(task.remaining_quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ApiRequestError('La tarea no tiene cantidad pendiente para ubicar.', {
      code: 'PUTAWAY_QUANTITY_REQUIRED',
      status: 422,
    })
  }
  return task.remaining_quantity
}

export const putawayMobileApi = {
  async createSession(
    taskId: string,
    scannerType: PutawayScannerType = 'MOBILE_CAMERA',
  ): Promise<PutawayExecutionSessionApi> {
    return putawayTasksApi.createSession(taskId, { scanner_type: scannerType })
  },

  async scanProduct(
    sessionId: string,
    code: string,
    expectedProductId: string,
  ): Promise<PutawayScanEventApi> {
    const event = await putawaySessionsApi.createScan(sessionId, await scanRequest('PRODUCT', code))
    const validated = await putawaySessionsApi.validateProduct(sessionId, event.id, {
      expected_product_id: expectedProductId,
    })
    return assertValidScan(validated, PRODUCT_VALID_RESULTS, 'producto')
  },

  async scanLocation(
    sessionId: string,
    code: string,
    expectedLocationId: string,
  ): Promise<PutawayScanEventApi> {
    const event = await putawaySessionsApi.createScan(sessionId, await scanRequest('LOCATION', code))
    const validated = await putawaySessionsApi.validateLocation(sessionId, event.id, {
      expected_location_id: expectedLocationId,
    })
    return assertValidScan(validated, LOCATION_VALID_RESULTS, 'ubicación')
  },

  async confirmPlacement(
    task: PutawayTaskApi,
    productScan: PutawayScanEventApi,
    locationScan: PutawayScanEventApi,
    locationId = placementLocation(task),
    observation?: string,
  ): Promise<PutawayPlacementConfirmationApi> {
    const quantity = placementQuantity(task)
    return putawayTasksApi.createPlacement(task.id, {
      source_allocation_id: task.source_allocation_id,
      location_id: locationId,
      quantity,
      unit_id: task.required_unit_id,
      product_scan_event_id: productScan.id,
      location_scan_event_id: locationScan.id,
      observation: observation?.trim() || undefined,
    })
  },

  async completeSession(sessionId: string): Promise<PutawayExecutionSessionApi> {
    return putawaySessionsApi.completeSession(sessionId)
  },

  async finalizePlacement(confirmationId: string): Promise<PutawayOperationalPlacementApi> {
    return putawayPlacementsApi.finalizePlacement(confirmationId)
  },

  async completeWorkflow(input: PutawayMobileWorkflowInput): Promise<PutawayMobileWorkflowResult> {
    const locationId = placementLocation(input.task, input.locationId)
    placementQuantity(input.task)
    const session = await this.createSession(input.task.id, input.scannerType)
    const productScan = await this.scanProduct(session.id, input.productCode, input.task.expected_product_id)
    const locationScan = await this.scanLocation(session.id, input.locationCode, locationId)
    const confirmation = await this.confirmPlacement(
      input.task,
      productScan,
      locationScan,
      locationId,
      input.observation,
    )
    const completedSession = await this.completeSession(session.id)
    const placement = await this.finalizePlacement(confirmation.id)

    return { session, productScan, locationScan, confirmation, completedSession, placement }
  },
}
