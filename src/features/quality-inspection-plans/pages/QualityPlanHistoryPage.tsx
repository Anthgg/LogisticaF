import { useParams, useNavigate } from 'react-router-dom'

export function QualityPlanHistoryPage() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold text-slate-800">Historial del plan</h1>
        <button onClick={() => navigate(-1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
          Volver
        </button>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
        El historial no está disponible para el plan {planId ?? 'seleccionado'}: el backend publicado no expone esta ruta. Esta vista es de solo lectura y no realiza peticiones.
      </div>
    </div>
  )
}
