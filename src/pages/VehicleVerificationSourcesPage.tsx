import { useCallback, useEffect, useState } from 'react'
import { vehicleVerificationsApi } from '../api/vehicle-verifications-api'
import { Alert } from '../components/common/Alert'
import { LoadingSkeleton } from '../components/common/LoadingSkeleton'
import { PageHeader } from '../components/common/PageHeader'
import { VehicleVerificationProviderHealthPanel } from '../components/vehicle-verifications/VehicleVerificationProviderHealthPanel'
import type { VehicleVerificationSourceHealth } from '../types/vehicle-verifications'

export function VehicleVerificationSourcesPage() {
  const [sources, setSources] = useState<VehicleVerificationSourceHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSources = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await vehicleVerificationsApi.listSourcesHealth()
      setSources(res)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las fuentes de verificación.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSources()
  }, [loadSources])

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title="Fuentes Registrales y Proveedores Autorizados"
        description="Monitoreo de disponibilidad, latencia, circuit breaker y estado operativo de fuentes externas de verificación."
      />

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : (
        <VehicleVerificationProviderHealthPanel
          sources={sources}
          canManageSources={false}
        />
      )}
    </div>
  )
}
