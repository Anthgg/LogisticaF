import { useState, type FormEvent } from 'react'
import { Button } from '../../../components/common/Button'
import { useMutation, useQuery } from '../../inbound-docks/hooks/useQuery'
import { EmptyPanel, ErrorPanel, SkeletonRows, StatusPill } from '../../inbound-docks/components/ui/Primitives'
import { qualityCertificateRequirementsApi } from '../api/qualityCertificateRequirementsApi'
import type {
  CreateQualityCertificateRequirementRequest,
  QualityCertificateRequirement,
  QualityCertificateValidationType,
} from '../types/quality-inspection-plans'

interface CertificateForm {
  code: string
  name: string
  description: string
  document_type_id: string
  accepted_types: string
  required: boolean
  issuer_pattern: string
  issue_date_required: boolean
  expiration_required: boolean
  minimum_validity_days: string
  reference_number_required: boolean
  file_required: boolean
  metadata_validation: QualityCertificateValidationType
  external_validation: QualityCertificateValidationType
  instructions: string
}

const EMPTY_FORM: CertificateForm = {
  code: '',
  name: '',
  description: '',
  document_type_id: '',
  accepted_types: '',
  required: true,
  issuer_pattern: '',
  issue_date_required: true,
  expiration_required: false,
  minimum_validity_days: '',
  reference_number_required: false,
  file_required: true,
  metadata_validation: 'METADATA_ONLY',
  external_validation: 'NONE',
  instructions: '',
}

function toForm(requirement: QualityCertificateRequirement): CertificateForm {
  return {
    code: requirement.code,
    name: requirement.name,
    description: requirement.description ?? '',
    document_type_id: requirement.document_type_id ?? '',
    accepted_types: requirement.accepted_types.join(', '),
    required: requirement.required,
    issuer_pattern: requirement.issuer_pattern ?? '',
    issue_date_required: requirement.issue_date_required,
    expiration_required: requirement.expiration_required,
    minimum_validity_days: requirement.minimum_validity_days?.toString() ?? '',
    reference_number_required: requirement.reference_number_required,
    file_required: requirement.file_required,
    metadata_validation: requirement.metadata_validation,
    external_validation: requirement.external_validation,
    instructions: requirement.instructions ?? '',
  }
}

function toRequest(form: CertificateForm): CreateQualityCertificateRequirementRequest {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    document_type_id: form.document_type_id.trim() || undefined,
    accepted_types: form.accepted_types.split(',').map((value) => value.trim()).filter(Boolean),
    required: form.required,
    issuer_pattern: form.issuer_pattern.trim() || undefined,
    issue_date_required: form.issue_date_required,
    expiration_required: form.expiration_required,
    minimum_validity_days: form.minimum_validity_days ? Number(form.minimum_validity_days) : undefined,
    reference_number_required: form.reference_number_required,
    file_required: form.file_required,
    metadata_validation: form.metadata_validation,
    external_validation: form.external_validation,
    instructions: form.instructions.trim() || undefined,
  }
}

