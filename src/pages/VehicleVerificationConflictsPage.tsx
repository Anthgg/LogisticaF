import { Alert } from '../components/common/Alert'
import { PageHeader } from '../components/common/PageHeader'

export function VehicleVerificationConflictsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader title="Conflictos vehiculares" description="Capacidad futura sin endpoint publicado en F045." />
      <Alert variant="info">La gestión de conflictos no está disponible en el backend actual. Esta pantalla no realiza requests.</Alert>
    </div>
  )
}
