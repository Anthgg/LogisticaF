import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '../../inbound-docks/hooks/useQuery'
import { QualityPlanScopesEditor } from '../components/QualityPlanScopesEditor'
import { QualityControlsEditor } from '../components/QualityControlsEditor'
import { QualityPlanValidationPanel } from '../components/QualityPlanValidationPanel'
import { QualityPlanIntegrityPanel } from '../components/QualityPlanIntegrityPanel'
import { useLogisticsPermissions } from '../../logistics-permissions/hooks/useLogisticsPermissions'
import { LOGISTICS_PERMISSIONS } from '../../logistics-permissions/logistics-permissions-map'
import type { QualityInspectionPlanVersion, QualityControlDefinition, QualityPlanScope, QualityInspectionPlanCapabilities, QualityPlanValidation, QualityPlanIntegrity } from '../types/quality-inspection-plans'

const PLANS_BASE = '/logistics/quality-inspection-plans'

const TABS = ['Resumen', 'Controles', 'Scopes', 'Validación', 'Conflictos', 'Integridad', 'Historial'] as const

export function QualityPlanVersionDetailPage() {
  const { versionId } = useParams<{ versionId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<string>('Resumen')
  const { hasPermission } = useLogisticsPermissions()

  const { data: version, isLoading } = useQuery<QualityInspectionPlanVersion>(
    ['quality-plan-version', versionId],
    `${PLANS_BASE}/versions/${versionId}`,
    undefined,
    { enabled: !!versionId },
  )

  // Controles y ámbitos son subrecursos del PLAN, no de la versión. El plan
  // se obtiene de la propia versión ya cargada.
  const planId = version?.plan_id ?? null

  const { data: controls, refetch: refetchControls } = useQuery<QualityControlDefinition[]>(
    ['quality-controls', planId],
    planId ? `${PLANS_BASE}/${planId}/controls` : '',
    undefined,
    { enabled: Boolean(planId) && activeTab === 'Controles' },
  )

  const { data: scopes, refetch: refetchScopes } = useQuery<QualityPlanScope[]>(
    ['quality-scopes', planId],
    planId ? `${PLANS_BASE}/${planId}/scopes` : '',
    undefined,
    { enabled: Boolean(planId) && activeTab === 'Scopes' },
  )

  const { data: validation, refetch: refetchValidation } = useQuery<QualityPlanValidation>(
    ['quality-plan-validation', planId],
    planId ? `${PLANS_BASE}/${planId}/validate` : '',
    undefined,
    { enabled: Boolean(planId) && activeTab === 'Validación' },
  )

  const { data: integrity } = useQuery<QualityPlanIntegrity>(
    ['quality-plan-integrity', planId],
    planId ? `${PLANS_BASE}/${planId}/integrity` : '',
    undefined,
    { enabled: Boolean(planId) && activeTab === 'Integridad' },
  )

  const permissions = LOGISTICS_PERMISSIONS.qualityInspectionPlans
  const capabilities: QualityInspectionPlanCapabilities = {
    plan_id: planId ?? '',
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
  }

  if (isLoading) return <div className="p-6 text-sm text-slate-500">Cargando versión...</div>
  if (!version) return <div className="p-6 text-sm text-red-500">Versión no encontrada</div>

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-slate-800">
            Versión {version.version_number} — {version.status}
          </h1>
          <p className="text-xs text-slate-500">
            Vigencia: {version.valid_from ?? '—'} a {version.valid_until ?? '—'} | Prioridad: {version.priority}
          </p>
        </div>
        <button onClick={() => navigate(-1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
          Volver
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-2 text-xs font-semibold transition-colors ${activeTab === tab ? 'border-b-2 border-[#1F4E6D] text-[#1F4E6D]' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Controles' && (
        <QualityControlsEditor planId={version.plan_id} controls={controls || []} capabilities={capabilities} onRefresh={() => void refetchControls()} />
      )}
      {activeTab === 'Scopes' && (
        <QualityPlanScopesEditor planId={version.plan_id} scopes={scopes || []} capabilities={capabilities} onRefresh={() => void refetchScopes()} />
      )}
      {activeTab === 'Validación' && (
        <QualityPlanValidationPanel validation={validation ?? null} onValidate={() => void refetchValidation()} />
      )}
      {activeTab === 'Conflictos' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">La detección de conflictos requiere contexto de producto/categoría. No se muestra un cero falso ni se realiza una consulta sin ese contexto.</div>
      )}
      {activeTab === 'Integridad' && (
        <QualityPlanIntegrityPanel integrity={integrity ?? null} />
      )}
      {activeTab === 'Historial' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">Historial no disponible en el backend publicado. Vista de solo lectura, sin petición.</div>
      )}
      {activeTab === 'Resumen' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">Versión {version.version_number} · {version.status}. Los recursos se consultan desde las pestañas correspondientes.</div>
      )}
    </div>
  )
}
