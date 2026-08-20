/**
 * LocationMap — F005.4 / F005.4.2 (Selected Location Marker & Popup)
 *
 * Reusable MapLibre GL JS map widget with:
 *  - Single persistent selected location marker (drop/pin shape, SVG, no system emoji)
 *  - Visual confirmation states (confirmed vs pending)
 *  - Interactive MapLibre Popup displaying human address, coordinates & status badge
 *  - Draggable pin with grab/grabbing cursor
 *  - Click-to-reposition with stopPropagation on marker click
 *  - Navigation controls & required OSM attribution
 *  - Smooth map centering on new selection or branch loading
 */

import { useEffect, useRef, useState } from 'react'
import type {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  Popup as MapLibrePopup,
} from 'maplibre-gl'
import { wgs84ToMapLibreLngLat, mapLibreLngLatToWgs84 } from '../../api/geocoding-api'

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface LocationMapProps {
  /** WGS84 latitude (-90 to 90) */
  latitude?: number | null
  /** WGS84 longitude (-180 to 180) */
  longitude?: number | null
  /** Zoom level (0-22), default 15 */
  zoom?: number
  /** Formatted human address to show in the marker popup */
  addressText?: string | null
  /** Whether the location is confirmed or pending */
  isConfirmed?: boolean
  /** Called when user moves the marker or clicks the map. Returns [lat, lng]. */
  onLocationChange?: (latitude: number, longitude: number) => void
  /** Called after dragend only (for reverse geocoding trigger). */
  onDragEnd?: (latitude: number, longitude: number) => void
  /** Allow or disable user interaction */
  interactive?: boolean
  /** CSS class for the container div */
  className?: string
  /** MapLibre style URL — defaults to VITE_MAP_STYLE_URL or OSM raster tiles */
  styleUrl?: string
}

// ──────────────────────────────────────────────────────────────────────────────
// HTML Escaping Helper (Safe Popup Content)
// ──────────────────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ──────────────────────────────────────────────────────────────────────────────
// Custom SVG Pin Generator
// ──────────────────────────────────────────────────────────────────────────────

function createCustomPinElement(isConfirmed: boolean, interactive: boolean): HTMLElement {
  const el = document.createElement('div')
  el.className = 'location-selected-pin'
  el.setAttribute('role', 'button')
  el.setAttribute('aria-label', 'Ubicación seleccionada')
  el.setAttribute('tabindex', '0')
  el.setAttribute('data-state', isConfirmed ? 'confirmed' : 'pending')

  const primaryColor = isConfirmed ? '#059669' : '#2563eb'
  const strokeColor = isConfirmed ? '#047857' : '#1d4ed8'

  el.style.width = '32px'
  el.style.height = '38px'
  el.style.cursor = interactive ? 'grab' : 'default'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.userSelect = 'none'
  el.style.outline = 'none'
  el.style.pointerEvents = 'auto'
  el.style.zIndex = '10'

  el.innerHTML = `
    <svg width="32" height="38" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:block;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.35));pointer-events:none;">
      <path d="M16 0C7.16344 0 0 7.16344 0 16C0 26.5 14.2 36.8 14.8 37.3C15.15 37.55 15.57 37.7 16 37.7C16.43 37.7 16.85 37.55 17.2 37.3C17.8 36.8 32 26.5 32 16C32 7.16344 24.8366 0 16 0Z"
            fill="${primaryColor}"
            stroke="${strokeColor}"
            stroke-width="1.5"/>
      <circle cx="16" cy="14" r="6" fill="#ffffff"/>
      <circle cx="16" cy="14" r="3.5" fill="${primaryColor}"/>
    </svg>
  `

  return el
}

