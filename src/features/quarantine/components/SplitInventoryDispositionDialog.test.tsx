import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SplitInventoryDispositionDialog } from './SplitInventoryDispositionDialog'

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), run: vi.fn() }))

vi.mock('../../inbound-docks/hooks/useQuery', () => ({
  useMutation: () => ({ mutate: mocks.mutate, isPending: false, error: null }),
}))
vi.mock('../../logistics-permissions/hooks/useSensitiveActionGuard', () => ({
  useSensitiveActionGuard: () => ({ run: mocks.run, stepUpRequired: false, errorMessage: null }),
}))

describe('SplitInventoryDispositionDialog', () => {
  beforeEach(() => {
    mocks.mutate.mockReset()
    mocks.run.mockReset()
    mocks.run.mockImplementation(async (operation) => {
      await operation('')
      return true
    })
  })

  it('previsualiza localmente y solo muta al confirmar', async () => {
    const user = userEvent.setup()
    render(
      <SplitInventoryDispositionDialog
        isOpen
        allocationId="allocation-1"
        availableQuantity="10"
        unitSymbol="kg"
        onClose={vi.fn()}
        onSplitComplete={vi.fn()}
      />,
    )

    expect(mocks.mutate).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Cantidad'), '4')
    expect(screen.getByText('6 kg')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Motivo'), 'Separación parcial')
    await user.click(screen.getByLabelText('Confirmo la división previsualizada.'))
    await user.click(screen.getByRole('button', { name: 'Confirmar división' }))

    expect(mocks.mutate).toHaveBeenCalledWith({
      split_type: 'RELEASE',
      quantity: '4',
      reason: 'Separación parcial',
    })
  })
})