export default function QualityCertificateRequirementsEditor({
  controlId,
  canManage = true,
  onRefresh,
}: {
  controlId?: string | null
  canManage?: boolean
  onRefresh?: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<QualityCertificateRequirement | null>(null)
  const [form, setForm] = useState<CertificateForm>(EMPTY_FORM)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const {
    data: requirements,
    isLoading,
    error,
    refetch,
  } = useQuery<QualityCertificateRequirement[]>(
    ['quality-control-certificates', controlId],
    controlId ? `/logistics/quality-inspection-plans/controls/${controlId}/certificates` : '',
    undefined,
    { enabled: Boolean(controlId) },
  )

  const finishMutation = () => {
    setShowForm(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    setMutationError(null)
    void refetch()
    onRefresh?.()
  }

  const createMutation = useMutation<CreateQualityCertificateRequirementRequest, QualityCertificateRequirement>(
    async (input) => qualityCertificateRequirementsApi.create(controlId as string, input),
    { onSuccess: finishMutation, onError: (cause) => setMutationError(cause.message) },
  )

  const updateMutation = useMutation<{ certificateId: string; data: CreateQualityCertificateRequirementRequest }, QualityCertificateRequirement>(
    async ({ certificateId, data }) => qualityCertificateRequirementsApi.update(certificateId, data),
    { onSuccess: finishMutation, onError: (cause) => setMutationError(cause.message) },
  )

  const deleteMutation = useMutation<{ certificateId: string }, void>(
    async ({ certificateId }) => qualityCertificateRequirementsApi.delete(certificateId),
    { onSuccess: finishMutation, onError: (cause) => setMutationError(cause.message) },
  )

  if (!controlId) {
    return (
      <EmptyPanel
        title="Seleccione un control"
        description="Los certificados se configuran por control. No se realizó ninguna consulta porque falta el identificador del control."
      />
    )
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setMutationError(null)
    setShowForm(true)
  }

  const openEdit = (requirement: QualityCertificateRequirement) => {
    setEditing(requirement)
    setForm(toForm(requirement))
    setMutationError(null)
    setShowForm(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = toRequest(form)
    if (!input.code || !input.name) {
      setMutationError('Código y nombre son obligatorios.')
      return
    }
    if (editing) {
      updateMutation.mutate({ certificateId: editing.requirement_id, data: input })
    } else {
      createMutation.mutate(input)
    }
  }

  if (isLoading) return <SkeletonRows rows={3} />
  if (error) return <ErrorPanel message={error} onRetry={() => void refetch()} />

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Requisitos de certificados</h3>
          <p className="text-xs text-slate-500">Configuración asociada al control seleccionado.</p>
        </div>
        {canManage && !showForm && <Button size="small" onClick={openCreate}>Nuevo requisito</Button>}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
          <h4 className="text-xs font-bold text-slate-800">{editing ? 'Editar requisito' : 'Nuevo requisito'}</h4>
          {mutationError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{mutationError}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600">Código
              <input value={form.code} onChange={(event) => setForm((previous) => ({ ...previous, code: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="text-xs text-slate-600">Nombre
              <input value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="text-xs text-slate-600">Tipo de documento
              <input value={form.document_type_id} onChange={(event) => setForm((previous) => ({ ...previous, document_type_id: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="text-xs text-slate-600">Tipos aceptados (separados por coma)
              <input value={form.accepted_types} onChange={(event) => setForm((previous) => ({ ...previous, accepted_types: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="text-xs text-slate-600 sm:col-span-2">Descripción
              <textarea value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="text-xs text-slate-600">Emisor esperado
              <input value={form.issuer_pattern} onChange={(event) => setForm((previous) => ({ ...previous, issuer_pattern: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="text-xs text-slate-600">Validez mínima (días)
              <input type="number" min={0} value={form.minimum_validity_days} onChange={(event) => setForm((previous) => ({ ...previous, minimum_validity_days: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
          </div>
          <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
            {([
              ['required', 'Requerido'],
              ['file_required', 'Archivo requerido'],
              ['issue_date_required', 'Fecha de emisión requerida'],
              ['expiration_required', 'Fecha de expiración requerida'],
              ['reference_number_required', 'Número de referencia requerido'],
            ] as const).map(([field, label]) => (
              <label key={field} className="flex items-center gap-2">
                <input type="checkbox" checked={form[field]} onChange={(event) => setForm((previous) => ({ ...previous, [field]: event.target.checked }))} />
                {label}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            {editing && <Button type="button" variant="danger" size="small" onClick={() => window.confirm('¿Eliminar este requisito?') && deleteMutation.mutate({ certificateId: editing.requirement_id })}>Eliminar</Button>}
            <Button type="button" variant="ghost" size="small" onClick={() => { setShowForm(false); setEditing(null); setMutationError(null) }}>Cancelar</Button>
            <Button type="submit" size="small" isLoading={createMutation.isPending || updateMutation.isPending}>{editing ? 'Guardar cambios' : 'Crear requisito'}</Button>
          </div>
        </form>
      )}

      {!showForm && (requirements?.length ? (
        <div className="space-y-2">
          {requirements.map((requirement) => (
            <div key={requirement.requirement_id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800">{requirement.code}</span>
                  <span className="text-xs text-slate-700">{requirement.name}</span>
                  {requirement.required && <StatusPill tone="warning">Requerido</StatusPill>}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{requirement.description || 'Sin descripción'}</p>
              </div>
              {canManage && <Button variant="ghost" size="small" onClick={() => openEdit(requirement)}>Editar</Button>}
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel title="Sin requisitos" description="El control no tiene requisitos de certificados configurados." />
      ))}
    </div>
  )
}