function updatePinElementState(el: HTMLElement, isConfirmed: boolean) {
  el.setAttribute('data-state', isConfirmed ? 'confirmed' : 'pending')
  const primaryColor = isConfirmed ? '#059669' : '#2563eb'
  const strokeColor = isConfirmed ? '#047857' : '#1d4ed8'

  const path = el.querySelector('path')
  if (path) {
    path.setAttribute('fill', primaryColor)
    path.setAttribute('stroke', strokeColor)
  }
  const innerDot = el.querySelectorAll('circle')[1]
  if (innerDot) {
    innerDot.setAttribute('fill', primaryColor)
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Popup Content Builder
// ──────────────────────────────────────────────────────────────────────────────

function buildPopupHtml(
  addressText: string | null | undefined,
  latitude: number,
  longitude: number,
  isConfirmed: boolean
): string {
  const address = escapeHtml((addressText || '').trim() || 'Punto fijado en mapa')
  const latStr = latitude.toFixed(6)
  const lonStr = longitude.toFixed(6)

  const statusBadge = isConfirmed
    ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;padding:2px 7px;border-radius:4px;"><span style="width:6px;height:6px;border-radius:50%;background:#10b981;"></span>Ubicación confirmada</span>`
    : `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#b45309;background:#fffbeb;border:1px solid #fde68a;padding:2px 7px;border-radius:4px;"><span style="width:6px;height:6px;border-radius:50%;background:#f59e0b;"></span>Pendiente de confirmar</span>`

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#1e293b;padding:2px;min-width:190px;max-width:260px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:3px;">
        📍 Ubicación seleccionada
      </div>
      <div style="font-weight:600;font-size:12px;line-height:1.35;margin-bottom:6px;color:#0f172a;">
        ${address}
      </div>
      <div style="font-family:monospace;font-size:11px;color:#64748b;margin-bottom:8px;background:#f8fafc;padding:3px 6px;border-radius:4px;border:1px solid #e2e8f0;">
        Lat: ${latStr}<br/>Lng: ${lonStr}
      </div>
      <div>
        ${statusBadge}
      </div>
    </div>
  `
}

// ──────────────────────────────────────────────────────────────────────────────
// Default Tile Style
// ──────────────────────────────────────────────────────────────────────────────

function getDefaultStyleUrl(): object {
  return {
    version: 8,
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'osm-tiles',
        type: 'raster',
        source: 'osm-tiles',
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  }
}

function resolveStyleUrl(propStyleUrl?: string): string | object {
  if (propStyleUrl) return propStyleUrl
  const envUrl = import.meta.env.VITE_MAP_STYLE_URL as string | undefined
  if (envUrl) return envUrl
  return getDefaultStyleUrl()
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_CENTER_PERU: [number, number] = [-77.0428, -12.0464] // Lima
const DEFAULT_ZOOM = 15

export function LocationMap({
  latitude,
  longitude,
  zoom = DEFAULT_ZOOM,
  addressText,
  isConfirmed = false,
  onLocationChange,
  onDragEnd,
  interactive = true,
  className,
  styleUrl,
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<MapLibreMarker | null>(null)
  const popupRef = useRef<MapLibrePopup | null>(null)
  const pinElementRef = useRef<HTMLElement | null>(null)

  const propsRef = useRef({ latitude, longitude, zoom, addressText, isConfirmed })
  propsRef.current = { latitude, longitude, zoom, addressText, isConfirmed }

  const [mapError, setMapError] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // ── Initialize Map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let cancelled = false

    async function initMap() {
      try {
        const { Map, Marker, Popup, NavigationControl } = await import('maplibre-gl')
        if (cancelled || !containerRef.current) return

        const curProps = propsRef.current
        const initialCoords = curProps.latitude != null && curProps.longitude != null
        const center: [number, number] = initialCoords
          ? wgs84ToMapLibreLngLat(curProps.latitude!, curProps.longitude!)
          : DEFAULT_CENTER_PERU

        const style = resolveStyleUrl(styleUrl)

        const map = new Map({
          container: containerRef.current,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style: style as any,
          center,
          zoom: initialCoords ? (curProps.zoom ?? zoom) : 6,
          interactive,
        })

        map.addControl(new NavigationControl({ showCompass: false }), 'top-right')

        map.on('load', () => {
          if (!cancelled) {
            setIsLoaded(true)
            map.resize()
          }
        })

        map.on('error', () => {
          if (!cancelled) setMapError('Error al cargar el mapa. Verifica la conexión.')
        })

        // ── Custom Marker and Popup ─────────────────────────────────────────
        const pinEl = createCustomPinElement(curProps.isConfirmed ?? false, interactive)
        pinElementRef.current = pinEl

        const popup = new Popup({
          offset: [0, -38],
          closeButton: true,
          closeOnClick: false,
          className: 'location-marker-popup',
        })
        popupRef.current = popup

        const marker = new Marker({
          element: pinEl,
          draggable: interactive,
          anchor: 'bottom',
        })

        if (initialCoords) {
          const lngLat = wgs84ToMapLibreLngLat(curProps.latitude!, curProps.longitude!)
          marker.setLngLat(lngLat)
          popup.setHTML(buildPopupHtml(curProps.addressText, curProps.latitude!, curProps.longitude!, curProps.isConfirmed ?? false))
          marker.setPopup(popup)
          marker.addTo(map)
        }

        // ── Prevent Marker Click from bubbling to Map Click ──────────────────
        pinEl.addEventListener('click', (e) => {
          e.stopPropagation()
          marker.togglePopup()
        })

        pinEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            marker.togglePopup()
          }
        })

        // ── Drag Handlers ───────────────────────────────────────────────────
        marker.on('dragstart', () => {
          pinEl.style.cursor = 'grabbing'
        })

        marker.on('dragend', () => {
          pinEl.style.cursor = interactive ? 'grab' : 'default'
          const lngLat = marker.getLngLat()
          const [lat, lng] = mapLibreLngLatToWgs84(lngLat)
          onLocationChange?.(lat, lng)
          onDragEnd?.(lat, lng)
        })

        // ── Map Click to Position Marker ────────────────────────────────────
        if (interactive) {
          map.on('click', (e: { lngLat: { lng: number; lat: number } }) => {
            const [lat, lng] = mapLibreLngLatToWgs84(e.lngLat)
            marker.setLngLat([e.lngLat.lng, e.lngLat.lat])
            if (popupRef.current) {
              popupRef.current.setHTML(buildPopupHtml(propsRef.current.addressText, lat, lng, false))
              marker.setPopup(popupRef.current)
            }
            marker.addTo(map)
            onLocationChange?.(lat, lng)
            onDragEnd?.(lat, lng)
          })
        }

        mapRef.current = map
        markerRef.current = marker

        // Handle case where coords arrived while initMap was in flight
        if (!initialCoords && propsRef.current.latitude != null && propsRef.current.longitude != null) {
          const lat = propsRef.current.latitude
          const lon = propsRef.current.longitude
          const lngLat = wgs84ToMapLibreLngLat(lat, lon)
          marker.setLngLat(lngLat)
          popup.setHTML(buildPopupHtml(propsRef.current.addressText, lat, lon, propsRef.current.isConfirmed ?? false))
          marker.setPopup(popup)
          marker.addTo(map)
          map.flyTo({ center: lngLat, zoom: propsRef.current.zoom ?? DEFAULT_ZOOM, duration: 500 })
        }
      } catch {
        if (!cancelled) setMapError('No se pudo inicializar el mapa.')
      }
    }

    void initMap()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Mount only

  // ── Sync Marker, Popup, and Center with Props ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    const popup = popupRef.current
    const pinEl = pinElementRef.current

    if (pinEl) {
      updatePinElementState(pinEl, isConfirmed)
    }

    if (!map || !marker) return

    if (latitude != null && longitude != null) {
      const lngLat = wgs84ToMapLibreLngLat(latitude, longitude)
      marker.setLngLat(lngLat)

      if (popup) {
        popup.setHTML(buildPopupHtml(addressText, latitude, longitude, isConfirmed))
        marker.setPopup(popup)
      }

      // Add to map if not already present
      marker.addTo(map)

      // Center map smoothly around the marker
      map.flyTo({ center: lngLat, zoom: zoom ?? DEFAULT_ZOOM, duration: 500 })
      map.resize()
    } else {
      // Remove marker if coordinates are cleared
      marker.remove()
      popup?.remove()
    }
  }, [latitude, longitude, zoom, addressText, isConfirmed])

  // ── Cleanup on Unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      popupRef.current?.remove()
      markerRef.current?.remove()
      mapRef.current?.remove()
      popupRef.current = null
      markerRef.current = null
      mapRef.current = null
      pinElementRef.current = null
    }
  }, [])

  return (
    <div className={className ?? 'relative w-full'}>
      {/* Map container */}
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden"
        style={{ height: 340, minHeight: 260, maxHeight: 420 }}
        aria-label="Mapa interactivo de ubicación"
      />

      {/* Loading overlay */}
      {!isLoaded && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg text-xs text-slate-500">
          <span className="spinner mr-2" />
          Cargando mapa…
        </div>
      )}

      {/* Error overlay */}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg text-xs text-slate-500 text-center p-4">
          <p>
            {mapError}
            <br />
            <span className="text-slate-400">
              Puedes colocar el marcador manualmente usando las coordenadas.
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
