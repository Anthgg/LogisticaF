/**
 * Tests for LocationPicker component — F005.4
 *
 * Uses MSW to mock geocoding API calls.
 * Does NOT call real Nominatim or backend.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { LocationPicker } from './LocationPicker'

// ──────────────────────────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────────────────────────

// Mock LocationMap to avoid MapLibre GL JS initialization in jsdom
vi.mock('./LocationMap', () => ({
  LocationMap: ({ latitude, longitude, onLocationChange, onDragEnd }: {
    latitude?: number | null
    longitude?: number | null
    onLocationChange?: (lat: number, lng: number) => void
    onDragEnd?: (lat: number, lng: number) => void
  }) => (
    <div data-testid="location-map" data-lat={latitude} data-lon={longitude}>
      <button
        data-testid="mock-drag-end"
        onClick={() => { onDragEnd?.(-12.1215, -77.0298); onLocationChange?.(-12.1215, -77.0298) }}
      >
        Simulate dragend
      </button>
    </div>
  ),
}))

const MOCK_SEARCH_RESULT = {
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

const MOCK_REVERSE_RESULT = {
  latitude: -12.1215,
  longitude: -77.0298,
  display_name: 'Calle Uno 456, Miraflores, Lima, Perú',
  place_id: '99999',
  osm_type: null,
  osm_id: null,
  bounding_box: null,
  address: null,
  confidence: null,
  raw_type: null,
}

const server = setupServer(
  http.post('*/logistics/geocoding/search', () =>
    HttpResponse.json({
      success: true,
      data: { results: [MOCK_SEARCH_RESULT], count: 1 },
    }),
  ),
  http.post('*/logistics/geocoding/reverse', () =>
    HttpResponse.json({
      success: true,
      data: MOCK_REVERSE_RESULT,
    }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

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
  it('renders address input and search button', () => {
    renderPicker()
    expect(screen.getByPlaceholderText(/av\. industrial/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ubicar en mapa/i })).toBeInTheDocument()
  })

  it('search button disabled when address is empty', () => {
    renderPicker()
    const btn = screen.getByRole('button', { name: /ubicar en mapa/i })
    expect(btn).toBeDisabled()
  })

  it('calls onChange with result when search finds single result', async () => {
    const { onChange } = renderPicker({
      value: { address: 'Av. Larco 1234', latitude: null, longitude: null },
    })
    const btn = screen.getByRole('button', { name: /ubicar en mapa/i })
    await userEvent.click(btn)

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: MOCK_SEARCH_RESULT.latitude,
          longitude: MOCK_SEARCH_RESULT.longitude,
        }),
      )
    })
  })

  it('shows multiple candidates when search returns many results', async () => {
    server.use(
      http.post('*/logistics/geocoding/search', () =>
        HttpResponse.json({
          success: true,
          data: {
            results: [MOCK_SEARCH_RESULT, { ...MOCK_SEARCH_RESULT, place_id: '99', display_name: 'Otro Resultado' }],
            count: 2,
          },
        }),
      ),
    )
    renderPicker({ value: { address: 'Av. Larco', latitude: null, longitude: null } })
    await userEvent.click(screen.getByRole('button', { name: /ubicar en mapa/i }))

    await waitFor(() => {
      expect(screen.getByText('Resultados encontrados — selecciona el correcto')).toBeInTheDocument()
      expect(screen.getByText('Otro Resultado')).toBeInTheDocument()
    })
  })

  it('shows error when provider is unavailable', async () => {
    server.use(
      http.post('*/logistics/geocoding/search', () =>
        HttpResponse.json({ detail: 'Service unavailable' }, { status: 503 }),
      ),
    )
    renderPicker({ value: { address: 'Av. Test', latitude: null, longitude: null } })
    await userEvent.click(screen.getByRole('button', { name: /ubicar en mapa/i }))

    await waitFor(() => {
      expect(screen.getByText(/servicio de mapas no está disponible/i)).toBeInTheDocument()
    })
  })

  it('shows error when address not found', async () => {
    server.use(
      http.post('*/logistics/geocoding/search', () =>
        HttpResponse.json({ success: true, data: { results: [], count: 0 } }),
      ),
    )
    renderPicker({ value: { address: 'XYZ 999 nowhere', latitude: null, longitude: null } })
    await userEvent.click(screen.getByRole('button', { name: /ubicar en mapa/i }))

    await waitFor(() => {
      expect(screen.getByText(/no se encontró una ubicación/i)).toBeInTheDocument()
    })
  })

  it('renders map component', () => {
    renderPicker()
    expect(screen.getByTestId('location-map')).toBeInTheDocument()
  })

  it('triggers reverse geocoding on dragend and shows suggestion', async () => {
    renderPicker({ value: { address: '', latitude: -12.0, longitude: -77.0 } })
    const dragBtn = screen.getByTestId('mock-drag-end')
    await userEvent.click(dragBtn)

    await waitFor(() => {
      expect(screen.getByText(/dirección sugerida por el mapa/i)).toBeInTheDocument()
      expect(screen.getByText(MOCK_REVERSE_RESULT.display_name)).toBeInTheDocument()
    })
  })

  it('applies reverse address suggestion when user confirms', async () => {
    const { onChange } = renderPicker({ value: { address: '', latitude: -12.0, longitude: -77.0 } })
    await userEvent.click(screen.getByTestId('mock-drag-end'))

    await waitFor(() => screen.getByText('Usar esta dirección'))
    await userEvent.click(screen.getByText('Usar esta dirección'))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ address: MOCK_REVERSE_RESULT.display_name }),
    )
  })

  it('renders latitude and longitude fields', () => {
    renderPicker({ value: { address: '', latitude: -12.0464, longitude: -77.0428 } })
    expect(screen.getByLabelText('Latitud')).toBeInTheDocument()
    expect(screen.getByLabelText('Longitud')).toBeInTheDocument()
  })

  it('manual coordinate input updates on blur', async () => {
    const { onChange } = renderPicker()
    const latInput = screen.getByLabelText('Latitud')
    await userEvent.clear(latInput)
    await userEvent.type(latInput, '-12.0464')
    fireEvent.blur(latInput)

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: -12.0464 }),
    )
  })

  it('does not call onChange for invalid coordinate on blur', async () => {
    const { onChange } = renderPicker()
    const latInput = screen.getByLabelText('Latitud')
    await userEvent.clear(latInput)
    await userEvent.type(latInput, 'not-a-number')
    fireEvent.blur(latInput)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not call onChange for out-of-range latitude', async () => {
    const { onChange } = renderPicker()
    const latInput = screen.getByLabelText('Latitud')
    await userEvent.clear(latInput)
    await userEvent.type(latInput, '91')
    fireEvent.blur(latInput)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders "Usar mi ubicación" button', () => {
    renderPicker()
    expect(screen.getByText('Usar mi ubicación')).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    renderPicker({ disabled: true })
    const searchBtn = screen.getByRole('button', { name: /ubicar en mapa/i })
    expect(searchBtn).toBeDisabled()
    const geoBtn = screen.getByRole('button', { name: /usar mi ubicación/i })
    expect(geoBtn).toBeDisabled()
  })
})
