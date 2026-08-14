import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateReceptionDifferenceCasePage } from './CreateReceptionDifferenceCasePage'

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  createFromReceipt: vi.fn(),
}))

vi.mock('../../inbound-docks/hooks/useQuery', () => ({ useQuery: mocks.useQuery, useMutation: mocks.useMutation }))
vi.mock('../../logistics-permissions/hooks/useLogisticsPermissions', () => ({ useLogisticsPermissions: () => ({ hasPermission: () => true }) }))
vi.mock('../api/receptionDifferenceCasesApi', () => ({ receptionDifferenceCasesApi: { createFromReceipt: mocks.createFromReceipt } }))

describe('CreateReceptionDifferenceCasePage', () => {
  beforeEach(() => {
    mocks.useQuery.mockReset()
    mocks.useMutation.mockReset()
    mocks.createFromReceipt.mockReset()
    mocks.useQuery.mockReturnValue({ data: { open_cases: 2 }, isLoading: false, isError: false })
    mocks.createFromReceipt.mockResolvedValue({ case_id: 'case-1' })
    mocks.useMutation.mockImplementation((operation) => ({
      mutate: vi.fn((value) => operation(value)),
      isPending: false,
      error: null,
    }))
  })

  it('consulta summary y nunca eligible-receipts', () => {
    render(<MemoryRouter><CreateReceptionDifferenceCasePage /></MemoryRouter>)
    const paths = mocks.useQuery.mock.calls.map((call) => call[1])
    expect(paths).toEqual(['/logistics/reception-difference-cases/summary'])
    expect(paths.some((path) => String(path).includes('eligible-receipts'))).toBe(false)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('crea desde el receipt seleccionado', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><CreateReceptionDifferenceCasePage /></MemoryRouter>)
    await user.type(screen.getByLabelText('ID de recepción'), 'receipt-1')
    await user.click(screen.getByRole('button', { name: 'Crear caso' }))
    expect(mocks.createFromReceipt).toHaveBeenCalledWith({ receipt_id: 'receipt-1' })
  })
})
