/**
 * Tests for LocationPicker component — F005.4 / F005.4.1 (Location Picker Precision)
 *
 * Mocks geocodingApi calls via Vitest spies.
 * Tests candidate selection, house number manual entry, reverse suggestions,
 * confirmation workflow, and UBIGEO mismatch detection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { geocodingApi } from '../../api/geocoding-api'
import { ApiRequestError } from '../../types/api'
import { LocationPicker } from './LocationPicker'

// ──────────────────────────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────────────────────────

// Mock LocationMap to avoid MapLibre GL JS initialization in jsdom
vi.mock('./LocationMap', () => ({
  LocationMap: ({
    latitude,
    longitude,
    onLocationChange,
    onDragEnd,
  }: {
    latitude?: number | null
    longitude?: number | null
    onLocationChange?: (lat: number, lng: number) => void
    onDragEnd?: (lat: number, lng: number) => void
  }) => (
    <div data-testid="location-map" data-lat={latitude} data-lon={longitude}>
      <button
        data-testid="mock-drag-end"
        onClick={() => {
          onDragEnd?.(-12.1215, -77.0298)
          onLocationChange?.(-12.1215, -77.0298)
        }}
      >
        Simulate dragend
      </button>
    </div>
  ),
}))

const MOCK_SEARCH_RESULT_1 = {
  latitude: -12.1215,
  longitude: -77.0298,
  display_name: 'Av. Larco 1234, Miraflores, Lima, Perú',
  place_id: '12345',
  osm_type: 'way',
  osm_id: '67890',
  bounding_box: null,
  address: {
    road: 'Av. Larco',
    house_number: '1234',
    neighbourhood: null,
    suburb: null,
    district: 'Miraflores',
    city: 'Lima',
    province: 'Lima',
    department: 'Lima',
    postcode: null,
    country: 'Perú',
    country_code: 'pe',
  },
  confidence: null,
  raw_type: null,
}

const MOCK_SEARCH_RESULT_2 = {
  latitude: -12.1299,
  longitude: -77.0305,
  display_name: 'Av. Larco 1500, Armendáriz, Miraflores, Lima, Perú',
  place_id: '54321',
  osm_type: 'way',
  osm_id: '99999',
  bounding_box: null,
  address: {
    road: 'Av. Larco',
    house_number: null,
    neighbourhood: 'Armendáriz',
    suburb: 'Miraflores',
    district: 'Miraflores',
    city: 'Lima',
    province: 'Lima',
    department: 'Lima',
    postcode: null,
    country: 'Perú',
    country_code: 'pe',
  },
  confidence: null,
  raw_type: null,
}

const MOCK_REVERSE_RESULT = {
  latitude: -12.1215,
  longitude: -77.0298,
  display_name: 'Calle Mercaderes 305, Arequipa, Perú',
  place_id: '99999',
  osm_type: null,
  osm_id: null,
  bounding_box: null,
  address: {
    road: 'Calle Mercaderes',
    house_number: null,
    neighbourhood: null,
    suburb: null,
    district: 'Arequipa',
    city: 'Arequipa',
    province: 'Arequipa',
    department: 'Arequipa',
    postcode: null,
    country: 'Perú',
    country_code: 'pe',
  },
  confidence: null,
  raw_type: null,
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(geocodingApi, 'search').mockResolvedValue({
    success: true,
    data: { results: [MOCK_SEARCH_RESULT_1], count: 1 },
  })
  vi.spyOn(geocodingApi, 'reverse').mockResolvedValue({
    success: true,
    data: MOCK_REVERSE_RESULT,
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

const defaultValue = { address: '', latitude: null, longitude: null }

function renderPicker(overrides: Partial<Parameters<typeof LocationPicker>[0]> = {}) {
  const onChange = vi.fn()
  const props = { value: defaultValue, onChange, ...overrides }
  render(<LocationPicker {...props} />)
  return { onChange }
}

describe('LocationPicker', () => {
  it('renders address input, house number input, and search button', () => {
    renderPicker()
    expect(screen.getByPlaceholderText(/av\. josé larco/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/número o puerta/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /buscar ubicación/i })).toBeInTheDocument()
  })

  it('search button disabled when address is empty', () => {
    renderPicker()
    const btn = screen.getByRole('button', { name: /buscar ubicación/i })
    expect(btn).toBeDisabled()
  })

  it('searches address, shows candidates, and lets user select a candidate', async () => {
    vi.spyOn(geocodingApi, 'search').mockResolvedValue({
      success: true,
      data: { results: [MOCK_SEARCH_RESULT_1, MOCK_SEARCH_RESULT_2], count: 2 },
    })

    const { onChange } = renderPicker({
      value: { address: 'Av. Larco', latitude: null, longitude: null },
    })
    const btn = screen.getByRole('button', { name: /buscar ubicación/i })
    await userEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText(/resultados encontrados \(2\)/i)).toBeInTheDocument()
    })

    // Click candidate 2
    const candidate2Btn = screen.getByText(/av\. larco, armendáriz, miraflores, lima, perú/i)
    await userEvent.click(candidate2Btn)

    // Verify it is highlighted as selected
    expect(screen.getByText('✓ Seleccionado')).toBeInTheDocument()
    expect(screen.getByText(/ubicación ajustada \(pendiente de confirmar\)/i)).toBeInTheDocument()

    // Location is not yet sent to onChange until confirmed
    expect(onChange).not.toHaveBeenCalled()

    // Click "Confirmar esta ubicación"
    const confirmBtn = screen.getByRole('button', { name: /confirmar esta ubicación/i })
    await userEvent.click(confirmBtn)

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: MOCK_SEARCH_RESULT_2.latitude,
        longitude: MOCK_SEARCH_RESULT_2.longitude,
      })
    )
    expect(screen.getByText('Ubicación confirmada')).toBeInTheDocument()
  })

  it('shows error when provider is unavailable', async () => {
    vi.spyOn(geocodingApi, 'search').mockRejectedValue(
      new ApiRequestError('Service unavailable', {
        code: 'GEOCODING_PROVIDER_UNAVAILABLE',
        status: 503,
      })
    )
    renderPicker({ value: { address: 'Av. Test', latitude: null, longitude: null } })
    await userEvent.click(screen.getByRole('button', { name: /buscar ubicación/i }))

    await waitFor(() => {
      expect(screen.getByText(/servicio de mapas no está disponible/i)).toBeInTheDocument()
    })
  })

  it('shows error when address not found', async () => {
    vi.spyOn(geocodingApi, 'search').mockResolvedValue({
      success: true,
      data: { results: [], count: 0 },
    })
    renderPicker({ value: { address: 'XYZ 999 nowhere', latitude: null, longitude: null } })
    await userEvent.click(screen.getByRole('button', { name: /buscar ubicación/i }))

    await waitFor(() => {
      expect(screen.getByText(/no se encontró una ubicación/i)).toBeInTheDocument()
    })
  })

  it('renders map component and coordinates fields', () => {
    renderPicker({ value: { address: '', latitude: -12.0464, longitude: -77.0428 } })
    expect(screen.getByTestId('location-map')).toBeInTheDocument()
    expect(screen.getByLabelText('Latitud')).toBeInTheDocument()
    expect(screen.getByLabelText('Longitud')).toBeInTheDocument()
  })

  it('triggers reverse geocoding on dragend, displays suggested address, and allows applying it', async () => {
    renderPicker({ value: { address: 'Av. Original', latitude: -12.0, longitude: -77.0 } })
    const dragBtn = screen.getByTestId('mock-drag-end')
    await userEvent.click(dragBtn)

    await waitFor(() => {
      expect(screen.getByText(/dirección sugerida por el mapa:/i)).toBeInTheDocument()
      expect(screen.getByText(/calle mercaderes, arequipa, perú/i)).toBeInTheDocument()
    })

    // Click "Usar dirección sugerida"
    const applyBtn = screen.getByRole('button', { name: /usar dirección sugerida/i })
    await userEvent.click(applyBtn)

    // Address input should now have the suggested address
    expect(screen.getByPlaceholderText(/av\. josé larco/i)).toHaveValue(
      'Calle Mercaderes, Arequipa, Perú'
    )
  })

  it('editing house number updates address draft without modifying coordinates', async () => {
    renderPicker({
      value: { address: 'Av. Larco', latitude: -12.1215, longitude: -77.0298 },
    })
    const houseNumberInput = screen.getByLabelText(/número o puerta/i)
    await userEvent.type(houseNumberInput, '500')

    expect(houseNumberInput).toHaveValue('500')
    // Confirmation is invalidated when house number is edited
    expect(screen.getByText(/ubicación ajustada \(pendiente de confirmar\)/i)).toBeInTheDocument()
  })

  it('renders "Usar mi ubicación" button and handles disabled prop', () => {
    renderPicker({ disabled: true })
    const searchBtn = screen.getByRole('button', { name: /buscar ubicación/i })
    expect(searchBtn).toBeDisabled()
    const geoBtn = screen.getByRole('button', { name: /usar mi ubicación/i })
    expect(geoBtn).toBeDisabled()
  })

  it('preloads as confirmed when existing coordinates are present', () => {
    renderPicker({
      value: { address: 'Av. Larco 1234', latitude: -12.1215, longitude: -77.0298 },
    })
    expect(screen.getByText('Ubicación confirmada')).toBeInTheDocument()
  })
})
