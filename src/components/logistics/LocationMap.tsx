/**
 * LocationMap — F005.4
 *
 * Reusable MapLibre GL JS map with:
 *  - Configurable center & zoom
 *  - Draggable marker
 *  - Click-to-reposition marker
 *  - Navigation controls
 *  - Required OSM attribution
 *  - onLocationChange callback (returns WGS84 [lat, lng])
 *
 * Style URL is sourced from VITE_MAP_STYLE_URL (env) or the prop.
 * Falls back to OpenStreetMap-compatible raster tiles.
 */


import { useEffect, useRef, useState } from 'react'
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl'
import { wgs84ToMapLibreLngLat, mapLibreLngLatToWgs84 } from '../../api/geocoding-api'

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface LocationMapProps {
  /** WGS84 latitude (-90 to 90) */
  latitude?: number | null
  /** WGS84 longitude (-180 to 180) */
  longitude?: number | null
  /** Zoom level (0-22), default 14 */
  zoom?: number
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
// Default tile style (OSM-compatible raster fallback)
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

const DEFAULT_CENTER_PERU: [number, number] = [-77.0428, -12.0464] // Lima as default center
const DEFAULT_ZOOM = 14

export function LocationMap({
  latitude,
  longitude,
  zoom = DEFAULT_ZOOM,
  onLocationChange,
  onDragEnd,
  interactive = true,
  className,
  styleUrl,
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<MapLibreMarker | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  const hasCoords = latitude != null && longitude != null

  // ── Initialize map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let cancelled = false

    async function initMap() {
      try {
        const { Map, Marker, NavigationControl } = await import('maplibre-gl')
        if (cancelled || !containerRef.current) return

        const center: [number, number] = hasCoords
          ? wgs84ToMapLibreLngLat(latitude!, longitude!)
          : DEFAULT_CENTER_PERU

        const style = resolveStyleUrl(styleUrl)

        const map = new Map({
          container: containerRef.current,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style: style as any,
          center,
          zoom: hasCoords ? zoom : 6, // Peru overview if no coords yet
          interactive,
          // attributionControl defaults to showing attribution; leave default (don't pass true)
        })

        map.addControl(new NavigationControl({ showCompass: false }), 'top-right')

        map.on('load', () => {
          if (!cancelled) setIsLoaded(true)
        })

        map.on('error', () => {
          if (!cancelled) setMapError('Error al cargar el mapa. Verifica la conexión.')
        })

        // ── Marker ──────────────────────────────────────────────────────────
        const marker = new Marker({ draggable: interactive, color: '#3b82f6' })
        if (hasCoords) {
          marker.setLngLat(wgs84ToMapLibreLngLat(latitude!, longitude!)).addTo(map)
        }

        marker.on('dragend', () => {
          const lngLat = marker.getLngLat()
          const [lat, lng] = mapLibreLngLatToWgs84(lngLat)
          onLocationChange?.(lat, lng)
          onDragEnd?.(lat, lng)
        })

        // ── Click to reposition ─────────────────────────────────────────────
        if (interactive) {
          map.on('click', (e: { lngLat: { lng: number; lat: number } }) => {
            const [lat, lng] = mapLibreLngLatToWgs84(e.lngLat)
            marker.setLngLat([e.lngLat.lng, e.lngLat.lat]).addTo(map)
            onLocationChange?.(lat, lng)
            onDragEnd?.(lat, lng)
          })
        }

        mapRef.current = map
        markerRef.current = marker
      } catch {
        if (!cancelled) setMapError('No se pudo inicializar el mapa.')
      }
    }

    void initMap()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally only on mount

  // ── Sync external lat/lon changes to marker & map center ───────────────────
  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return

    if (latitude != null && longitude != null) {
      const lngLat = wgs84ToMapLibreLngLat(latitude, longitude)
      marker.setLngLat(lngLat).addTo(map)
      map.flyTo({ center: lngLat, zoom: zoom ?? DEFAULT_ZOOM, duration: 600 })
    }
  }, [latitude, longitude, zoom])

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      markerRef.current?.remove()
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
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
