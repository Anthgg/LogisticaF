interface ReceptionDifferenceQualityPlanPreviewPanelProps {
  caseId: string
}

/**
 * F045 no publica una vista previa de calidad para una diferencia ya creada.
 * La creación real parte de un receipt seleccionado (`from-receipt`) y el
 * resumen se consulta en el recurso global. Mantener este panel explícito evita
 * confundir "API no disponible" con "no hay plan" y, sobre todo, no emite una
 * petición a `{caseId}/quality-preview`.
 */
export function ReceptionDifferenceQualityPlanPreviewPanel({
  caseId,
}: ReceptionDifferenceQualityPlanPreviewPanelProps) {
  return (
    <section className="space-y-3" aria-labelledby={`quality-preview-${caseId}`}>
      <h3 id={`quality-preview-${caseId}`} className="text-sm font-bold text-slate-800">
        Vista previa del plan de calidad
      </h3>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="status">
        No disponible en el backend F045. Use el receipt seleccionado y la preparación de calidad publicada para continuar el flujo.
      </div>
    </section>
  )
}
