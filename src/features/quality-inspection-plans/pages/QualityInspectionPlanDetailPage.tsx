import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../../components/common/PageHeader'
import { Button } from '../../../components/common/Button'
import { Alert } from '../../../components/common/Alert'
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton'
import { EmptyState } from '../../../components/common/EmptyState'

import { useQuery, useMutation } from '../../inbound-docks/hooks/useQuery'
import { qualityInspectionPlansApi } from '../api/qualityInspectionPlansApi'
import QualityCertificateRequirementsEditor from '../components/QualityCertificateRequirementsEditor'
import { useLogisticsPermissions } from '../../logistics-permissions/hooks/useLogisticsPermissions'
import { LOGISTICS_PERMISSIONS } from '../../logistics-permissions/logistics-permissions-map'
import { getErrorMessage } from '../../../utils/errors'
import type {
  QualityInspectionPlan,
  QualityInspectionPlanVersion,
  QualityPlanScope,
  QualityControlDefinition,
  QualityInspectionPlanStatus,
} from '../types/quality-inspection-plans'

type DetailTab =
  | 'summary'
  | 'versions'
  | 'scopes'
  | 'controls'
  | 'tolerances'
  | 'sampling'
  | 'certificates'
  | 'resolutions'
  | 'integrity'
  | 'history'

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'summary', label: 'Resumen' },
  { key: 'versions', label: 'Versiones' },
  { key: 'scopes', label: 'Ámbitos' },
  { key: 'controls', label: 'Controles' },
  { key: 'tolerances', label: 'Tolerancias' },
  { key: 'sampling', label: 'Muestreo' },
  { key: 'certificates', label: 'Certificados' },
  { key: 'resolutions', label: 'Resoluciones' },
  { key: 'integrity', label: 'Integridad' },
  { key: 'history', label: 'Historial' },
]

const STATUS_LABELS: Record<QualityInspectionPlanStatus, string> = {
  DRAFT: 'Borrador',
  VALIDATED: 'Validado',
  SCHEDULED: 'Programado',
  ACTIVE: 'Activo',
  RETIRED: 'Retirado',
  ARCHIVED: 'Archivado',
}

const STATUS_TONE: Record<QualityInspectionPlanStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  VALIDATED: 'bg-blue-50 text-blue-700',
  SCHEDULED: 'bg-amber-50 text-amber-700',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  RETIRED: 'bg-slate-100 text-slate-500',
  ARCHIVED: 'bg-slate-50 text-slate-400',
}

