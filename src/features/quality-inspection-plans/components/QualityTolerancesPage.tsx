import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { LOGISTICS_PERMISSIONS } from '../../logistics-permissions/logistics-permissions-map'
import { useLogisticsPermissions } from '../../logistics-permissions/hooks/useLogisticsPermissions'
import { useMutation, useQuery } from '../../inbound-docks/hooks/useQuery'
import type {
  QualityToleranceContract,
  QualityToleranceContractRequest,
} from '../api/qualityTolerancesApi'
import { qualityTolerancesApi } from '../api/qualityTolerancesApi'

interface UnitOption {
  id: string
  code: string
  name: string
  symbol: string
}

interface ToleranceForm {
  tolerance_type: string
  min_value: string
  max_value: string
  target_value: string
  absolute_deviation: string
  percentage_deviation: string
  unit_code: string
  description: string
}

const emptyForm: ToleranceForm = {
  tolerance_type: 'RANGE',
  min_value: '',
  max_value: '',
  target_value: '',
  absolute_deviation: '',
  percentage_deviation: '',
  unit_code: '',
  description: '',
}

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function toPayload(form: ToleranceForm): QualityToleranceContractRequest {
  return {
    tolerance_type: form.tolerance_type,
    min_value: optionalText(form.min_value),
    max_value: optionalText(form.max_value),
    target_value: optionalText(form.target_value),
    absolute_deviation: optionalText(form.absolute_deviation),
    percentage_deviation: optionalText(form.percentage_deviation),
    valid_options: null,
    default_value: null,
    unit_code: optionalText(form.unit_code),
    description: optionalText(form.description),
  }
}

export function QualityTolerancesPage() {
  const { hasPermission } = useLogisticsPermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const controlId = searchParams.get('control_id')?.trim() ?? ''
  const [controlDraft, setControlDraft] = useState(controlId)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<QualityToleranceContract | null>(null)
  const [form, setForm] = useState<ToleranceForm>(emptyForm)

  const list = useQuery<QualityToleranceContract[]>(
    ['quality-control-tolerances', controlId],
    controlId ? `/logistics/quality-inspection-plans/controls/${controlId}/tolerances` : '',
    undefined,
    { enabled: Boolean(controlId) },
  )
  const units = useQuery<UnitOption[]>(
    ['quality-tolerance-units'],
    showForm ? '/logistics/units' : '',
    undefined,
    { enabled: showForm },
  )

  const create = useMutation<QualityToleranceContractRequest, QualityToleranceContract>(
    (input) => qualityTolerancesApi.create(controlId, input),
    { onSuccess: () => { setShowForm(false); setForm(emptyForm); void list.refetch() } },
  )
  const update = useMutation<QualityToleranceContractRequest, QualityToleranceContract>(
    (input) => qualityTolerancesApi.update(editing?.id ?? '', input),
    { onSuccess: () => { setShowForm(false); setEditing(null); setForm(emptyForm); void list.refetch() } },
  )
  const remove = useMutation<string, void>(
    (toleranceId) => qualityTolerancesApi.delete(toleranceId),
    { onSuccess: () => { setShowForm(false); setEditing(null); void list.refetch() } },
  )

  const canRead = hasPermission(LOGISTICS_PERMISSIONS.qualityTolerances.read)
  const canCreate = hasPermission(LOGISTICS_PERMISSIONS.qualityTolerances.create)
  const error = list.error ?? create.error ?? update.error ?? remove.error

  if (!canRead) {
    return <div className="p-4 text-center text-gray-500">No tiene permisos para acceder a esta sección.</div>
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (tolerance: QualityToleranceContract) => {
    setEditing(tolerance)
    setForm({
      tolerance_type: tolerance.tolerance_type,
      min_value: tolerance.min_value ?? '',
      max_value: tolerance.max_value ?? '',
      target_value: tolerance.target_value ?? '',
      absolute_deviation: tolerance.absolute_deviation ?? '',
      percentage_deviation: tolerance.percentage_deviation ?? '',
      unit_code: tolerance.unit_code ?? '',
      description: tolerance.description ?? '',
    })
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tolerancias por control de calidad</h1>
        <p className="mt-1 text-sm text-gray-600">
          Las tolerancias se consultan y mantienen dentro del control seleccionado.
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
          {controlId && canCreate && <Button onClick={openCreate}>Nueva tolerancia</Button>}
        </div>
      </div>

      {!controlId ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Seleccione un control. Sin <code>control_id</code> no se realiza ninguna petición.
        </div>
      ) : list.isLoading ? (
        <div className="py-8 text-center text-gray-500">Cargando tolerancias del control…</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {error && <div role="alert" className="border-b border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Tipo</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Mínimo</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Objetivo</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Máximo</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Unidad</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Descripción</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.data?.map((tolerance) => (
                <tr key={tolerance.id}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{tolerance.tolerance_type}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{tolerance.min_value ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{tolerance.target_value ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{tolerance.max_value ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{tolerance.unit_code ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{tolerance.description ?? '—'}</td>
                  <td className="px-4 py-3"><Button size="small" variant="secondary" onClick={() => openEdit(tolerance)}>Editar</Button></td>
                </tr>
              ))}
              {list.data?.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">Este control no tiene tolerancias.</td></tr>
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
            <h2 className="text-lg font-semibold">{editing ? 'Editar tolerancia' : 'Nueva tolerancia'}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Tipo" value={form.tolerance_type} onChange={(event) => setForm({ ...form, tolerance_type: event.target.value })} />
              <Input label="Valor mínimo" type="number" value={form.min_value} onChange={(event) => setForm({ ...form, min_value: event.target.value })} />
              <Input label="Valor objetivo" type="number" value={form.target_value} onChange={(event) => setForm({ ...form, target_value: event.target.value })} />
              <Input label="Valor máximo" type="number" value={form.max_value} onChange={(event) => setForm({ ...form, max_value: event.target.value })} />
              <Input label="Desviación absoluta" type="number" value={form.absolute_deviation} onChange={(event) => setForm({ ...form, absolute_deviation: event.target.value })} />
              <Input label="Desviación porcentual" type="number" value={form.percentage_deviation} onChange={(event) => setForm({ ...form, percentage_deviation: event.target.value })} />
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Unidad
                <select className="rounded-md border border-slate-300 px-3 py-2" value={form.unit_code} onChange={(event) => setForm({ ...form, unit_code: event.target.value })}>
                  <option value="">Sin unidad</option>
                  {units.data?.map((unit) => <option key={unit.id} value={unit.code}>{unit.name} ({unit.symbol})</option>)}
                </select>
              </label>
              <Input label="Descripción" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </div>
            {units.error && <div role="alert" className="text-sm text-red-700">No se pudo cargar el catálogo de unidades: {units.error}</div>}
            {(create.error || update.error || remove.error) && <div role="alert" className="text-sm text-red-700">{create.error ?? update.error ?? remove.error}</div>}
            <div className="flex justify-end gap-3">
              {editing && <Button type="button" variant="danger" onClick={() => { if (window.confirm('¿Eliminar esta tolerancia?')) void remove.mutate(editing.id) }}>Eliminar</Button>}
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit">{editing ? 'Guardar' : 'Crear'}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default QualityTolerancesPage
