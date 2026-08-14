import { Alert } from '../components/common/Alert'
import { PageHeader } from '../components/common/PageHeader'

export function VehicleVerificationReviewTasksPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader title="Tareas de revisión vehicular" description="Capacidad futura sin endpoint publicado en F045." />
      <Alert variant="info">La cola de revisión no está disponible en el backend actual. Esta pantalla no realiza requests.</Alert>
    </div>
  )
}
