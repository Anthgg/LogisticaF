import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { logisticsApi } from '../../api/logistics-api'
import { renderWithAuth } from '../../test/test-utils'
import { ApiRequestError } from '../../types/api'
import type { AuditEventDetailResponse, IntegrityCheckResponse } from '../../types/logistics-resources'
import { AuditEventDetailModal } from './AuditEventDetailModal'

const event: AuditEventDetailResponse = {
  id: 'audit-event-1',
  event_code: 'AUD-000001',
  event_category: 'logistics',
  actor_user_id: null,
  actor_display_name_snapshot: 'Sistema',
  action: 'create',
  result: 'success',
  severity: 'low',
  resource_type: 'warehouse',
  resource_id: 'warehouse-1',
  organization_id: 'organization-1',
  branch_id: null,
  warehouse_id: null,
  occurred_at: '2026-08-27T15:00:00Z',
  event_hash: 'a'.repeat(64),
}

function integrityResponse(valid: boolean): IntegrityCheckResponse {
  // The endpoint does not return checked_at. Preserve its real response shape
  // without changing the legacy frontend contract in this wording-only hotfix.
  return {
    success: true,
    event_id: event.id,
    valid,
    stored_hash: event.event_hash,
    computed_hash: (valid ? 'a' : 'b').repeat(64),
  } as IntegrityCheckResponse
}

function renderModal() {
  return renderWithAuth(<AuditEventDetailModal eventId={event.id} isOpen onClose={vi.fn()} />)
}

beforeEach(() => {
  vi.spyOn(logisticsApi.auditEvents, 'get').mockResolvedValue(event)
  vi.spyOn(logisticsApi.auditEvents, 'verifyIntegrity').mockResolvedValue(integrityResponse(true))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AuditEventDetailModal integrity wording', () => {
  it('describes loading without claiming immutability', () => {
    vi.mocked(logisticsApi.auditEvents.get).mockReturnValueOnce(new Promise(() => {}))

    renderModal()

    expect(screen.getByText('Obteniendo evento de auditoría…')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/inmutable|inmutabilidad/i)
  })

  it('explains the SHA-256 comparison before the user requests verification', async () => {
    renderModal()

    expect(await screen.findByRole('heading', {
      name: 'Verificación de integridad (SHA-256)',
    })).toBeInTheDocument()
    expect(screen.getByText(
      'La verificación compara el hash SHA-256 almacenado con el hash calculado a partir del contenido actual del evento.',
    )).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comprobar Integridad' })).toBeEnabled()
    expect(logisticsApi.auditEvents.verifyIntegrity).not.toHaveBeenCalled()
    expect(screen.queryByText(/^(PASS|FAIL)$/)).not.toBeInTheDocument()
  })

  it.each([
    {
      valid: true,
      title: '✓ Integridad verificada',
      explanation: 'El hash almacenado coincide con el contenido actual del evento.',
      badge: 'PASS',
    },
    {
      valid: false,
      title: '⚠ La integridad del evento no pudo verificarse',
      explanation: 'El hash almacenado no coincide con el contenido actual del evento.',
      badge: 'FAIL',
    },
  ])('describes valid=$valid as a hash comparison and preserves $badge', async ({
    valid, title, explanation, badge,
  }) => {
    vi.mocked(logisticsApi.auditEvents.verifyIntegrity).mockResolvedValueOnce(integrityResponse(valid))
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('button', { name: 'Comprobar Integridad' }))

    expect(await screen.findByText(title)).toBeInTheDocument()
    expect(screen.getByText(explanation)).toBeInTheDocument()
    expect(screen.getByText(badge)).toBeInTheDocument()
    expect(logisticsApi.auditEvents.verifyIntegrity).toHaveBeenCalledExactlyOnceWith(event.id)
    expect(screen.getByRole('dialog')).not.toHaveTextContent(
      /inmutable|inmutabilidad|inalterable|tamper-proof|SIGNATURE_VALID|hackead[oa]|manipulad[oa]|Verificado en:|Invalid Date/i,
    )
  })

  it('keeps the pending state without reporting a verification result', async () => {
    vi.mocked(logisticsApi.auditEvents.verifyIntegrity).mockReturnValueOnce(new Promise(() => {}))
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('button', { name: 'Comprobar Integridad' }))

    expect(screen.getByRole('button', { name: 'Verificando…' })).toBeDisabled()
    expect(screen.queryByText(/^(PASS|FAIL)$/)).not.toBeInTheDocument()
    expect(screen.queryByText('✓ Integridad verificada')).not.toBeInTheDocument()
  })

  it('preserves verification errors without treating an API error as a hash mismatch', async () => {
    vi.mocked(logisticsApi.auditEvents.verifyIntegrity).mockRejectedValueOnce(
      new ApiRequestError('No fue posible verificar la integridad.', { code: 'HTTP_503', status: 503 }),
    )
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('button', { name: 'Comprobar Integridad' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible verificar la integridad.')
    expect(screen.getByRole('button', { name: 'Comprobar Integridad' })).toBeEnabled()
    expect(screen.queryByText(/^(PASS|FAIL)$/)).not.toBeInTheDocument()
    expect(screen.queryByText('⚠ La integridad del evento no pudo verificarse')).not.toBeInTheDocument()
  })

  it('preserves event retrieval errors', async () => {
    vi.mocked(logisticsApi.auditEvents.get).mockRejectedValueOnce(
      new ApiRequestError('Evento no disponible.', { code: 'HTTP_404', status: 404 }),
    )

    renderModal()

    expect(await screen.findByRole('alert')).toHaveTextContent('Evento no disponible.')
    expect(screen.queryByRole('button', { name: 'Comprobar Integridad' })).not.toBeInTheDocument()
    expect(logisticsApi.auditEvents.verifyIntegrity).not.toHaveBeenCalled()
  })
})
