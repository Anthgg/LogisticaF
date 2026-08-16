import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithAuth } from '../test/test-utils'
import { DocumentsPage } from './DocumentsPage'
import { DocumentDetailPanel } from '../components/common/DocumentDetailPanel'
import { documentsApi, documentTotalPages } from '../api/documents-api'
import type {
  DocumentDetail,
  DocumentHistoryEntry,
  DocumentListResponse,
  DocumentSummary,
} from '../types/logistics-documents'

/**
 * Fixtures copiadas del contrato real del backend
 * `d55e7f2b64ea6d8ce278fb626046c12d3dab1286`.
 *
 * El punto de estas pruebas es que fallen si alguien vuelve a introducir un
 * campo que el backend no emite: las capacidades viajan PLANAS y no existen
 * `capabilities`, `code`, `hash_sha256`, `content_snapshot` ni `created_at` en
 * el resumen.
 */
const summaryFixture: DocumentSummary = {
  id: '2f2f0f5c-6b1a-4a9f-9b0a-2a5c8b7d1e01',
  document_code: 'DOC-001',
  document_type_code: 'REQ',
  document_type_name: 'Requisición',
  family: 'PURCHASING',
  title: 'Requisición de compra 001',
  status: 'ISSUED',
  issued_at: '2026-08-01T12:00:00Z',
  issued_by_summary: null,
  branch_summary: { id: '3a1e1f0e-2c2d-4d5f-8a9b-0c1d2e3f4a5b', name: 'Sede Central' },
  warehouse_summary: null,
  source_reference: { resource_type: 'REQUISITION', resource_id: '9f8e7d6c-5b4a-4938-8271-6f5e4d3c2b1a' },
  reprint_count: 0,
  print_request_count: 0,
  sensitivity: 'RESTRICTED',
  can_preview: true,
  can_download: true,
  can_print: true,
  can_reprint: false,
  can_cancel: false,
  can_view_history: true,
  authoritative_artifact_status: 'ACTIVE',
}

const listFixture: DocumentListResponse = {
  items: [summaryFixture],
  total: 1,
  page: 1,
  page_size: 20,
}

const detailFixture: DocumentDetail = {
  ...summaryFixture,
  lifecycle_status: 'ACTIVE',
  source_resource_type: 'REQUISITION',
  source_resource_id: '9f8e7d6c-5b4a-4938-8271-6f5e4d3c2b1a',
  source_operation_id: null,
  current_snapshot_id: '7c6b5a49-3827-4160-9f8e-7d6c5b4a3928',
  created_at: '2026-07-30T09:00:00Z',
  updated_at: '2026-08-01T12:00:00Z',
}

const historyFixture: DocumentHistoryEntry[] = [
  {
    event_type: 'REPRINT_REQUESTED',
    timestamp: '2026-08-01T12:00:00Z',
    actor_user_id: '0f02a6e1-b9ca-4e4a-b85d-5fd469943a78',
    actor_name: 'Usuario de Prueba',
    reason: 'Copia extraviada',
    copy_number: 2,
    details: {},
  },
]

const permissions = vi.hoisted(() => ({ granted: new Set<string>() }))

vi.mock('../features/logistics-me/hooks/useLogisticsAccess', () => ({
  useLogisticsAccess: () => ({
    hasPermission: (code: string) => permissions.granted.has(code),
  }),
}))

vi.mock('../features/continuous-auth/hooks/useSensitiveOperationGuard', () => ({
  useSensitiveOperationGuard: () => ({
    guardSensitiveAction: async (action: () => Promise<void>) => {
      await action()
      return true
    },
  }),
}))

vi.mock('../api/documents-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/documents-api')>()
  return {
    ...actual,
    documentsApi: {
      list: vi.fn(),
      get: vi.fn(),
      getHistory: vi.fn(),
      getPreviewBlobUrl: vi.fn(),
      downloadPdf: vi.fn(),
      registerPrintIntent: vi.fn(),
      reprint: vi.fn(),
      cancel: vi.fn(),
      createExport: vi.fn(),
    },
  }
})

const ALL_DOCUMENT_PERMISSIONS = [
  'logistics.documents.read',
  'logistics.documents.preview',
  'logistics.documents.download',
  'logistics.documents.export',
  'logistics.documents.cancel',
  'logistics.documents.reprint',
  'logistics.audit.read_sensitive',
]

function grant(...codes: string[]) {
  permissions.granted = new Set(codes)
}

function renderDocuments() {
  return renderWithAuth(<DocumentsPage />)
}

