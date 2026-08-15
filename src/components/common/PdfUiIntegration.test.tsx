import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PurchaseRequisitionDocumentPanel } from '../purchase-requisitions/PurchaseRequisitionCommentsPanel'
import { WarehouseLocationDetailPanel } from '../warehouses/WarehouseLocationDetailPanel'
import type { WarehouseLocationTreeNode } from '../../types/warehouse-modeling'
import { pdfApi } from '../../api/pdf/pdf-endpoints'
import { downloadPdfFile } from '../../api/pdf/pdf-client'
import { warehousesApi } from '../../api/warehouses-modeling-api'
import { renderWithAuth } from '../../test/test-utils'

vi.mock('../../api/pdf/pdf-endpoints', () => ({
  pdfApi: {
    requisition: {
      preview: vi.fn(),
      download: vi.fn(),
    },
  },
}))

vi.mock('../../api/pdf/pdf-client', () => ({
  createPdfObjectUrl: vi.fn(() => 'blob:preview'),
  downloadPdfFile: vi.fn(),
  getPdfErrorMessage: vi.fn((error: unknown) =>
    error instanceof Error ? error.message : 'Error PDF',
  ),
}))

vi.mock('../../api/warehouses-modeling-api', () => ({
  warehousesApi: {
    downloadLocationLabelPdf: vi.fn(),
  },
}))

const mockPdf = {
  blob: new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
  size: 8,
  filename: 'requisicion.pdf',
  contentType: 'application/pdf',
  contentDisposition: 'attachment; filename="requisicion.pdf"',
  response: new Response(),
}

const locationNode: WarehouseLocationTreeNode = {
  id: 'loc-1',
  code_segment: 'B01',
  full_code: 'WH-A01-R01-B01',
  name: 'Bin 01',
  location_type: 'BIN',
  status: 'ACTIVE',
  usage_type: 'STORAGE',
  has_children: false,
  children_count: 0,
}

describe('integración PDF en pantallas reales', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(pdfApi.requisition.preview).mockResolvedValue(mockPdf)
    vi.mocked(pdfApi.requisition.download).mockResolvedValue(mockPdf)
    vi.mocked(warehousesApi.downloadLocationLabelPdf).mockResolvedValue(
      undefined,
    )
  })

  it('emite un solo request de preview REQ al abrir el visor', async () => {
    const user = userEvent.setup()
    renderWithAuth(
      <PurchaseRequisitionDocumentPanel
        requisitionId="req-1"
        requisitionCode="REQ-0001"
        activeRevisionNumber={2}
        canPreview
        canDownload
      />,
    )

    await user.click(
      screen.getByRole('button', { name: /Vista Previa/i }),
    )

    await waitFor(() => {
      expect(pdfApi.requisition.preview).toHaveBeenCalledOnce()
    })
    expect(pdfApi.requisition.preview).toHaveBeenCalledWith('req-1')
    expect(pdfApi.requisition.download).not.toHaveBeenCalled()
  })

  it('emite un solo request de download REQ y usa su filename', async () => {
    const user = userEvent.setup()
    renderWithAuth(
      <PurchaseRequisitionDocumentPanel
        requisitionId="req-1"
        requisitionCode="REQ-0001"
        activeRevisionNumber={2}
        canDownload
      />,
    )

    await user.click(
      screen.getByRole('button', { name: /Descargar Documento/i }),
    )

    await waitFor(() => {
      expect(pdfApi.requisition.download).toHaveBeenCalledOnce()
    })
    expect(downloadPdfFile).toHaveBeenCalledWith(mockPdf)
    expect(pdfApi.requisition.preview).not.toHaveBeenCalled()
  })

  it('oculta acciones REQ sin capabilities', () => {
    renderWithAuth(
      <PurchaseRequisitionDocumentPanel
        requisitionId="req-1"
        requisitionCode="REQ-0001"
        activeRevisionNumber={2}
      />,
    )

    expect(
      screen.queryByRole('button', { name: /Vista Previa/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Descargar Documento/i }),
    ).not.toBeInTheDocument()
  })

  it('descarga la etiqueta individual A6 sin simular un preview', async () => {
    const user = userEvent.setup()
    renderWithAuth(
      <WarehouseLocationDetailPanel
        locationNode={locationNode}
        onBlockLocation={() => {}}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: /Descargar Etiqueta QR PDF/i }),
    )

    await waitFor(() => {
      expect(warehousesApi.downloadLocationLabelPdf).toHaveBeenCalledOnce()
    })
    expect(warehousesApi.downloadLocationLabelPdf).toHaveBeenCalledWith(
      'loc-1',
      'A6',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
