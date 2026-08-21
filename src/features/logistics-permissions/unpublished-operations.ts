/**
 * Operaciones que la interfaz ofrece y el backend todavía no publica.
 *
 * Hasta F006 PR 3.1 estas acciones se cerraban exigiendo un código de permiso
 * inventado (`logistics.supplier_evaluations.issue_cco` y compañía). Funcionaba por
 * accidente: como el permiso no existe en el catálogo, nadie lo tenía y el botón no
 * aparecía. Pero mentía sobre el motivo —parecía un problema de permisos cuando era
 * una función sin endpoint— y ensuciaba el contrato con códigos que el backend nunca
 * podría conceder.
 *
 * El centinela deja el motivo por escrito. No es un código de permiso: no empieza por
 * `logistics.`, así que el auditor de contrato lo ignora, y `hasPermission` lo niega
 * como cualquier otra cadena que no esté en el conjunto efectivo. La acción sigue
 * cerrada; ahora se sabe por qué.
 *
 * Cuando el backend publique la operación, se sustituye por su permiso canónico.
 */
export const UNPUBLISHED_OPERATIONS = {
  /** El cliente de despacho de OC lanza «no publicado como endpoint» en cada método. */
  purchaseOrderDispatch: 'UNPUBLISHED:purchase_order_dispatch',
  /** `evaluationScoresApi.disqualify` devuelve un objeto fabricado en el cliente. */
  evaluationDisqualification: 'UNPUBLISHED:evaluation_disqualification',
  /** `evaluationScoresApi.requestOverride` fabrica la respuesta; no hay endpoint. */
  evaluationScoreOverride: 'UNPUBLISHED:evaluation_score_override',
  /** `evaluationDocumentsApi` completo es simulado: no existe emisión de CCO. */
  comparativeDocument: 'UNPUBLISHED:comparative_document',
} as const

export type UnpublishedOperation =
  (typeof UNPUBLISHED_OPERATIONS)[keyof typeof UNPUBLISHED_OPERATIONS]

/** Texto para `disabledReason` / tooltips: dice la verdad sobre por qué está cerrado. */
export const UNPUBLISHED_OPERATION_REASON =
  'El backend todavía no publica esta operación.'

export function isUnpublishedOperation(code: string): boolean {
  return code.startsWith('UNPUBLISHED:')
}