export function QualityInspectionPlanDetailPage() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<DetailTab>('summary')
  const { hasPermission } = useLogisticsPermissions()
  const permissions = LOGISTICS_PERMISSIONS.qualityInspectionPlans

  const plan = useQuery<QualityInspectionPlan>(
    ['quality-inspection-plans', 'detail', planId ?? ''],
    `/logistics/quality-inspection-plans/${planId}`,
    undefined,
    { enabled: Boolean(planId) },
  )

  const archiveMutation = useMutation(
    () => qualityInspectionPlansApi.archive(planId!),
    { onSuccess: () => void plan.refetch() },
  )

  useEffect(() => {
    setActiveTab('summary')
  }, [planId])

  const canEdit = hasPermission(permissions.update)
  const canArchive = hasPermission(permissions.archive)
  const canValidate = hasPermission(permissions.validate)
  const canCreateVersion = hasPermission(permissions.createVersion)
  const canActivate = hasPermission(permissions.activate)
  const canDetectConflicts = hasPermission(permissions.detectConflicts)
  const canManageScopes = hasPermission(permissions.manageScopes)
  const canManageControls = hasPermission(permissions.manageControls)
  const canManageTolerances = hasPermission(permissions.manageTolerances)
  const canManageSampling = hasPermission(permissions.manageSampling)
  const canManageCertificates = hasPermission(permissions.manageCertificates)

  if (plan.isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Detalle de plan" />
        <LoadingSkeleton rows={6} />
      </div>
    )
  }

  if (plan.isError || !plan.data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Detalle de plan" />
        <Alert variant="error">{plan.error ? getErrorMessage(plan.error) : 'Plan no encontrado.'}</Alert>
        <Button size="small" variant="secondary" onClick={() => navigate('/logistics/quality/plans')}>
          ← Volver
        </Button>
      </div>
    )
  }

  const p = plan.data
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Fase 041"
        title={`${p.code} — ${p.name}`}
        description={p.description ?? 'Sin descripción'}
        actions={
          <div className="flex gap-2">
            <Button size="small" variant="ghost" onClick={() => navigate('/logistics/quality/plans')}>
              ← Volver
            </Button>
            {canEdit && <span className="self-center text-[10px] text-slate-500">Edición disponible en la configuración de versión</span>}
            {canArchive && p.status !== 'ARCHIVED' && (
              <Button
                size="small"
                variant="danger"
                isLoading={archiveMutation.isPending}
                onClick={() => void archiveMutation.mutate(undefined as never)}
              >
                Archivar
              </Button>
            )}
          </div>
        }
      />

      {/* Header info */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          ['Familia', p.family],
          ['Estado', STATUS_LABELS[p.status]],
          ['V. activa', p.active_version_number != null ? `v${String(p.active_version_number)}` : '—'],
          ['Vigencia', p.active_version_valid_from && p.active_version_valid_until
            ? `${new Date(p.active_version_valid_from).toLocaleDateString('es-PE')} — ${new Date(p.active_version_valid_until).toLocaleDateString('es-PE')}`
            : '—'],
          ['Prioridad', String(p.priority)],
          ['Conflictos', String(p.conflict_count)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#EEF2F5] bg-white p-3">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
            <dd className="mt-1 truncate text-xs font-bold text-slate-800">{value}</dd>
          </div>
        ))}
      </div>

      {/* Status + capability badges */}
      <div className="flex flex-wrap gap-2">
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[p.status]}`}>
          {STATUS_LABELS[p.status]}
        </span>
        {canValidate && (
          <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">Puede validar</span>
        )}
        {canCreateVersion && (
          <span className="inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">Puede crear versión</span>
        )}
        {canActivate && (
          <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">Puede activar</span>
        )}
        {canDetectConflicts && (
          <span className="inline-block rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-700">Detectar conflictos</span>
        )}
        {canManageScopes && (
          <span className="inline-block rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-700">Gestionar ámbitos</span>
        )}
        {canManageControls && (
          <span className="inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">Gestionar controles</span>
        )}
        {canManageTolerances && (
          <span className="inline-block rounded-full bg-teal-50 px-2.5 py-0.5 text-[10px] font-bold text-teal-700">Gestionar tolerancias</span>
        )}
        {canManageSampling && (
          <span className="inline-block rounded-full bg-cyan-50 px-2.5 py-0.5 text-[10px] font-bold text-cyan-700">Gestionar muestreo</span>
        )}
        {canManageCertificates && (
          <span className="inline-block rounded-full bg-pink-50 px-2.5 py-0.5 text-[10px] font-bold text-pink-700">Gestionar certificados</span>
        )}
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 rounded-xl border border-[#EEF2F5] bg-slate-50 p-1 overflow-x-auto" aria-label="Secciones del plan">
        {DETAIL_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`whitespace-nowrap min-h-9 px-3 text-[11px] font-semibold rounded-lg transition-colors ${
              activeTab === t.key
                ? 'bg-white text-[#1F4E6D] shadow-sm'
                : 'text-slate-600 hover:bg-white/60'
            }`}
            aria-current={activeTab === t.key ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Tab panels */}
      {activeTab === 'summary' && (
        <SummaryPanel plan={p} />
      )}
      {activeTab === 'versions' && (
        <VersionsPanel planId={p.plan_id} />
      )}
      {activeTab === 'scopes' && (
        <ScopesPanel planId={p.plan_id} />
      )}
      {activeTab === 'controls' && (
        <ControlsPanel planId={p.plan_id} />
      )}
      {activeTab === 'tolerances' && (
        <TolerancesPanel planId={p.plan_id} />
      )}
      {activeTab === 'sampling' && (
        <SamplingPanel planId={p.plan_id} />
      )}
      {activeTab === 'certificates' && (
        <CertificatesPanel planId={p.plan_id} canManage={canManageCertificates} />
      )}
      {activeTab === 'resolutions' && (
        <ResolutionsPanel planId={p.plan_id} />
      )}
      {activeTab === 'integrity' && (
        <IntegrityPanel planId={p.plan_id} />
      )}
      {activeTab === 'history' && (
        <HistoryPanel planId={p.plan_id} />
      )}
    </div>
  )
}

/* ── Panel components ─────────────────────────────────────────────────────── */

function SummaryPanel({ plan }: { plan: QualityInspectionPlan }) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#EEF2F5] bg-white p-4">
        <h2 className="text-xs font-bold text-slate-900 mb-3">Información del plan</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Código', plan.code],
            ['Nombre', plan.name],
            ['Descripción', plan.description ?? '—'],
            ['Familia', plan.family],
            ['Estado', plan.status],
            ['Prioridad', String(plan.priority)],
            ['Creado por', plan.created_by.display_name],
            ['Fecha de creación', plan.created_at ? new Date(plan.created_at).toLocaleString('es-PE') : '—'],
            ['Última actualización', plan.updated_at ? new Date(plan.updated_at).toLocaleString('es-PE') : '—'],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-lg border border-[#EEF2F5] bg-slate-50 p-2.5">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
              <dd className="mt-0.5 truncate text-xs font-semibold text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-[#EEF2F5] bg-white p-4">
        <h2 className="text-xs font-bold text-slate-900 mb-3">Estadísticas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Productos', String(plan.product_count)],
            ['Categorías', String(plan.category_count)],
            ['Controles', String(plan.control_count)],
            ['Conflictos', String(plan.conflict_count)],
            ['Embalaje', plan.has_packaging ? 'Sí' : 'No'],
            ['Peso', plan.has_weight ? 'Sí' : 'No'],
            ['Temperatura', plan.has_temperature ? 'Sí' : 'No'],
            ['Certificados', plan.has_certificates ? 'Sí' : 'No'],
            ['Muestreo', plan.has_sampling ? 'Sí' : 'No'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-[#EEF2F5] bg-slate-50 p-2.5">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
              <dd className="mt-0.5 text-xs font-bold text-slate-800">{value}</dd>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}

function VersionsPanel({ planId }: { planId: string }) {
  const versions = useQuery<QualityInspectionPlanVersion[]>(
    ['quality-inspection-plans', 'versions', planId],
    `/logistics/quality-inspection-plans/${planId}/versions`,
  )

  if (versions.isLoading) return <LoadingSkeleton rows={3} />
  if (versions.isError) return <Alert variant="error">{getErrorMessage(versions.error)}</Alert>

  const items = versions.data ?? []
  if (items.length === 0) {
    return <EmptyState title="Sin versiones" description="Este plan aún no tiene versiones registradas." />
  }

  return (
    <div className="space-y-2">
      {items.map((v) => (
        <div key={v.version_id} className="flex items-center justify-between rounded-xl border border-[#EEF2F5] bg-white p-3">
          <div>
            <span className="font-mono text-xs font-bold text-[#1F4E6D]">v{v.version_number}</span>
            <span className="ml-2 text-[11px] text-slate-500">{v.status}</span>
          </div>
          <span className="text-[10px] text-slate-400">{v.created_at}</span>
        </div>
      ))}
    </div>
  )
}

function ScopesPanel({ planId }: { planId: string }) {
  const scopes = useQuery<QualityPlanScope[]>(
    ['quality-inspection-plans', 'scopes', planId],
    `/logistics/quality-inspection-plans/${planId}/scopes`,
  )

  if (scopes.isLoading) return <LoadingSkeleton rows={3} />
  if (scopes.isError) return <Alert variant="error">{getErrorMessage(scopes.error)}</Alert>

  const items = scopes.data ?? []
  if (items.length === 0) {
    return <EmptyState title="Sin ámbitos" description="No hay productos o categorías asociados a este plan." />
  }

  return (
    <div className="space-y-2">
      {items.map((s) => (
        <div key={s.scope_id} className="flex items-center justify-between rounded-xl border border-[#EEF2F5] bg-white p-3">
          <div>
            <span className="text-xs font-semibold text-slate-800">{s.product_name ?? s.category_name ?? '—'}</span>
            <span className="ml-2 text-[10px] text-slate-500">{s.scope_type} · {s.action}</span>
          </div>
          <span className="text-[10px] text-slate-400">{s.specificity}</span>
        </div>
      ))}
    </div>
  )
}

function ControlsPanel({ planId }: { planId: string }) {
  const controls = useQuery<QualityControlDefinition[]>(
    ['quality-inspection-plans', 'controls', planId],
    `/logistics/quality-inspection-plans/${planId}/controls`,
  )

  if (controls.isLoading) return <LoadingSkeleton rows={3} />
  if (controls.isError) return <Alert variant="error">{getErrorMessage(controls.error)}</Alert>

  const items = controls.data ?? []
  if (items.length === 0) {
    return <EmptyState title="Sin controles" description="No hay controles definidos para este plan." />
  }

  return (
    <div className="space-y-2">
      {items.map((c) => (
        <div key={c.control_id} className="flex items-center justify-between rounded-xl border border-[#EEF2F5] bg-white p-3">
          <div>
            <span className="font-mono text-xs font-bold text-[#1F4E6D]">{c.code}</span>
            <span className="ml-2 text-xs font-semibold text-slate-800">{c.name}</span>
            <span className="ml-2 text-[10px] text-slate-500">{c.control_type}</span>
          </div>
          <div className="flex gap-1.5">
            {c.required && <span className="text-[9px] font-bold text-red-600">REQ</span>}
            {c.blocking_future && <span className="text-[9px] font-bold text-amber-600">BLOCK</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function TolerancesPanel({ planId: _planId }: { planId: string }) {
  return (
    <Alert variant="info">
      Las tolerancias no están disponibles como colección del plan. Se administran por control desde la pantalla de Tolerancias.
    </Alert>
  )
}

function SamplingPanel({ planId: _planId }: { planId: string }) {
  return (
    <Alert variant="info">
      El muestreo no está disponible como colección del plan. Se administra por control desde la pantalla de Muestreo.
    </Alert>
  )
}

function CertificatesPanel({ planId, canManage }: { planId: string; canManage: boolean }) {
  const [controlId, setControlId] = useState('')
  const controls = useQuery<QualityControlDefinition[]>(
    ['quality-inspection-plans', 'certificate-controls', planId],
    `/logistics/quality-inspection-plans/${planId}/controls`,
  )

  if (controls.isLoading) return <LoadingSkeleton rows={2} />
  if (controls.isError) return <Alert variant="error">{getErrorMessage(controls.error)}</Alert>

  return (
    <div className="space-y-4">
      <label className="block text-xs font-semibold text-slate-600">
        Control
        <select value={controlId} onChange={(event) => setControlId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
          <option value="">Seleccione un control</option>
          {(controls.data ?? []).map((control) => (
            <option key={control.control_id} value={control.control_id}>{control.code} — {control.name}</option>
          ))}
        </select>
      </label>
      <QualityCertificateRequirementsEditor controlId={controlId || null} canManage={canManage} />
    </div>
  )
}

function ResolutionsPanel({ planId: _planId }: { planId: string }) {
  const [productInput, setProductInput] = useState('')
  const [productId, setProductId] = useState('')
  const resolution = useQuery<Record<string, unknown>>(
    ['quality-inspection-plans', 'resolution', productId],
    '/logistics/quality-inspection-plans/resolve',
    { product_id: productId },
    { enabled: Boolean(productId) },
  )

  return (
    <div className="space-y-4">
      <form onSubmit={(event) => { event.preventDefault(); setProductId(productInput.trim()) }} className="flex gap-2">
        <input value={productInput} onChange={(event) => setProductInput(event.target.value)} placeholder="ID de producto" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs" />
        <Button type="submit" size="small" disabled={!productInput.trim()}>Resolver</Button>
      </form>
      {!productId && <Alert variant="info">Ingrese un producto para consultar la resolución real. No se realiza ninguna petición sin ese contexto.</Alert>}
      {resolution.isLoading && <LoadingSkeleton rows={2} />}
      {resolution.isError && <Alert variant="error">{getErrorMessage(resolution.error)}</Alert>}
      {resolution.data && (
        <pre className="overflow-x-auto rounded-xl border border-[#EEF2F5] bg-slate-50 p-3 text-[10px] text-slate-700">{JSON.stringify(resolution.data, null, 2)}</pre>
      )}
    </div>
  )
}

function IntegrityPanel({ planId }: { planId: string }) {
  const integrity = useQuery(
    ['quality-inspection-plans', 'integrity', planId],
    `/logistics/quality-inspection-plans/${planId}/integrity`,
  )

  if (integrity.isLoading) return <LoadingSkeleton rows={2} />
  if (integrity.isError) return <Alert variant="error">{getErrorMessage(integrity.error)}</Alert>

  const data = integrity.data as Record<string, unknown> | undefined
  if (!data) {
    return <EmptyState title="Sin datos de integridad" description="No se encontraron datos de integridad." />
  }

  return (
    <section className="rounded-xl border border-[#EEF2F5] bg-white p-4">
      <h2 className="text-xs font-bold text-slate-900 mb-3">Integridad de la versión</h2>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['Algoritmo', String(data.algorithm ?? '—')],
          ['Estado', String(data.status ?? '—')],
          ['Hash versión', String(data.version_hash ?? '—')],
          ['Hash ámbitos', String(data.scopes_hash ?? '—')],
          ['Hash controles', String(data.controls_hash ?? '—')],
          ['Hash tolerancias', String(data.tolerances_hash ?? '—')],
          ['Hash muestreo', String(data.sampling_hash ?? '—')],
          ['Hash certificados', String(data.certificates_hash ?? '—')],
          ['Última verificación', String(data.last_verified_at ?? '—')],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-lg border border-[#EEF2F5] bg-slate-50 p-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
            <dd className="mt-0.5 truncate text-xs font-mono font-semibold text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function HistoryPanel({ planId: _planId }: { planId: string }) {
  return <Alert variant="info">Historial no disponible: el backend publicado no expone una ruta de historial para planes de inspección. Vista de solo lectura, sin petición.</Alert>
}