describe('contrato runtime de Documents · listado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    grant(...ALL_DOCUMENT_PERMISSIONS)
    vi.mocked(documentsApi.list).mockResolvedValue(listFixture)
  })

  it('renderiza la respuesta real sin leer un objeto capabilities inexistente', async () => {
    const errors: unknown[] = []
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args[0])
    }

    renderDocuments()

    await waitFor(() => {
      expect(screen.getByText('DOC-001')).toBeInTheDocument()
    })

    console.error = originalError
    const messages = errors.map((entry) => String(entry)).join('\n')
    expect(messages).not.toContain('Cannot read properties of undefined')
  })

  it('muestra Ver y Descargar cuando el backend concede la capacidad', async () => {
    renderDocuments()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Descargar' })).toBeInTheDocument()
    // El backend niega reimpresión y anulación en esta fixture.
    expect(screen.queryByRole('button', { name: 'Reimprimir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument()
  })

  it('oculta las acciones que el backend niega aunque el permiso exista', async () => {
    vi.mocked(documentsApi.list).mockResolvedValue({
      ...listFixture,
      items: [
        {
          ...summaryFixture,
          can_preview: false,
          can_download: false,
          can_reprint: false,
          can_cancel: false,
        },
      ],
    })

    renderDocuments()

    await waitFor(() => {
      expect(screen.getByText('DOC-001')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Ver' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descargar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reimprimir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument()
  })

  it('oculta las acciones cuando falta el permiso aunque el backend las conceda', async () => {
    grant('logistics.documents.read')

    renderDocuments()

    await waitFor(() => {
      expect(screen.getByText('DOC-001')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Ver' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descargar' })).not.toBeInTheDocument()
  })

  it('pide el listado con los filtros que el backend publica', async () => {
    renderDocuments()

    await waitFor(() => {
      expect(documentsApi.list).toHaveBeenCalled()
    })
    const query = vi.mocked(documentsApi.list).mock.calls[0]?.[0] ?? {}
    expect(Object.keys(query)).not.toContain('document_type')
    expect(query).toMatchObject({ page: 1, page_size: 20 })
  })

  it('muestra la fecha de emisión y no un created_at que el resumen no publica', async () => {
    vi.mocked(documentsApi.list).mockResolvedValue({
      ...listFixture,
      items: [{ ...summaryFixture, document_code: null, issued_at: null, status: 'DRAFT' }],
    })

    renderDocuments()

    await waitFor(() => {
      expect(screen.getByText('Sin código')).toBeInTheDocument()
    })
    expect(screen.getByText('Sin emitir')).toBeInTheDocument()
    expect(screen.getByText('Fecha de emisión')).toBeInTheDocument()
  })
})

describe('contrato runtime de Documents · paginación derivada', () => {
  it('deriva las páginas porque el backend no publica total_pages', () => {
    expect(documentTotalPages(0, 20)).toBe(0)
    expect(documentTotalPages(1, 20)).toBe(1)
    expect(documentTotalPages(20, 20)).toBe(1)
    expect(documentTotalPages(21, 20)).toBe(2)
    // Un page_size inválido no debe producir Infinity ni NaN.
    expect(documentTotalPages(10, 0)).toBe(0)
  })
})

describe('contrato runtime de Documents · detalle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    grant(...ALL_DOCUMENT_PERMISSIONS)
    vi.mocked(documentsApi.get).mockResolvedValue(detailFixture)
    vi.mocked(documentsApi.getHistory).mockResolvedValue(historyFixture)
  })

  it('renderiza solo campos publicados y no inventa hash ni snapshot', async () => {
    renderWithAuth(<DocumentDetailPanel documentId={detailFixture.id} onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Requisición de compra 001')).toBeInTheDocument()
    })
    expect(screen.getByText('Sede Central')).toBeInTheDocument()
    expect(screen.getByText('No aplica')).toBeInTheDocument()
    expect(screen.queryByText(/Integridad \(SHA-256\)/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Snapshot inmutable/)).not.toBeInTheDocument()
  })

  it('lee el historial de la clave history y lo muestra', async () => {
    renderWithAuth(<DocumentDetailPanel documentId={detailFixture.id} onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText(/REPRINT_REQUESTED/)).toBeInTheDocument()
    })
    expect(screen.getByText(/Usuario de Prueba/)).toBeInTheDocument()
    expect(screen.queryByText('Sin eventos registrados.')).not.toBeInTheDocument()
  })

  it('distingue un historial vacío de un historial que falló', async () => {
    vi.mocked(documentsApi.getHistory).mockRejectedValue(new Error('boom'))

    renderWithAuth(<DocumentDetailPanel documentId={detailFixture.id} onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText(/No se pudo cargar el historial/)).toBeInTheDocument()
    })
    expect(screen.queryByText('Sin eventos registrados.')).not.toBeInTheDocument()
  })

  it('no pide el historial cuando el backend niega la capacidad', async () => {
    vi.mocked(documentsApi.get).mockResolvedValue({ ...detailFixture, can_view_history: false })

    renderWithAuth(<DocumentDetailPanel documentId={detailFixture.id} onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Sin eventos registrados.')).toBeInTheDocument()
    })
    expect(documentsApi.getHistory).not.toHaveBeenCalled()
  })

  it('no ofrece el original anulado sobre un documento vigente', async () => {
    renderWithAuth(
      <DocumentDetailPanel
        documentId={detailFixture.id}
        onClose={() => {}}
        onDownloadOriginal={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Requisición de compra 001')).toBeInTheDocument()
    })
    expect(
      screen.queryByRole('button', { name: 'Descargar original cancelado' }),
    ).not.toBeInTheDocument()
  })

  it('ofrece el original anulado sobre un documento anulado', async () => {
    vi.mocked(documentsApi.get).mockResolvedValue({ ...detailFixture, status: 'CANCELLED' })

    renderWithAuth(
      <DocumentDetailPanel
        documentId={detailFixture.id}
        onClose={() => {}}
        onDownloadOriginal={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Descargar original cancelado' }),
      ).toBeInTheDocument()
    })
  })
})
