import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { LOGISTICS_PERMISSIONS } from '../../logistics-permissions/logistics-permissions-map'
import { useLogisticsPermissions } from '../../logistics-permissions/hooks/useLogisticsPermissions'
import { useMutation, useQuery } from '../../inbound-docks/hooks/useQuery'
import type {
  QualitySamplingContract,
  QualitySamplingContractRequest,
} from '../api/qualitySamplingPlansApi'
import { qualitySamplingPlansApi } from '../api/qualitySamplingPlansApi'

interface SamplingForm {
  sampling_type: string
  fixed_count: string
  percentage: string
  minimum_count: string
  package_level: string
  lot_level: string
  custom_formula: string
  description: string
}

const emptyForm: SamplingForm = {
  sampling_type: 'FIXED',
  fixed_count: '',
  percentage: '',
  minimum_count: '',
  package_level: '',
  lot_level: '',
  custom_formula: '',
  description: '',
}

function optionalInteger(value: string): number | null {
  return value.trim() === '' ? null : Number.parseInt(value, 10)
}

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function toPayload(form: SamplingForm): QualitySamplingContractRequest {
  return {
    sampling_type: form.sampling_type,
    fixed_count: optionalInteger(form.fixed_count),
    percentage: optionalText(form.percentage),
    minimum_count: optionalInteger(form.minimum_count),
    package_level: optionalText(form.package_level),
    lot_level: optionalText(form.lot_level),
    custom_formula: optionalText(form.custom_formula),
    description: optionalText(form.description),
  }
}

export function QualitySamplingPlansPage() {
  const { hasPermission } = useLogisticsPermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const controlId = searchParams.get('control_id')?.trim() ?? ''
  const [controlDraft, setControlDraft] = useState(controlId)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<QualitySamplingContract | null>(null)
  const [form, setForm] = useState<SamplingForm>(emptyForm)

  const list = useQuery<QualitySamplingContract[]>(
    ['quality-control-samplings', controlId],
    controlId ? `/logistics/quality-inspection-plans/controls/${controlId}/samplings` : '',
    undefined,
    { enabled: Boolean(controlId) },
  )

  const create = useMutation<QualitySamplingContractRequest, QualitySamplingContract>(
    (input) => qualitySamplingPlansApi.create(controlId, input),
    { onSuccess: () => { setShowForm(false); setForm(emptyForm); void list.refetch() } },
  )
  const update = useMutation<QualitySamplingContractRequest, QualitySamplingContract>(
    (input) => qualitySamplingPlansApi.update(editing?.id ?? '', input),
    { onSuccess: () => { setShowForm(false); setEditing(null); setForm(emptyForm); void list.refetch() } },
  )
  const remove = useMutation<string, void>(
    (samplingId) => qualitySamplingPlansApi.delete(samplingId),
    { onSuccess: () => { setShowForm(false); setEditing(null); void list.refetch() } },
  )

  const canRead = hasPermission(LOGISTICS_PERMISSIONS.qualitySamplingPlans.read)
  const canCreate = hasPermission(LOGISTICS_PERMISSIONS.qualitySamplingPlans.create)
  const error = list.error ?? create.error ?? update.error ?? remove.error

  if (!canRead) {
    return <div className="p-4 text-center text-gray-500">No tiene permisos para acceder a esta sección.</div>
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (sampling: QualitySamplingContract) => {
    setEditing(sampling)
    setForm({
      sampling_type: sampling.sampling_type,
      fixed_count: sampling.fixed_count?.toString() ?? '',
      percentage: sampling.percentage ?? '',
      minimum_count: sampling.minimum_count?.toString() ?? '',
      package_level: sampling.package_level ?? '',
      lot_level: sampling.lot_level ?? '',
      custom_formula: sampling.custom_formula ?? '',
      description: sampling.description ?? '',
    })
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Muestreo por control de calidad</h1>
        <p className="mt-1 text-sm text-gray-600">
          El backend F045 ancla cada regla de muestreo a un control concreto.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="ID del control"
            value={controlDraft}
            onChange={(event) => setControlDraft(event.target.value)}
            placeholder="UUID del control seleccionado"
          />
          <Button
            variant="secondary"
            onClick={() => setSearchParams(controlDraft.trim() ? { control_id: controlDraft.trim() } : {})}
          >
            Cargar control
          </Button>
          {controlId && canCreate && <Button onClick={openCreate}>Nueva regla</Button>}
        </div>
      </div>

      {!controlId ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Seleccione un control. Sin <code>control_id</code> no se realiza ninguna petición.
        </div>
      ) : list.isLoading ? (
        <div className="py-8 text-center text-gray-500">Cargando muestreo del control…</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {error && <div role="alert" className="border-b border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Tipo</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Cantidad fija</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Porcentaje</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Mínimo</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Descripción</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.data?.map((sampling) => (
                <tr key={sampling.id}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{sampling.sampling_type}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{sampling.fixed_count ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{sampling.percentage ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{sampling.minimum_count ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{sampling.description ?? '—'}</td>
                  <td className="px-4 py-3"><Button size="small" variant="secondary" onClick={() => openEdit(sampling)}>Editar</Button></td>
                </tr>
              ))}
              {list.data?.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Este control no tiene reglas de muestreo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && controlId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            className="w-full max-w-2xl space-y-4 rounded-lg bg-white p-6 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault()
              const payload = toPayload(form)
              void (editing ? update.mutate(payload) : create.mutate(payload))
            }}
          >
            <h2 className="text-lg font-semibold">{editing ? 'Editar muestreo' : 'Nuevo muestreo'}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Tipo de muestreo" value={form.sampling_type} onChange={(event) => setForm({ ...form, sampling_type: event.target.value })} />
              <Input label="Cantidad fija" type="number" value={form.fixed_count} onChange={(event) => setForm({ ...form, fixed_count: event.target.value })} />
              <Input label="Porcentaje" type="number" value={form.percentage} onChange={(event) => setForm({ ...form, percentage: event.target.value })} />
              <Input label="Cantidad mínima" type="number" value={form.minimum_count} onChange={(event) => setForm({ ...form, minimum_count: event.target.value })} />
              <Input label="Nivel de empaque" value={form.package_level} onChange={(event) => setForm({ ...form, package_level: event.target.value })} />
              <Input label="Nivel de lote" value={form.lot_level} onChange={(event) => setForm({ ...form, lot_level: event.target.value })} />
              <Input label="Fórmula personalizada" value={form.custom_formula} onChange={(event) => setForm({ ...form, custom_formula: event.target.value })} />
              <Input label="Descripción" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </div>
            {(create.error || update.error || remove.error) && <div role="alert" className="text-sm text-red-700">{create.error ?? update.error ?? remove.error}</div>}
            <div className="flex justify-end gap-3">
              {editing && <Button type="button" variant="danger" onClick={() => { if (window.confirm('¿Eliminar esta regla de muestreo?')) void remove.mutate(editing.id) }}>Eliminar</Button>}
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit">{editing ? 'Guardar' : 'Crear'}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default QualitySamplingPlansPage
