import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UbigeoSelector } from './UbigeoSelector'
import { geographyApi } from '../../api/geography-api'

vi.mock('../../api/geography-api', () => ({
  geographyApi: {
    listDepartments: vi.fn(),
    listProvincesByDepartment: vi.fn(),
    listDistrictsByProvince: vi.fn(),
  },
}))

describe('UbigeoSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(geographyApi.listDepartments).mockResolvedValue([
      { code: '15', name: 'LIMA' },
      { code: '13', name: 'LA LIBERTAD' },
    ])
    vi.mocked(geographyApi.listProvincesByDepartment).mockResolvedValue([
      { code: '1501', name: 'LIMA', department_code: '15' },
    ])
    vi.mocked(geographyApi.listDistrictsByProvince).mockResolvedValue([
      { code: '150101', name: 'LIMA', province_code: '1501', department_code: '15' },
      { code: '150122', name: 'MIRAFLORES', province_code: '1501', department_code: '15' },
    ])
  })

  it('renders all three cascading selectors', async () => {
    render(<UbigeoSelector value={null} onChange={vi.fn()} />)

    expect(screen.getByText('Departamento')).toBeInTheDocument()
    expect(screen.getByText('Provincia')).toBeInTheDocument()
    expect(screen.getByText('Distrito')).toBeInTheDocument()

    await waitFor(() => {
      expect(geographyApi.listDepartments).toHaveBeenCalled()
    })
  })

  it('cascades department selection to load provinces and districts', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<UbigeoSelector value={null} onChange={handleChange} />)

    await waitFor(() => {
      expect(geographyApi.listDepartments).toHaveBeenCalled()
    })

    await user.selectOptions(screen.getByLabelText('Departamento'), '15')

    await waitFor(() => {
      expect(geographyApi.listProvincesByDepartment).toHaveBeenCalledWith('15')
    })
  })
})
