import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../../../components/common/Button'
import { useMutation, useQuery } from '../../inbound-docks/hooks/useQuery'
import { apiRequest, getCsrfToken } from '../../../api/api-client'
import { SkeletonRows } from '../../inbound-docks/components/ui/Primitives'
import { QualityPlanScopesEditor } from './QualityPlanScopesEditor'
import { QualityControlsEditor } from './QualityControlsEditor'
import { QualityPlanValidationPanel } from './QualityPlanValidationPanel'
import QualityCertificateRequirementsEditor from './QualityCertificateRequirementsEditor'
import { useLogisticsPermissions } from '../../logistics-permissions/hooks/useLogisticsPermissions'
import { LOGISTICS_PERMISSIONS } from '../../logistics-permissions/logistics-permissions-map'
import type {
  QualityInspectionPlanVersion,
  QualityInspectionPlanCapabilities,
  QualityPlanScope,
  QualityControlDefinition,
  QualityPlanValidation,
} from '../types/quality-inspection-plans'

const WIZARD_STEPS = [
  { key: 'info', label: 'Info general' },
  { key: 'validity', label: 'Vigencia y prioridad' },
  { key: 'scopes', label: 'Ambitos' },
  { key: 'controls', label: 'Controles' },
  { key: 'tolerances', label: 'Tolerancias' },
  { key: 'sampling', label: 'Muestreo' },
  { key: 'certificates', label: 'Certificados' },
  { key: 'conditions', label: 'Condiciones' },
  { key: 'future', label: 'Evidencias futuras' },
  { key: 'review', label: 'Revision' },
  { key: 'validation', label: 'Validacion' },
] as const


interface QualityPlanVersionWizardProps {
  planId: string
  versionId?: string
  onComplete: () => void
  onCancel: () => void
}

