import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../api/api-client'
import QualityCertificateRequirementsEditor from './QualityCertificateRequirementsEditor'

vi.mock('../../../api/api-client', () => ({
  apiRequest: vi.fn(),
  getCsrfToken: vi.fn().mockResolvedValue('csrf-quality'),
}))

const mockedApiRequest = vi.mocked(apiRequest)

describe('QualityCertificateRequirementsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no realiza ninguna petición sin controlId y muestra indisponibilidad explícita', () => {
    render(<QualityCertificateRequirementsEditor controlId={null} />)

    expect(screen.getByText('Seleccione un control')).toBeInTheDocument()
    expect(screen.getByText(/no se realizó ninguna consulta/i)).toBeInTheDocument()
    expect(mockedApiRequest).not.toHaveBeenCalled()
  })
})
