import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../../components/common/PageHeader'
import { Button } from '../../../components/common/Button'
import { Alert } from '../../../components/common/Alert'
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton'
import { LogisticsIcon } from '../../../components/common/LogisticsIcon'
import { useLogisticsPermissions } from '../../logistics-permissions/hooks/useLogisticsPermissions'
import { LOGISTICS_PERMISSIONS } from '../../logistics-permissions/logistics-permissions-map'
import { useQuery } from '../../inbound-docks/hooks/useQuery'
import { useLogisticsAccess } from '../../logistics-me/hooks/useLogisticsAccess'
import { getErrorMessage } from '../../../utils/errors'
import { PutawayPhaseNav } from '../components/PutawayPhaseNav'
import { PutawayContextEmptyState } from '../components/PutawayContextEmptyState'
import { ScannerInput } from '../components/ScannerInput'
import { putawayMobileApi } from '../api/putawayMobileApi'
import type {
  PutawayExecutionSessionApi,
  PutawayListApi,
  PutawayOperationalPlacementApi,
  PutawayScanEventApi,
  PutawayTaskApi,
} from '../types/putaway-api'

const TERMINAL_TASK_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'SUPERSEDED'])

type PendingStep = 'session' | 'placement' | null

export function PutawayMobileWorkspacePage() {
  const navigate = useNavigate()
  const { hasPermission } = useLogisticsPermissions()
  const { currentContext } = useLogisticsAccess()
  const canAccess = hasPermission(LOGISTICS_PERMISSIONS.putaway.mobileAccess)
  const organizationId = currentContext.organization_id
  const tasks = useQuery<PutawayListApi<PutawayTaskApi>>(
    ['putaway', 'mobile', organizationId],
    '/logistics/putaway/tasks',
    { page: 1, page_size: 50, sort_by: 'priority', sort_order: 'desc' },
    { enabled: canAccess && Boolean(organizationId) },
  )

  const [selectedTask, setSelectedTask] = useState<PutawayTaskApi | null>(null)
  const [session, setSession] = useState<PutawayExecutionSessionApi | null>(null)
  const [productScan, setProductScan] = useState<PutawayScanEventApi | null>(null)
  const [locationScan, setLocationScan] = useState<PutawayScanEventApi | null>(null)
  const [placement, setPlacement] = useState<PutawayOperationalPlacementApi | null>(null)
  const [pendingStep, setPendingStep] = useState<PendingStep>(null)
  const [workflowError, setWorkflowError] = useState<string | null>(null)

  const actionable = (tasks.data?.items ?? []).filter(
    (task) => !TERMINAL_TASK_STATUSES.has(task.status),
  )
  const expectedLocationId = selectedTask?.selected_location_id ?? selectedTask?.recommended_location_id ?? null

  const resetWorkflow = (task: PutawayTaskApi | null) => {
    setSelectedTask(task)
    setSession(null)
    setProductScan(null)
    setLocationScan(null)
    setPlacement(null)
    setPendingStep(null)
    setWorkflowError(null)
  }

  const startSession = async () => {
    if (!selectedTask) return
    setPendingStep('session')
    setWorkflowError(null)
    try {
      setSession(await putawayMobileApi.createSession(selectedTask.id, 'MOBILE_CAMERA'))
    } catch (error) {
      setWorkflowError(getErrorMessage(error))
    } finally {
      setPendingStep(null)
    }
  }

  const scanProduct = async (code: string): Promise<PutawayScanEventApi> => {
    if (!selectedTask || !session) throw new Error('Putaway session is not ready')
    const result = await putawayMobileApi.scanProduct(session.id, code, selectedTask.expected_product_id)
    setProductScan(result)
    return result
  }

  const scanLocation = async (code: string): Promise<PutawayScanEventApi> => {
    if (!session || !expectedLocationId) throw new Error('Putaway location is not ready')
    const result = await putawayMobileApi.scanLocation(session.id, code, expectedLocationId)
    setLocationScan(result)
    return result
  }

  const confirmCompleteAndFinalize = async () => {
    if (!selectedTask || !session || !productScan || !locationScan || !expectedLocationId) return
    setPendingStep('placement')
    setWorkflowError(null)
    try {
      const confirmation = await putawayMobileApi.confirmPlacement(
        selectedTask,
        productScan,
        locationScan,
        expectedLocationId,
      )
      await putawayMobileApi.completeSession(session.id)
      setPlacement(await putawayMobileApi.finalizePlacement(confirmation.id))
    } catch (error) {
      setWorkflowError(getErrorMessage(error))
    } finally {
      setPendingStep(null)
    }
  }

  if (!canAccess) {
    return <div className="space-y-4"><PageHeader title="Workspace móvil" /><Alert variant="error">No tienes permisos para ejecutar tareas de ubicación.</Alert></div>
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Fase 043 · Operación móvil"
        title="Workspace móvil de ubicación"
        description="Abre una sesión real, valida producto y ubicación, confirma la colocación y finaliza el movimiento."
        actions={<Button variant="secondary" onClick={() => navigate('/logistics/putaway')}>Volver al tablero</Button>}
      />
      <PutawayPhaseNav />

      {!organizationId && (
        <PutawayContextEmptyState
          title="Selecciona la operación móvil"
          description="La cola de tareas y los escaneos deben ejecutarse dentro de una organización concreta."
        />
      )}

      {organizationId && (
        <>
          {tasks.isLoading && <LoadingSkeleton rows={6} />}
          {tasks.isError && <Alert variant="error">{getErrorMessage(tasks.error)}</Alert>}

          {tasks.data && !selectedTask && (
            <section className="mx-auto max-w-2xl">
              <div className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-300">1 · Seleccionar tarea</p><h2 className="mt-1 text-2xl font-bold">{actionable.length} tarea(s) disponibles</h2></div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sky-300"><LogisticsIcon name="sessions" size={22} aria-hidden="true" /></span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">Cada escaneo queda ligado a la sesión de la tarea seleccionada.</p>
              </div>

              {actionable.length === 0 ? (
                <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-12 text-center">
                  <LogisticsIcon name="check" size={26} className="mx-auto text-emerald-700" aria-hidden="true" />
                  <h2 className="mt-4 text-xl font-bold text-emerald-950">Cola completada</h2>
                  <p className="mt-2 text-sm text-emerald-800">No hay tareas ejecutables en este contexto.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {actionable.map((task, index) => (
                    <button
                      type="button"
                      key={task.id}
                      onClick={() => resetWorkflow(task)}
                      className="flex min-h-24 w-full items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
                      aria-label={`Seleccionar ${task.task_number}`}
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white">{index + 1}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-bold text-slate-950">{task.task_number}</span><span className="mt-1 block truncate text-sm text-slate-500">Restante {task.remaining_quantity} · {task.status.replaceAll('_', ' ')}</span></span>
                      <LogisticsIcon name="arrow-right" size={20} className="shrink-0 text-slate-400" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {selectedTask && (
            <section className="mx-auto max-w-2xl space-y-4" aria-label="Flujo móvil de putaway">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Tarea seleccionada</p><h2 className="mt-1 text-xl font-bold text-slate-950">{selectedTask.task_number}</h2><p className="mt-2 text-sm text-slate-500">Producto {selectedTask.expected_product_id} · Cantidad {selectedTask.remaining_quantity}</p></div>
                  {!session && <Button variant="ghost" onClick={() => resetWorkflow(null)}>Cambiar</Button>}
                </div>
                {expectedLocationId ? <p className="mt-3 truncate font-mono text-xs text-slate-500">Destino {expectedLocationId}</p> : <Alert variant="warning">La tarea no tiene destino seleccionado o recomendado. No se enviarán escaneos de ubicación.</Alert>}
              </div>

              {!session && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">2 · Iniciar sesión</p>
                  <Button className="mt-4 w-full" onClick={startSession} isLoading={pendingStep === 'session'} loadingLabel="Abriendo sesión…">Iniciar sesión móvil</Button>
                </div>
              )}

              {session && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">3 · Escanear producto</p>
                  <p className="mt-2 text-sm text-slate-500">Sesión activa {session.id}</p>
                  <div className="mt-4"><ScannerInput label="Código de producto" onScan={scanProduct} disabled={Boolean(productScan)} /></div>
                </div>
              )}

              {session && productScan && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">4 · Escanear ubicación</p>
                  <div className="mt-4"><ScannerInput label="Código de ubicación" onScan={scanLocation} disabled={!expectedLocationId || Boolean(locationScan)} /></div>
                </div>
              )}

              {session && productScan && locationScan && !placement && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">5 · Confirmar movimiento</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Se confirmará la colocación, se completará la sesión y se finalizará el placement operativo.</p>
                  <Button className="mt-4 w-full" onClick={confirmCompleteAndFinalize} isLoading={pendingStep === 'placement'} loadingLabel="Finalizando ubicación…">Confirmar y finalizar</Button>
                </div>
              )}

              {workflowError && <Alert variant="error" onDismiss={() => setWorkflowError(null)}>{workflowError}</Alert>}

              {placement && (
                <Alert variant="success" title="Ubicación finalizada">
                  Placement {placement.id} · {placement.status.replaceAll('_', ' ')}
                </Alert>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