interface VersionFormData {
  valid_from: string
  valid_until: string
  priority: number
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function QualityPlanVersionWizard({
  planId: planIdProp,
  versionId: initialVersionId,
  onComplete,
  onCancel,
}: QualityPlanVersionWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [versionId, setVersionId] = useState<string | null>(initialVersionId ?? null)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [selectedControlId, setSelectedControlId] = useState('')
  const { hasPermission } = useLogisticsPermissions()



  const [formData, setFormData] = useState<VersionFormData>({
    valid_from: '',
    valid_until: '',
    priority: 0,
  })

  const currentStep = WIZARD_STEPS[currentStepIndex]

  const versionQueryKey = useMemo(() => ['quality-plan-version', versionId], [versionId])
  const { data: versionData, isLoading: versionLoading } = useQuery<QualityInspectionPlanVersion>(
    versionQueryKey,
    `/logistics/quality-inspection-plans/versions/${versionId}`,
    {},
    { enabled: Boolean(versionId) },
  )

  // Ámbitos y controles cuelgan del PLAN. Al crear una versión el plan llega
  // por props; al editar una existente lo aporta la propia versión.
  const planId = planIdProp ?? versionData?.plan_id ?? null

  const scopesQueryKey = useMemo(() => ['quality-plan-scopes', planId], [planId])
  const { data: scopesData, isLoading: scopesLoading, refetch: refetchScopes } = useQuery<QualityPlanScope[]>(
    scopesQueryKey,
    planId ? `/logistics/quality-inspection-plans/${planId}/scopes` : '',
    undefined,
    { enabled: Boolean(planId) && currentStep.key === 'scopes' },
  )

  const controlResourceSteps = ['controls', 'tolerances', 'sampling', 'certificates', 'conditions', 'future']
  const controlsQueryKey = useMemo(() => ['quality-plan-controls', planId], [planId])
  const { data: controlsData, isLoading: controlsLoading, refetch: refetchControls } = useQuery<QualityControlDefinition[]>(
    controlsQueryKey,
    planId ? `/logistics/quality-inspection-plans/${planId}/controls` : '',
    undefined,
    { enabled: Boolean(planId) && controlResourceSteps.includes(currentStep.key) },
  )

  // La validación del contrato es por plan, no por versión.
  const validationQueryKey = useMemo(() => ['quality-plan-validation', planId], [planId])
  const { data: validationData, isLoading: validationLoading, refetch: refetchValidation } = useQuery<QualityPlanValidation>(
    validationQueryKey,
    planId ? `/logistics/quality-inspection-plans/${planId}/validate` : '',
    {},
    { enabled: Boolean(planId) && currentStep.key === 'validation' },
  )

  const permissions = LOGISTICS_PERMISSIONS.qualityInspectionPlans
  const capabilities = useMemo<QualityInspectionPlanCapabilities>(() => ({
    plan_id: planId,
    can_view: hasPermission(permissions.read),
    can_create: hasPermission(permissions.create),
    can_update: hasPermission(permissions.update),
    can_clone: false,
    can_archive: hasPermission(permissions.archive),
    can_create_version: hasPermission(permissions.createVersion),
    can_manage_scopes: hasPermission(permissions.manageScopes),
    can_manage_controls: hasPermission(permissions.manageControls),
    can_manage_tolerances: hasPermission(permissions.manageTolerances),
    can_manage_sampling: hasPermission(permissions.manageSampling),
    can_manage_certificates: hasPermission(permissions.manageCertificates),
    can_validate: hasPermission(permissions.validate),
    can_detect_conflicts: hasPermission(permissions.detectConflicts),
    can_activate: hasPermission(permissions.activate),
    can_retire: hasPermission(permissions.retire),
    can_preview: hasPermission(permissions.preview),
    can_resolve: hasPermission(permissions.resolve),
    can_view_history: false,
    can_view_integrity: hasPermission(permissions.viewIntegrity),
    can_view_future_inspection_template: hasPermission(permissions.viewFutureTemplate),
  }), [hasPermission, permissions, planId])



  const createVersionMutation = useMutation<VersionFormData, QualityInspectionPlanVersion>(
    async (input) => {
      const csrf = await getCsrfToken()
      return apiRequest<QualityInspectionPlanVersion>({
        path: `/logistics/quality-inspection-plans/${planId}/versions`,
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
        body: {
          valid_from: input.valid_from || undefined,
          valid_until: input.valid_until || undefined,
          priority: input.priority,
        },
      })
    },
    {
      onSuccess: (result) => {
        setVersionId(result.version_id)
        setFormData({
          valid_from: result.valid_from ?? '',
          valid_until: result.valid_until ?? '',
          priority: result.priority,
        })
        setCompletedSteps((prev) => new Set([...prev, 0, 1]))
        setCurrentStepIndex(2)
        setError(null)
      },
      onError: (err) => setError(err.message),
    },
  )

  useEffect(() => {
    if (versionData) {
      setFormData({
        valid_from: versionData.valid_from ?? '',
        valid_until: versionData.valid_until ?? '',
        priority: versionData.priority,
      })
    }
  }, [versionData])

  useEffect(() => {
    if (!selectedControlId && controlsData?.[0]) {
      setSelectedControlId(controlsData[0].control_id)
    }
  }, [controlsData, selectedControlId])

  const handleNext = useCallback(() => {
    setError(null)
    if (currentStepIndex === 1 && !versionId) {
      createVersionMutation.mutate(formData)
      return
    }
    setCompletedSteps((prev) => new Set([...prev, currentStepIndex]))
    setCurrentStepIndex((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1))
  }, [currentStepIndex, versionId, formData, createVersionMutation])

  const handlePrevious = useCallback(() => {
    setError(null)
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const handleSubmit = useCallback(() => {
    onComplete()
  }, [onComplete])

  const handleScopesRefresh = useCallback(() => { refetchScopes() }, [refetchScopes])
  const handleControlsRefresh = useCallback(() => { refetchControls() }, [refetchControls])

  const isCreatingVersion = createVersionMutation.isPending
  const isSaving = isCreatingVersion
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1
  const canGoNext = !isSaving && !isLastStep
  const canGoPrevious = !isSaving && !isFirstStep
  const canSubmit = !isSaving && isLastStep

  const renderStepContent = () => {
    switch (currentStep.key) {
      case 'info':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Informacion general</h3>
              <p className="text-xs text-slate-500">
                Configure los datos基本icos de la version del plan de inspeccion.
              </p>
            </div>
            {versionData && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <dt className="text-[10px] font-semibold uppercase text-slate-500">Version</dt>
                  <dd className="text-slate-800">v{versionData.version_number}</dd>
                  <dt className="text-[10px] font-semibold uppercase text-slate-500">Estado</dt>
                  <dd className="text-slate-800">{versionData.status}</dd>
                  <dt className="text-[10px] font-semibold uppercase text-slate-500">Creado por</dt>
                  <dd className="text-slate-800">{versionData.created_by.display_name}</dd>
                  <dt className="text-[10px] font-semibold uppercase text-slate-500">Creado</dt>
                  <dd className="text-slate-800">{formatDate(versionData.created_at)}</dd>
                </dl>
              </div>
            )}
            {!versionId && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
                <p className="text-xs text-indigo-700">
                  Complete la vigencia y prioridad en el siguiente paso para crear la nueva version.
                </p>
              </div>
            )}
          </div>
        )

      case 'validity':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Vigencia y prioridad</h3>
              <p className="text-xs text-slate-500">
                Defina el rango de fechas y la prioridad de esta version.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Valido desde
                </label>
                <input
                  type="date"
                  value={formData.valid_from}
                  disabled={Boolean(versionId)}
                  onChange={(e) => setFormData((p) => ({ ...p, valid_from: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#1F4E6D] focus:outline-none focus:ring-1 focus:ring-[#1F4E6D]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Valido hasta
                </label>
                <input
                  type="date"
                  value={formData.valid_until}
                  disabled={Boolean(versionId)}
                  onChange={(e) => setFormData((p) => ({ ...p, valid_until: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#1F4E6D] focus:outline-none focus:ring-1 focus:ring-[#1F4E6D]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Prioridad
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.priority}
                  disabled={Boolean(versionId)}
                  onChange={(e) => setFormData((p) => ({ ...p, priority: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#1F4E6D] focus:outline-none focus:ring-1 focus:ring-[#1F4E6D]"
                />
              </div>
            </div>
            {versionData && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-2 text-xs font-bold text-slate-700">Resumen de la version</h4>
                <dl className="grid grid-cols-3 gap-2 text-[11px]">
                  <dt className="text-slate-500">Ambitos:</dt>
                  <dd className="text-slate-800">{versionData.scope_count}</dd>
                  <dt className="text-slate-500">Controles:</dt>
                  <dd className="text-slate-800">{versionData.control_count}</dd>
                  <dt className="text-slate-500">Tolerancias:</dt>
                  <dd className="text-slate-800">{versionData.tolerance_count}</dd>
                  <dt className="text-slate-500">Muestreo:</dt>
                  <dd className="text-slate-800">{versionData.sampling_count}</dd>
                  <dt className="text-slate-500">Certificados:</dt>
                  <dd className="text-slate-800">{versionData.certificate_count}</dd>
                  <dt className="text-slate-500">Conflictos:</dt>
                  <dd className="text-slate-800">{versionData.conflict_count}</dd>
                </dl>
              </div>
            )}
          </div>
        )

      case 'scopes':
        if (!versionId) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">Primero debe crear la version.</div>
        if (scopesLoading) return <SkeletonRows rows={4} />
        return (
          <QualityPlanScopesEditor
            planId={planId}
            scopes={scopesData ?? []}
            capabilities={capabilities}
            onRefresh={handleScopesRefresh}
          />
        )

      case 'controls':
        if (!versionId) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">Primero debe crear la version.</div>
        if (controlsLoading) return <SkeletonRows rows={4} />
        return (
          <QualityControlsEditor
            planId={planId}
            controls={controlsData ?? []}
            capabilities={capabilities}
            onRefresh={handleControlsRefresh}
          />
        )

      case 'tolerances':
        if (controlsLoading) return <SkeletonRows rows={4} />
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Tolerancias</h3>
              <p className="text-xs text-slate-500">
                Las tolerancias pertenecen a un control concreto; el backend no expone un catalogo global.
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              Gestion no disponible dentro del wizard. Use la pantalla de Tolerancias, seleccione un control real y opere sobre ese recurso.
            </div>
          </div>
        )

      case 'sampling':
        if (controlsLoading) return <SkeletonRows rows={4} />
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Planes de muestreo</h3>
              <p className="text-xs text-slate-500">
                Los planes de muestreo pertenecen a un control concreto; el backend no expone un catalogo global.
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              Gestion no disponible dentro del wizard. Use la pantalla de Muestreo, seleccione un control real y opere sobre ese recurso.
            </div>
          </div>
        )

      case 'certificates':
        if (controlsLoading) return <SkeletonRows rows={4} />
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Requisitos de certificados</h3>
              <p className="text-xs text-slate-500">
                Seleccione el control al que pertenecen los requisitos.
              </p>
            </div>
            <label className="block text-xs font-semibold text-slate-600">
              Control
              <select
                value={selectedControlId}
                onChange={(event) => setSelectedControlId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
              >
                <option value="">Seleccione un control</option>
                {(controlsData ?? []).map((control) => (
                  <option key={control.control_id} value={control.control_id}>{control.code} — {control.name}</option>
                ))}
              </select>
            </label>
            <QualityCertificateRequirementsEditor
              controlId={selectedControlId || null}
              canManage={capabilities.can_manage_certificates}
              onRefresh={handleControlsRefresh}
            />
          </div>
        )

      case 'conditions':
        if (controlsLoading) return <SkeletonRows rows={4} />
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Condiciones de controles</h3>
              <p className="text-xs text-slate-500">
                Revise las condiciones configuradas en los controles de esta version.
              </p>
            </div>
            {(controlsData ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="text-xs text-slate-500">No hay controles configurados.</p>
                <p className="mt-1 text-[10px] text-slate-400">Agregue controles en el paso "Controles".</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(controlsData ?? []).map((ctrl) => (
                  <div
                    key={ctrl.control_id}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800">{ctrl.code}</span>
                      <span className="text-xs text-slate-600">{ctrl.name}</span>
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {ctrl.control_type}
                      </span>
                    </div>
                    {ctrl.conditions.length === 0 ? (
                      <p className="text-[10px] text-slate-400">Sin condiciones configuradas.</p>
                    ) : (
                      <div className="space-y-1">
                        {ctrl.conditions.map((cond) => (
                          <div
                            key={cond.condition_id}
                            className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1 text-[10px] text-slate-600"
                          >
                            <span className="font-mono">{cond.condition_field}</span>
                            <span className="text-slate-400">{cond.operator}</span>
                            <span className="font-mono">{cond.value ?? '—'}</span>
                            <span className="text-slate-300">#{cond.display_order}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case 'future':
        if (controlsLoading) return <SkeletonRows rows={4} />
        const evidenceTypes = new Set<string>()
        const futureRoles = new Set<string>()
        for (const ctrl of controlsData ?? []) {
          for (const ev of ctrl.evidence_types) evidenceTypes.add(ev)
          for (const fr of ctrl.future_responsibilities) futureRoles.add(fr)
        }
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Evidencias futuras</h3>
              <p className="text-xs text-slate-500">
                Resumen de tipos de evidencia y responsabilidades futuras configuradas en los controles.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-2 text-xs font-bold text-slate-700">Tipos de evidencia</h4>
                {evidenceTypes.size === 0 ? (
                  <p className="text-[10px] text-slate-400">No hay tipos de evidencia configurados.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {[...evidenceTypes].map((ev) => (
                      <span
                        key={ev}
                        className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-2 text-xs font-bold text-slate-700">Roles futuros</h4>
                {futureRoles.size === 0 ? (
                  <p className="text-[10px] text-slate-400">No hay roles futuros configurados.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {[...futureRoles].map((role) => (
                      <span
                        key={role}
                        className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Los tipos de evidencia y roles futuros se definen al configurar cada control individual en el paso "Controles".
            </p>
          </div>
        )

      case 'review':
        if (versionLoading) return <SkeletonRows rows={4} />
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Revision de la version</h3>
              <p className="text-xs text-slate-500">
                Revise toda la configuracion antes de validar.
              </p>
            </div>
            {versionData && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-3 text-xs font-bold text-slate-700">Datos de la version</h4>
                <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  <dt className="text-[10px] font-semibold uppercase text-slate-500">Version</dt>
                  <dd className="text-slate-800">v{versionData.version_number}</dd>
                  <dt className="text-[10px] font-semibold uppercase text-slate-500">Estado</dt>
                  <dd className="text-slate-800">{versionData.status}</dd>
                  <dt className="text-[10px] font-semibold uppercase text-slate-500">Vigente desde</dt>
                  <dd className="text-slate-800">{formatDate(versionData.valid_from)}</dd>
                  <dt className="text-[10px] font-semibold uppercase text-slate-500">Vigente hasta</dt>
                  <dd className="text-slate-800">{formatDate(versionData.valid_until)}</dd>
                  <dt className="text-[10px] font-semibold uppercase text-slate-500">Prioridad</dt>
                  <dd className="text-slate-800">{versionData.priority}</dd>
                </dl>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-slate-800">{versionData ? versionData.scope_count : 'No disponible'}</p>
                <p className="text-[10px] font-semibold uppercase text-slate-500">Ambitos</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-slate-800">{versionData ? versionData.control_count : 'No disponible'}</p>
                <p className="text-[10px] font-semibold uppercase text-slate-500">Controles</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-slate-800">{versionData ? versionData.tolerance_count : 'No disponible'}</p>
                <p className="text-[10px] font-semibold uppercase text-slate-500">Tolerancias</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-slate-800">{versionData ? versionData.sampling_count : 'No disponible'}</p>
                <p className="text-[10px] font-semibold uppercase text-slate-500">Muestreo</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-slate-800">{versionData ? versionData.certificate_count : 'No disponible'}</p>
                <p className="text-[10px] font-semibold uppercase text-slate-500">Certificados</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-slate-800">{versionData ? versionData.conflict_count : 'No disponible'}</p>
                <p className="text-[10px] font-semibold uppercase text-slate-500">Conflictos</p>
              </div>
            </div>
          </div>
        )

      case 'validation':
        if (validationLoading) return <SkeletonRows rows={4} />
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Validacion</h3>
              <p className="text-xs text-slate-500">
                Valide el plan para verificar que cumple con todos los requisitos.
              </p>
            </div>
            <QualityPlanValidationPanel
              validation={validationData ?? null}
              onValidate={() => void refetchValidation()}
            />
            {validationData && validationData.status === 'VALID' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-bold text-emerald-700">
                  El plan cumple las reglas de validacion para esta version.
                </p>
                <p className="mt-1 text-[10px] text-emerald-600">
                  Puede proceder a activar la version desde el panel de versiones.
                </p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Wizard de version del plan</h1>
          <p className="text-xs text-slate-500">
            Configure paso a paso la version del plan de inspeccion de calidad.
          </p>
        </div>
        <Button variant="ghost" size="small" onClick={onCancel}>
          Cancelar
        </Button>
      </div>

      <nav aria-label="Progress">
        <ol className="flex items-center gap-1">
          {WIZARD_STEPS.map((step, index) => {
            const isCompleted = completedSteps.has(index)
            const isCurrent = index === currentStepIndex
            return (
              <li key={step.key} className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (index <= currentStepIndex || isCompleted) {
                      setCurrentStepIndex(index)
                    }
                  }}
                  disabled={index > currentStepIndex && !isCompleted}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                    isCurrent
                      ? 'bg-[#1F4E6D] text-white'
                      : isCompleted
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {isCompleted && !isCurrent ? (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-current/10 text-[9px]">
                      {index + 1}
                    </span>
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {index < WIZARD_STEPS.length - 1 && (
                  <div className={`mx-0.5 h-px w-2 ${isCompleted ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="min-h-[400px] rounded-xl border border-slate-200 bg-white p-6">
        {renderStepContent()}
      </div>

      <div className="flex items-center justify-between">
        <div>
          {isFirstStep ? (
            <Button variant="ghost" size="small" onClick={onCancel}>
              Cancelar
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="small"
              onClick={handlePrevious}
              disabled={!canGoPrevious}
            >
              Anterior
            </Button>
          )}
        </div>
        <div className="text-[10px] text-slate-400">
          Paso {currentStepIndex + 1} de {WIZARD_STEPS.length}
        </div>
        <div>
          {isLastStep ? (
            <Button
              variant="primary"
              size="small"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              Finalizar
            </Button>
          ) : (
            <Button
              variant="primary"
              size="small"
              onClick={handleNext}
              disabled={!canGoNext}
              isLoading={isSaving}
            >
              {currentStepIndex === 1 && !versionId ? 'Crear version' : 'Siguiente'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
