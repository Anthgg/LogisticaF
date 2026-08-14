import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VehicleVerificationsPage } from './VehicleVerificationsPage'

const mocks = vi.hoisted(() => ({ listByVehicle: vi.fn() }))

vi.mock('../api/vehicle-verifications-api', () => ({ vehicleVerificationsApi: { listByVehicle: mocks.listByVehicle } }))

describe('VehicleVerificationsPage', () => {
  beforeEach(() => {
    mocks.listByVehicle.mockReset()
    mocks.listByVehicle.mockResolvedValue([])
  })

  it('no emite request hasta seleccionar vehicle_id', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><VehicleVerificationsPage /></MemoryRouter>)
    expect(mocks.listByVehicle).not.toHaveBeenCalled()
    expect(screen.getByText(/no se realiza ninguna request global/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText('ID del vehículo'), 'vehicle-1')
    await user.click(screen.getByRole('button', { name: 'Consultar verificaciones' }))
    expect(mocks.listByVehicle).toHaveBeenCalledWith('vehicle-1')
  })
})
