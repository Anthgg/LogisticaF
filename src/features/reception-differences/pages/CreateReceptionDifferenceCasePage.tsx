import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '../../inbound-docks/hooks/useQuery'
import { receptionDifferenceCasesApi } from '../api/receptionDifferenceCasesApi'
import { useLogisticsPermissions } from '../../logistics-permissions/hooks/useLogisticsPermissions'
import { LOGISTICS_PERMISSIONS } from '../../logistics-permissions/logistics-permissions-map'

export function CreateReceptionDifferenceCasePage() {
  const navigate = useNavigate()
  const auth = useLogisticsPermissions()
  const canCreate = auth.hasPermission(LOGISTICS_PERMISSIONS.receptionDifferences.create)
  const [selectedReceiptId, setSelectedReceiptId] = useState('')

  const summaryQuery = useQuery<Record<string, unknown>>(
    ['reception-difference-cases', 'summary'],
    '/logistics/reception-difference-cases/summary',
    undefined,
    { enabled: canCreate },
  )

  const createMutation = useMutation(
    async (receiptId: string) => {
      return receptionDifferenceCasesApi.createFromReceipt({ receipt_id: receiptId })
    },
    {
      onSuccess: (result) => {
        if (result && 'case_id' in result) {
          navigate(`/logistics/inbound/reception-differences/${(result as { case_id: string }).case_id}`)
        }
      },
    },
  )

  if (!canCreate) {
    return (
      <div className="page">
        <div className="panel p-6 text-center text-sm text-slate-500">
          No tienes permisos para crear casos de diferencia.
        </div>
      </div>
    )
  }

  const summaryEntries = summaryQuery.data
    ? Object.entries(summaryQuery.data).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    : []
  const normalizedReceiptId = selectedReceiptId.trim()

  return (
    <div className="page">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-800">Crear Caso de Diferencia</h1>
        <p className="text-xs text-slate-500">
          Selecciona una recepción real por su identificador. El caso se crea con la operación contractual desde recepción.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <form
          className="panel space-y-4 p-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (normalizedReceiptId) createMutation.mutate(normalizedReceiptId)
          }}
        >
          <label className="block text-xs font-semibold text-slate-700" htmlFor="reception-difference-receipt-id">
            ID de recepción
          </label>
          <input
            id="reception-difference-receipt-id"
            value={selectedReceiptId}
            onChange={(event) => setSelectedReceiptId(event.target.value)}
            placeholder="UUID de la recepción seleccionada"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-mono text-sm"
            required
          />
          <button
            type="submit"
            disabled={!normalizedReceiptId || createMutation.isPending}
            className="rounded-lg bg-[#1F4E6D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#173a55] disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creando…' : 'Crear caso'}
          </button>
        </form>

        <section className="panel p-5" aria-label="Resumen de diferencias">
          <h2 className="text-sm font-bold text-slate-800">Resumen real</h2>
          {summaryQuery.isLoading && <p className="mt-3 text-xs text-slate-500">Cargando resumen…</p>}
          {summaryQuery.isError && <p className="mt-3 text-xs text-rose-600">No se pudo cargar el resumen del backend.</p>}
          {!summaryQuery.isLoading && !summaryQuery.isError && summaryEntries.length === 0 && (
            <p className="mt-3 text-xs text-slate-500">El backend respondió sin indicadores escalares para mostrar.</p>
          )}
          {summaryEntries.length > 0 && (
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {summaryEntries.map(([key, value]) => (
                <div key={key} className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-[10px] font-semibold uppercase text-slate-400">{key.replaceAll('_', ' ')}</dt>
                  <dd className="mt-1 break-words text-sm font-bold text-slate-800">{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      {createMutation.error && (
        <p className="mt-2 text-xs text-rose-600" role="alert">{createMutation.error}</p>
      )}
    </div>
  )
}
