const QUALITY_LABELS: Record<string, string> = {
  VERIFIED: 'Verificado',
  RECONCILED: 'Reconciliado',
  CURRENT: 'Actual',
  LAGGING: 'Atrasado',
  PARTIAL_BASELINE: 'Baseline parcial',
  MISSING_BASELINE: 'Baseline faltante',
  INTEGRITY_FAILED: 'Integridad fallida',
  UNIT_CONFLICT: 'Conflicto de unidad',
  POSITION_CONFLICT: 'Conflicto de posición',
  NEGATIVE: 'Negativo',
  REBUILD_REQUIRED: 'Rebuild requerido',
  UNKNOWN: 'Desconocido',
}

const QUALITY_STYLES: Record<string, { chip: string; dot: string }> = {
  VERIFIED: { chip: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  RECONCILED: { chip: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  CURRENT: { chip: 'border-blue-200 bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  LAGGING: { chip: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  PARTIAL_BASELINE: { chip: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  MISSING_BASELINE: { chip: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  INTEGRITY_FAILED: { chip: 'border-rose-200 bg-rose-100 text-rose-800', dot: 'bg-rose-600' },
  UNIT_CONFLICT: { chip: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  POSITION_CONFLICT: { chip: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  NEGATIVE: { chip: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  REBUILD_REQUIRED: { chip: 'border-violet-200 bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
}

const FALLBACK = { chip: 'border-slate-200 bg-slate-50 text-slate-600', dot: 'bg-slate-400' }

/**
 * `data_quality_status` y `reconciliation_status` llegan como string libre del
 * backend, así que se admite cualquier valor y se degrada con elegancia.
 */
export function DataQualityBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const style = QUALITY_STYLES[status] ?? FALLBACK
  const label = QUALITY_LABELS[status] ?? status.replaceAll('_', ' ').toLowerCase()

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${style.chip} ${className ?? ''}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
      {label}
    </span>
  )
}
