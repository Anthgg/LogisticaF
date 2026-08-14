import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { vehicleVerificationsApi } from '../api/vehicle-verifications-api'
import { Alert } from '../components/common/Alert'
import { Button } from '../components/common/Button'
import { LoadingSkeleton } from '../components/common/LoadingSkeleton'
import { PageHeader } from '../components/common/PageHeader'
import { VehicleVerificationFreshnessIndicator } from '../components/vehicle-verifications/VehicleVerificationFreshnessIndicator'
import { VehicleVerificationSourceBadge } from '../components/vehicle-verifications/VehicleVerificationSourceBadge'
import type { VehicleVerification } from '../types/vehicle-verifications'

export function VehicleVerificationsPage() {
  const navigate = useNavigate()
  const [vehicleId, setVehicleId] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [data, setData] = useState<VehicleVerification[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totals = useMemo(() => {
    if (!data) return null
    return {
      total: data.length,
      valid: data.filter((item) => item.result_status === 'VALIDATED').length,
      expired: data.filter((item) => item.result_status === 'EXPIRED').length,
    }
  }, [data])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = vehicleId.trim()
    if (!normalized) return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const result = await vehicleVerificationsApi.listByVehicle(normalized)
      setSelectedVehicleId(normalized)
      setData(result)
    } catch (cause) {
      setSelectedVehicleId(normalized)
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las verificaciones del vehículo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Verificaciones vehiculares"
        description="El contrato F045 permite consultar verificaciones dentro de un vehículo; no publica un listado global ni un detalle independiente por verificación."
      />

      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" onSubmit={(event) => void submit(event)}>
        <label className="text-xs font-semibold text-slate-700" htmlFor="vehicle-verifications-vehicle-id">ID del vehículo</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="vehicle-verifications-vehicle-id"
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
            placeholder="UUID del vehículo seleccionado"
            className="min-h-10 flex-1 rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm"
            required
          />
          <Button type="submit" disabled={!vehicleId.trim() || loading}>Consultar verificaciones</Button>
        </div>
      </form>

      {!selectedVehicleId && !loading && (
        <Alert variant="info">Selecciona un vehículo para consultar sus verificaciones. No se realiza ninguna request global.</Alert>
      )}
      {loading && <LoadingSkeleton rows={6} />}
      {error && <Alert variant="error">{error}</Alert>}

      {data && totals && (
        <>
          <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen derivado de verificaciones">
            <Summary label="Total real" value={totals.total} />
            <Summary label="Validadas" value={totals.valid} />
            <Summary label="Vencidas" value={totals.expired} />
          </section>

          {data.length === 0 ? (
            <Alert variant="info">El vehículo consultado no tiene verificaciones registradas.</Alert>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 text-left">Dominio</th><th className="px-4 py-3 text-left">Resultado</th><th className="px-4 py-3 text-left">Fuente</th><th className="px-4 py-3 text-left">Vigencia</th><th className="px-4 py-3 text-right">Acción</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{row.domain_label || row.domain}</td>
                      <td className="px-4 py-3">{row.result_status}</td>
                      <td className="px-4 py-3"><VehicleVerificationSourceBadge sourceType={row.source_type} sourceName={row.source_name} size="sm" /></td>
                      <td className="px-4 py-3"><VehicleVerificationFreshnessIndicator freshness={row.freshness} expirationDate={row.expires_at} size="sm" /></td>
                      <td className="px-4 py-3 text-right"><Button size="small" variant="ghost" onClick={() => navigate(`/logistics/vehicles/${selectedVehicleId}?tab=verifications`)}>Abrir ficha</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-semibold uppercase text-slate-400">{label}</p><p className="mt-1 font-mono text-xl font-bold text-slate-800">{value}</p></div>
}
