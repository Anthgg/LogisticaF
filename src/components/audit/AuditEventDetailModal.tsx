import { useCallback, useEffect, useState } from 'react'
import { logisticsApi } from '../../api/logistics-api'
import { Alert } from '../common/Alert'
import { Button } from '../common/Button'
import { StatusBadge } from '../common/StatusBadge'
import type {
  AuditEventDetailResponse,
  IntegrityCheckResponse,
} from '../../types/logistics-resources'
import { getErrorMessage } from '../../utils/errors'

interface AuditEventDetailModalProps {
  eventId: string | null
  isOpen: boolean
  onClose: () => void
}

export function AuditEventDetailModal({
  eventId,
  isOpen,
  onClose,
}: AuditEventDetailModalProps) {
  const [event, setEvent] = useState<AuditEventDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [integrityLoading, setIntegrityLoading] = useState(false)
  const [integrityResult, setIntegrityResult] = useState<IntegrityCheckResponse | null>(null)
  const [integrityError, setIntegrityError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'diff' | 'raw' | 'metadata'>('diff')

  const fetchDetail = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)
    setIntegrityResult(null)
    setIntegrityError(null)
    try {
      const data = await logisticsApi.auditEvents.get(id)
      setEvent(data)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen && eventId) {
      void fetchDetail(eventId)
    } else {
      setEvent(null)
      setIntegrityResult(null)
    }
  }, [isOpen, eventId, fetchDetail])

  const handleVerifyIntegrity = async () => {
    if (!eventId) return
    setIntegrityLoading(true)
    setIntegrityError(null)
    try {
      const res = await logisticsApi.auditEvents.verifyIntegrity(eventId)
      setIntegrityResult(res)
    } catch (err: unknown) {
      setIntegrityError(getErrorMessage(err))
    } finally {
      setIntegrityLoading(false)
    }
  }

  if (!isOpen) return null

  const renderJsonPretty = (data: Record<string, unknown> | null | undefined) => {
    if (!data || Object.keys(data).length === 0) {
      return <p className="text-sm text-gray-500 italic p-3">Sin datos registrados</p>
    }
    return (
      <pre className="bg-gray-900 text-gray-100 text-xs p-3 rounded-lg overflow-x-auto font-mono max-h-72">
        {JSON.stringify(data, null, 2)}
      </pre>
    )
  }

  const severityBadgeVariant = (sev: string): 'active' | 'inactive' | 'pending' => {
    if (sev === 'critical' || sev === 'high') return 'inactive'
    if (sev === 'medium') return 'pending'
    return 'active'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-detail-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/75 dark:bg-gray-800/75">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400">
                Detalle de Auditoría
              </span>
              {event && (
                <StatusBadge value={severityBadgeVariant(event.severity)}>
                  {event.severity.toUpperCase()}
                </StatusBadge>
              )}
              {event && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    event.result === 'success'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                  }`}
                >
                  {event.result}
                </span>
              )}
            </div>
            <h2 id="audit-detail-title" className="text-lg font-bold text-gray-900 dark:text-white mt-1">
              {event ? event.event_code : 'Cargando evento...'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            aria-label="Cerrar modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <span className="spinner mb-2" />
              <p className="text-sm">Obteniendo evento de auditoría…</p>
            </div>
          )}

          {error && <Alert variant="error">{error}</Alert>}

          {event && (
            <>
              {/* Event Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 text-sm">
                <div>
                  <span className="block text-xs text-gray-500 font-medium">Fecha / Hora (UTC)</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {new Date(event.occurred_at).toLocaleString('es-PE')}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500 font-medium">Categoría</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{event.event_category}</span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500 font-medium">Acción</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{event.action ?? '—'}</span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500 font-medium">Actor</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {event.actor_display_name_snapshot ?? 'Sistema'}
                  </span>
                </div>

                <div>
                  <span className="block text-xs text-gray-500 font-medium">Tipo de Recurso</span>
                  <span className="font-mono text-xs text-gray-800 dark:text-gray-200">
                    {event.resource_type ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500 font-medium">ID de Recurso</span>
                  <span className="font-mono text-xs text-gray-800 dark:text-gray-200 truncate block">
                    {event.resource_id ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500 font-medium">Dirección IP</span>
                  <span className="font-mono text-xs text-gray-800 dark:text-gray-200">
                    {event.ip_address ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500 font-medium">ID de Sesión</span>
                  <span className="font-mono text-xs text-gray-800 dark:text-gray-200 truncate block">
                    {event.session_id ?? '—'}
                  </span>
                </div>
              </div>

              {/* Changed fields banner */}
              {event.changed_fields && event.changed_fields.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800">
                  <span className="font-semibold">Campos modificados:</span>
                  {event.changed_fields.map((field) => (
                    <span
                      key={field}
                      className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-800 font-mono font-medium"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              )}

              {/* Tabs: Before/After Diff vs Metadata vs Raw */}
              <div>
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('diff')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                      activeTab === 'diff'
                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Comparador Before / After
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('metadata')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                      activeTab === 'metadata'
                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Metadatos y Contexto
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('raw')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                      activeTab === 'raw'
                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    JSON Completo
                  </button>
                </div>

                {activeTab === 'diff' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border border-rose-200 dark:border-rose-900/60 rounded-lg overflow-hidden">
                        <div className="bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 border-b border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center justify-between">
                          <span>Estado Anterior (Before)</span>
                          <span className="text-[10px] uppercase">previous_data</span>
                        </div>
                        {renderJsonPretty(event.previous_data)}
                      </div>

                      <div className="border border-emerald-200 dark:border-emerald-900/60 rounded-lg overflow-hidden">
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 border-b border-emerald-200 dark:border-emerald-900/60 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                          <span>Estado Posterior (After)</span>
                          <span className="text-[10px] uppercase">new_data</span>
                        </div>
                        {renderJsonPretty(event.new_data)}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                      Nota de seguridad: Los valores sensibles (claves, tokens, contraseñas) son redactados automáticamente bajo la política <code>AUDIT_SECRET_LEAKS=0</code>.
                    </p>
                  </div>
                )}

                {activeTab === 'metadata' && (
                  <div className="space-y-3 text-xs font-mono">
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h4 className="text-xs font-sans font-bold text-gray-700 dark:text-gray-300 mb-2">
                        Trazabilidad Técnica
                      </h4>
                      <ul className="space-y-1 text-gray-600 dark:text-gray-300">
                        <li><strong>Request ID:</strong> {event.request_id || 'N/A'}</li>
                        <li><strong>Correlation ID:</strong> {event.correlation_id || 'N/A'}</li>
                        <li><strong>Endpoint:</strong> {event.method ? `${event.method} ` : ''}{event.endpoint || 'N/A'}</li>
                        <li><strong>User Agent:</strong> {event.user_agent || 'N/A'}</li>
                        <li><strong>Origin:</strong> {event.origin || 'N/A'}</li>
                        <li><strong>Motivo / Reason:</strong> {event.reason_text || event.reason_code || 'N/A'}</li>
                        <li><strong>Roles Snapshot:</strong> {event.actor_role_codes_snapshot || 'N/A'}</li>
                      </ul>
                    </div>
                    {event.metadata && (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 font-sans font-bold text-xs">
                          Metadata Adicional
                        </div>
                        {renderJsonPretty(event.metadata)}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'raw' && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    {renderJsonPretty(event as unknown as Record<string, unknown>)}
                  </div>
                )}
              </div>

              {/* Event Hash Integrity Verification Section */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Verificación de integridad (SHA-256)
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      La verificación compara el hash SHA-256 almacenado con el hash calculado a partir del contenido actual del evento.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleVerifyIntegrity}
                    disabled={integrityLoading}
                  >
                    {integrityLoading ? 'Verificando…' : 'Comprobar Integridad'}
                  </Button>
                </div>

                {event.event_hash && (
                  <div className="text-xs font-mono break-all bg-white dark:bg-gray-950 p-2.5 rounded border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300">
                    <span className="text-gray-400 select-none">SHA-256 Hash: </span>
                    {event.event_hash}
                  </div>
                )}

                {integrityError && <Alert variant="error">{integrityError}</Alert>}

                {integrityResult && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                      integrityResult.valid
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                        : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    <div>
                      <span className="font-bold block">
                        {integrityResult.valid
                          ? '✓ Integridad verificada'
                          : '⚠ La integridad del evento no pudo verificarse'}
                      </span>
                      <span className="text-[11px] opacity-80">
                        {integrityResult.valid
                          ? 'El hash almacenado coincide con el contenido actual del evento.'
                          : 'El hash almacenado no coincide con el contenido actual del evento.'}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold px-2 py-1 bg-white/60 dark:bg-black/30 rounded">
                      {integrityResult.valid ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50/75 dark:bg-gray-800/75 flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}
