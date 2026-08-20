/**
 * LocationPicker — F005.4
 *
 * Reusable address + map widget that:
 *  - Shows address input and "Ubicar en mapa" button (no per-keystroke search)
 *  - Calls backend geocoding/search endpoint
 *  - Shows multiple candidate results when available
 *  - Shows interactive LocationMap with draggable marker
 *  - Shows manual coordinate inputs (editable for advanced users)
 *  - Runs optional reverse geocoding on dragend / click
 *  - Supports "Usar mi ubicación" (browser Geolocation API)
 *  - Falls back gracefully if geocoder is unavailable
 *
 * Props are generic — not coupled to Branch. Can be reused for HR, routes, etc.
 */

import { useCallback, useState } from 'react'
import { geocodingApi } from '../../api/geocoding-api'
import type { GeocodeLocationResultDTO } from '../../api/geocoding-api'
import { ApiRequestError } from '../../types/api'
import { Alert } from '../common/Alert'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { LocationMap } from './LocationMap'
import { getErrorMessage } from '../../utils/errors'

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface LocationValue {
  address: string
  latitude: number | null
  longitude: number | null
}

export interface LocationPickerProps {
  value: LocationValue
  onChange: (value: LocationValue) => void
  /** Current UBIGEO code used to enrich the geocoding query */
  ubigeoCode?: string | null
  disabled?: boolean
  /** Max candidates to show when search returns multiple results (default 5) */
  maxResults?: number
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function CoordinateDisplay({
  label,
  fieldId,
  rawValue,
  rawString,
  onRawChange,
  onCommit,
  disabled,
}: {
  label: string
  fieldId: string
  rawValue: string
  rawString: string
  onRawChange: (v: string) => void
  onCommit: () => void
  disabled?: boolean
}) {
  return (
    <div className="field">
      <label htmlFor={fieldId} className="field__label">
        {label}
      </label>
      <input
        id={fieldId}
        type="text"
        inputMode="decimal"
        className="field__input font-mono text-xs"
        value={rawString !== '' ? rawString : rawValue}
        onChange={(e) => onRawChange(e.target.value)}
        onBlur={onCommit}
        disabled={disabled}
        placeholder="—"
        aria-label={label}
      />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────────────────

export function LocationPicker({
  value,
  onChange,
  ubigeoCode,
  disabled = false,
  maxResults = 5,
}: LocationPickerProps) {
  const [isSearching, setIsSearching] = useState(false)
  const [isReversing, setIsReversing] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<GeocodeLocationResultDTO[]>([])
  const [reverseResult, setReverseResult] = useState<GeocodeLocationResultDTO | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)

  // Raw strings for manual coordinate inputs (allows partial typing)
  const [rawLat, setRawLat] = useState('')
  const [rawLon, setRawLon] = useState('')

  // ── Search (forward geocoding) ──────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const address = value.address.trim()
    if (!address) return

    setIsSearching(true)
    setSearchError(null)
    setCandidates([])
    setReverseResult(null)

    try {
      const res = await geocodingApi.search({
        address,
        ubigeo_code: ubigeoCode ?? null,
        limit: maxResults,
      })

      if (!res.success || res.data.results.length === 0) {
        setSearchError('No se encontró una ubicación para esta dirección.')
        return
      }

      if (res.data.results.length === 1) {
        // Auto-select single result
        selectCandidate(res.data.results[0])
      } else {
        setCandidates(res.data.results)
      }
    } catch (caught: unknown) {
      const isUnavailable =
        (caught instanceof ApiRequestError && caught.status >= 502 && caught.status <= 504)
      if (isUnavailable) {
        setSearchError(
          'El servicio de mapas no está disponible temporalmente. Puedes colocar el marcador manualmente.',
        )
      } else {
        setSearchError(getErrorMessage(caught))
      }
    } finally {
      setIsSearching(false)
    }
  }, [value.address, ubigeoCode, maxResults]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectCandidate = (candidate: GeocodeLocationResultDTO) => {
    onChange({
      ...value,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    })
    setCandidates([])
  }

  // ── Reverse geocoding (after drag or click) ─────────────────────────────────
  const handleDragEnd = useCallback(
    async (lat: number, lng: number) => {
      onChange({ ...value, latitude: lat, longitude: lng })
      setReverseResult(null)

      if (!lat || !lng) return
      setIsReversing(true)
      try {
        const res = await geocodingApi.reverse({ latitude: lat, longitude: lng })
        if (res.success && res.data) {
          setReverseResult(res.data)
        }
      } catch {
        // Reverse failure is non-fatal — user already has coordinates
      } finally {
        setIsReversing(false)
      }
    },
    [value, onChange],
  )

  const applyReverseAddress = () => {
    if (reverseResult) {
      onChange({ ...value, address: reverseResult.display_name })
      setReverseResult(null)
    }
  }

  // ── Manual coordinate commit ────────────────────────────────────────────────
  const commitLat = () => {
    const parsed = parseFloat(rawLat)
    if (!Number.isNaN(parsed) && parsed >= -90 && parsed <= 90) {
      onChange({ ...value, latitude: parsed })
    }
    setRawLat('')
  }

  const commitLon = () => {
    const parsed = parseFloat(rawLon)
    if (!Number.isNaN(parsed) && parsed >= -180 && parsed <= 180) {
      onChange({ ...value, longitude: parsed })
    }
    setRawLon('')
  }

  // ── Browser geolocation ─────────────────────────────────────────────────────
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Tu navegador no soporta geolocalización.')
      return
    }
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        onChange({ ...value, latitude: lat, longitude: lng })
        void handleDragEnd(lat, lng)
      },
      () => {
        setGeoError(
          'Permiso de ubicación denegado. Verifica la configuración de tu navegador.',
        )
      },
      { timeout: 8000, maximumAge: 30000 },
    )
  }

  const latDisplay =
    rawLat !== '' ? rawLat : value.latitude != null ? value.latitude.toFixed(7) : ''
  const lonDisplay =
    rawLon !== '' ? rawLon : value.longitude != null ? value.longitude.toFixed(7) : ''

  return (
    <div className="space-y-3">
      {/* ── Address input + search button ─────────────────────────────────── */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            label="Dirección"
            value={value.address}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSearch()
              }
            }}
            placeholder="Ej: Av. Industrial 1234, Parque Industrial"
            disabled={disabled || isSearching}
          />
        </div>
        <div className="flex flex-col gap-1 pb-0.5">
          <Button
            variant="secondary"
            size="small"
            disabled={disabled || isSearching || !value.address.trim()}
            onClick={() => void handleSearch()}
            className="whitespace-nowrap"
          >
            {isSearching ? (
              <span className="flex items-center gap-1.5">
                <span className="spinner-xs" />
                Buscando…
              </span>
            ) : (
              'Ubicar en mapa'
            )}
          </Button>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={disabled}
            className="text-[11px] text-blue-600 hover:underline disabled:text-slate-400 text-right"
          >
            Usar mi ubicación
          </button>
        </div>
      </div>

      {/* ── Errors ────────────────────────────────────────────────────────── */}
      {searchError && <Alert variant="error">{searchError}</Alert>}
      {geoError && <Alert variant="error">{geoError}</Alert>}

      {/* ── Multiple candidates ────────────────────────────────────────────── */}
      {candidates.length > 1 && (
        <div className="rounded-md border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 text-xs">
          <p className="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Resultados encontrados — selecciona el correcto
          </p>
          {candidates.map((c, idx) => (
            <button
              key={c.place_id ?? idx}
              type="button"
              onClick={() => selectCandidate(c)}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors"
            >
              <p className="font-medium text-slate-800 leading-snug">{c.display_name}</p>
              {c.address?.district && (
                <p className="text-slate-400 text-[11px] mt-0.5">
                  {[c.address.district, c.address.province, c.address.department]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Map ───────────────────────────────────────────────────────────── */}
      <div className="relative">
        <LocationMap
          latitude={value.latitude}
          longitude={value.longitude}
          onLocationChange={(lat, lng) => onChange({ ...value, latitude: lat, longitude: lng })}
          onDragEnd={(lat, lng) => void handleDragEnd(lat, lng)}
          interactive={!disabled}
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Arrastra el marcador o haz clic en el mapa para ajustar la ubicación.
        </p>
      </div>

      {/* ── Reverse geocode suggestion ─────────────────────────────────────── */}
      {(isReversing || reverseResult) && (
        <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800 flex items-start justify-between gap-2">
          {isReversing ? (
            <span className="flex items-center gap-1.5">
              <span className="spinner-xs" />
              Buscando dirección…
            </span>
          ) : (
            <>
              <div>
                <p className="font-medium">Dirección sugerida por el mapa</p>
                <p className="text-blue-700 mt-0.5">{reverseResult?.display_name}</p>
              </div>
              <button
                type="button"
                onClick={applyReverseAddress}
                className="text-blue-700 font-semibold hover:underline whitespace-nowrap"
              >
                Usar esta dirección
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Manual coordinates ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <CoordinateDisplay
          label="Latitud"
          fieldId="location-lat"
          rawValue={latDisplay}
          rawString={rawLat}
          onRawChange={setRawLat}
          onCommit={commitLat}
          disabled={disabled}
        />
        <CoordinateDisplay
          label="Longitud"
          fieldId="location-lon"
          rawValue={lonDisplay}
          rawString={rawLon}
          onRawChange={setRawLon}
          onCommit={commitLon}
          disabled={disabled}
        />
      </div>
      <p className="text-[11px] text-slate-400">
        Puedes editar las coordenadas manualmente. El marcador se actualizará al confirmar.
      </p>
    </div>
  )
}
