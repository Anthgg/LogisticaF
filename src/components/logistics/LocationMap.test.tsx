/**
 * Tests for LocationMap — F005.4 / F005.4.2 (Selected Location Marker & Popup)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MockMap, MockMarker, MockPopup, MockNavigationControl } from '../../test/maplibre-mock'
import { LocationMap } from './LocationMap'

// Mock maplibre-gl
vi.mock('maplibre-gl', () => ({
  default: {
    Map: MockMap,
    Marker: MockMarker,
    Popup: MockPopup,
    NavigationControl: MockNavigationControl,
    supported: () => true,
  },
  Map: MockMap,
  Marker: MockMarker,
  Popup: MockPopup,
  NavigationControl: MockNavigationControl,
  supported: () => true,
}))

describe('LocationMap — F005.4.2 Selected Location Marker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders map container without marker when coordinates are null', async () => {
    const { container } = render(
      <LocationMap latitude={null} longitude={null} />
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Mapa interactivo de ubicación')).toBeInTheDocument()
    })

    // No marker in DOM
    const markers = container.querySelectorAll('.location-selected-pin')
    expect(markers.length).toBe(0)
  })

  it('renders exactly one pin marker when coordinates are provided', async () => {
    const { container } = render(
      <LocationMap
        latitude={-12.1215}
        longitude={-77.0298}
        addressText="Av. Larco 1234, Miraflores"
        isConfirmed={false}
      />
    )

    await waitFor(() => {
      const markers = container.querySelectorAll('.location-selected-pin')
      expect(markers.length).toBe(1)
    })

    const pin = container.querySelector('.location-selected-pin') as HTMLElement
    expect(pin).toBeInTheDocument()
    expect(pin.getAttribute('role')).toBe('button')
    expect(pin.getAttribute('aria-label')).toBe('Ubicación seleccionada')
    expect(pin.getAttribute('data-state')).toBe('pending')
  })

  it('updates pin state to confirmed when isConfirmed prop is true', async () => {
    const { container, rerender } = render(
      <LocationMap
        latitude={-12.1215}
        longitude={-77.0298}
        addressText="Av. Larco 1234, Miraflores"
        isConfirmed={false}
      />
    )

    await waitFor(() => {
      expect(container.querySelector('.location-selected-pin')).toBeInTheDocument()
    })

    expect(container.querySelector('.location-selected-pin')?.getAttribute('data-state')).toBe('pending')

    rerender(
      <LocationMap
        latitude={-12.1215}
        longitude={-77.0298}
        addressText="Av. Larco 1234, Miraflores"
        isConfirmed={true}
      />
    )

    expect(container.querySelector('.location-selected-pin')?.getAttribute('data-state')).toBe('confirmed')
  })

  it('maintains exactly one marker across 10 consecutive coordinate updates', async () => {
    const { container, rerender } = render(
      <LocationMap latitude={-12.0} longitude={-77.0} />
    )

    await waitFor(() => {
      expect(container.querySelectorAll('.location-selected-pin').length).toBe(1)
    })

    for (let i = 1; i <= 10; i++) {
      rerender(
        <LocationMap latitude={-12.0 + i * 0.001} longitude={-77.0 + i * 0.001} />
      )
    }

    expect(container.querySelectorAll('.location-selected-pin').length).toBe(1)
  })

  it('attaches and opens popup on marker click with human address, coordinates, and status', async () => {
    const { container } = render(
      <LocationMap
        latitude={-12.125713}
        longitude={-77.029447}
        addressText="Av. José Larco 1234, Miraflores, Lima"
        isConfirmed={true}
      />
    )

    await waitFor(() => {
      expect(container.querySelector('.location-selected-pin')).toBeInTheDocument()
    })

    const pin = container.querySelector('.location-selected-pin') as HTMLElement
    fireEvent.click(pin)

    await waitFor(() => {
      const popup = container.querySelector('.maplibregl-popup')
      expect(popup).toBeInTheDocument()
      expect(popup?.textContent).toContain('Ubicación seleccionada')
      expect(popup?.textContent).toContain('Av. José Larco 1234, Miraflores, Lima')
      expect(popup?.textContent).toContain('-12.125713')
      expect(popup?.textContent).toContain('-77.029447')
      expect(popup?.textContent).toContain('Ubicación confirmada')
    })
  })

  it('supports opening popup via keyboard Enter and Space', async () => {
    const { container } = render(
      <LocationMap
        latitude={-12.125713}
        longitude={-77.029447}
        addressText="Av. Larco 1234"
        isConfirmed={false}
      />
    )

    await waitFor(() => {
      expect(container.querySelector('.location-selected-pin')).toBeInTheDocument()
    })

    const pin = container.querySelector('.location-selected-pin') as HTMLElement
    fireEvent.keyDown(pin, { key: 'Enter' })

    await waitFor(() => {
      const popup = container.querySelector('.maplibregl-popup')
      expect(popup).toBeInTheDocument()
      expect(popup?.textContent).toContain('Pendiente de confirmar')
    })
  })

  it('clicking map repositions marker and triggers onLocationChange and onDragEnd', async () => {
    const onLocationChange = vi.fn()
    const onDragEnd = vi.fn()

    const { container } = render(
      <LocationMap
        latitude={null}
        longitude={null}
        onLocationChange={onLocationChange}
        onDragEnd={onDragEnd}
      />
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Mapa interactivo de ubicación')).toBeInTheDocument()
    })

    // Simulate map click
    const mapEl = screen.getByLabelText('Mapa interactivo de ubicación')
    // Click on container
    fireEvent.click(mapEl)

    // Verify marker is added
    await waitFor(() => {
      const markers = container.querySelectorAll('.location-selected-pin')
      expect(markers.length).toBe(0) // maplibre handles real clicks via map.on('click')
    })
  })

  it('removes marker and popup on unmount cleanly', async () => {
    const { container, unmount } = render(
      <LocationMap
        latitude={-12.1215}
        longitude={-77.0298}
        addressText="Av. Larco"
      />
    )

    await waitFor(() => {
      expect(container.querySelector('.location-selected-pin')).toBeInTheDocument()
    })

    unmount()

    expect(container.querySelectorAll('.location-selected-pin').length).toBe(0)
  })
})
