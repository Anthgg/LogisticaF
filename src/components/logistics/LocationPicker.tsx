/**
 * LocationPicker — F005.4 / F005.4.1 (Location Picker Precision)
 *
 * Exact map selection, structured human address builder, house number fallback,
 * non-destructive reverse geocoding suggestions, UBIGEO mismatch validation,
 * and explicit location confirmation workflow before updating the parent Branch form.
 */

import { useCallback, useEffect, useId, useState } from 'react'
import {
  buildHumanAddress,
  geocodingApi,
  type GeocodeAddressDTO,
  type GeocodeLocationResultDTO,
} from '../../api/geocoding-api'
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
  /** Height of the editable map in pixels. */
  mapHeight?: number
  /** Viewport center before the user selects a custom point. */
  initialCenter?: { latitude: number; longitude: number } | null
}

type LocationSource = 'geocoding' | 'map' | 'manual' | 'initial'

// ──────────────────────────────────────────────────────────────────────────────
// Coordinate Display Input Helper
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
  rawString: string | null
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
        value={rawString ?? rawValue}
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
  mapHeight = 340,
  initialCenter,
}: LocationPickerProps) {
  const houseNumberInputId = useId()

  // Coordinate and address state (draft vs confirmed)
  const [tempLat, setTempLat] = useState<number | null>(value.latitude)
  const [tempLon, setTempLon] = useState<number | null>(value.longitude)
  const [addressDraft, setAddressDraft] = useState<string>(value.address)
  const [houseNumber, setHouseNumber] = useState<string>('')
  const [addressComponents, setAddressComponents] = useState<GeocodeAddressDTO | null>(null)

  // Status & confirmation
  const [isConfirmed, setIsConfirmed] = useState<boolean>(
    value.latitude != null && value.longitude != null
  )
  const [, setSource] = useState<LocationSource>(
    value.latitude != null && value.longitude != null ? 'initial' : 'manual'
  )

  // Search & Candidates
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<GeocodeLocationResultDTO[]>([])
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  // Reverse Geocode Suggestion
  const [isReversing, setIsReversing] = useState(false)
  const [reverseResult, setReverseResult] = useState<GeocodeLocationResultDTO | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [ubigeoMismatch, setUbigeoMismatch] = useState<string | null>(null)

  // Raw strings for manual coordinate inputs
  // `null` means "show the committed coordinate". An empty string means the
  // user explicitly cleared the input, which must remain visually empty while
  // editing instead of snapping back to the previous value.
  const [rawLat, setRawLat] = useState<string | null>(null)
  const [rawLon, setRawLon] = useState<string | null>(null)

  // Sync with value prop if value changes from outside (e.g. form reset or editing another branch)
  useEffect(() => {
    setTempLat(value.latitude)
    setTempLon(value.longitude)
    setAddressDraft(value.address)
    setIsConfirmed(value.latitude != null && value.longitude != null)
    setRawLat(null)
    setRawLon(null)
  }, [value.address, value.latitude, value.longitude])

  // ── Search (forward geocoding) ──────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const query = addressDraft.trim()
    if (!query) return

    setIsSearching(true)
    setSearchError(null)
    setCandidates([])
    setSelectedCandidateId(null)
    setReverseResult(null)
    setUbigeoMismatch(null)

    try {
      const res = await geocodingApi.search({
        address: query,
        ubigeo_code: ubigeoCode ?? null,
        limit: maxResults,
      })

      if (!res.success || res.data.results.length === 0) {
        setSearchError('No se encontró una ubicación para esta dirección.')
        return
      }

      setCandidates(res.data.results)
      if (res.data.results.length === 1) {
        // Auto-select candidate if only 1 result, but require user confirmation
        selectCandidate(res.data.results[0])
      }
    } catch (caught: unknown) {
      const isUnavailable =
        caught instanceof ApiRequestError &&
        caught.status !== null &&
        caught.status >= 502 &&
        caught.status <= 504
      if (isUnavailable) {
        setSearchError(
          'El servicio de mapas no está disponible temporalmente. Puedes colocar el marcador manualmente.'
        )
      } else {
        setSearchError(getErrorMessage(caught))
      }
    } finally {
      setIsSearching(false)
    }
  }, [addressDraft, ubigeoCode, maxResults]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Candidate Selection ─────────────────────────────────────────────────────
  const selectCandidate = (candidate: GeocodeLocationResultDTO) => {
    const candidateId = candidate.place_id ?? `${candidate.latitude}_${candidate.longitude}`
    setSelectedCandidateId(candidateId)
    setTempLat(candidate.latitude)
    setTempLon(candidate.longitude)
    setSource('geocoding')
    setIsConfirmed(false) // User must click "Confirmar ubicación"

    // Extract address components and house number
    setAddressComponents(candidate.address ?? null)
    const providerNum = candidate.address?.house_number ?? ''
    const currentNum = providerNum || houseNumber
    if (providerNum) {
      setHouseNumber(providerNum)
    }

    const humanAddress = buildHumanAddress(
      candidate.address,
      candidate.display_name,
      currentNum
    )
    setAddressDraft(humanAddress)
  }

  // ── Reverse Geocoding (on map click or marker dragend) ──────────────────────
  const handleMapLocationChange = useCallback(
    async (lat: number, lng: number) => {
      setTempLat(lat)
      setTempLon(lng)
      setSource('map')
      setIsConfirmed(false) // Invalidate confirmation whenever pin moves
      setSelectedCandidateId(null)
      setReverseResult(null)
      setUbigeoMismatch(null)

      if (!lat || !lng) return
      setIsReversing(true)
      try {
        const res = await geocodingApi.reverse({ latitude: lat, longitude: lng })
        if (res.success && res.data) {
          setReverseResult(res.data)
          setAddressComponents(res.data.address ?? null)

          if (res.data.address?.house_number) {
            setHouseNumber(res.data.address.house_number)
          }

          // Check if reverse result district differs significantly from selected UBIGEO
          if (ubigeoCode && res.data.address?.district) {
            const district = res.data.address.district
            if (
              addressDraft &&
              !addressDraft.toLowerCase().includes(district.toLowerCase())
            ) {
              setUbigeoMismatch(
                `El punto seleccionado parece ubicarse en el distrito de ${district}.`
              )
            }
          }
        }
      } catch {
        // Reverse failure is non-fatal
      } finally {
        setIsReversing(false)
      }
    },
    [ubigeoCode, addressDraft]
  )

  // ── Apply Suggested Reverse Address ─────────────────────────────────────────
  const applyReverseAddress = () => {
    if (reverseResult) {
      const human = buildHumanAddress(
        reverseResult.address,
        reverseResult.display_name,
        houseNumber
      )
      setAddressDraft(human)
      setReverseResult(null)
    }
  }

  // ── House Number Manual Edit ────────────────────────────────────────────────
  const handleHouseNumberChange = (newNum: string) => {
    setHouseNumber(newNum)
    setIsConfirmed(false)

    // Reconstruct human address with updated house number without changing lat/lon
    if (addressComponents) {
      const updated = buildHumanAddress(addressComponents, addressDraft, newNum)
      setAddressDraft(updated)
    }
  }

  // ── Manual Coordinate Commit ────────────────────────────────────────────────
  const commitLat = () => {
    if (rawLat == null) return
    const parsed = parseFloat(rawLat)
    if (!Number.isNaN(parsed) && parsed >= -90 && parsed <= 90) {
      setTempLat(parsed)
      setIsConfirmed(false)
      setSource('manual')
      void handleMapLocationChange(parsed, tempLon ?? -77.0428)
    }
    setRawLat(null)
  }

  const commitLon = () => {
    if (rawLon == null) return
    const parsed = parseFloat(rawLon)
    if (!Number.isNaN(parsed) && parsed >= -180 && parsed <= 180) {
      setTempLon(parsed)
      setIsConfirmed(false)
      setSource('manual')
      void handleMapLocationChange(tempLat ?? -12.0464, parsed)
    }
    setRawLon(null)
  }

  // ── Confirm Location Workflow ───────────────────────────────────────────────
  const handleConfirmLocation = () => {
    if (tempLat == null || tempLon == null) return

    setIsConfirmed(true)
    onChange({
      address: addressDraft.trim(),
      latitude: tempLat,
      longitude: tempLon,
    })
  }

  // ── Browser Geolocation ─────────────────────────────────────────────────────
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
        setTempLat(lat)
        setTempLon(lng)
        setIsConfirmed(false)
        void handleMapLocationChange(lat, lng)
      },
      () => {
        setGeoError(
          'Permiso de ubicación denegado. Verifica la configuración de tu navegador.'
        )
      },
      { timeout: 8000, maximumAge: 30000 }
    )
  }

  const latDisplay = tempLat != null ? tempLat.toFixed(7) : ''
  const lonDisplay = tempLon != null ? tempLon.toFixed(7) : ''

  return (
    <div className="space-y-3">
      {/* ── Address input + House number + search button ─────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
        <div className="md:col-span-8">
          <Input
            label="Dirección"
            value={addressDraft}
            onChange={(e) => {
              setAddressDraft(e.target.value)
              setIsConfirmed(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSearch()
              }
            }}
            placeholder="Ej: Av. José Larco, Miraflores"
            disabled={disabled || isSearching}
          />
        </div>

        <div className="md:col-span-4 flex gap-2 items-end">
          <div className="w-24">
            <label htmlFor={houseNumberInputId} className="field__label">
              N° / Puerta
            </label>
            <input
              id={houseNumberInputId}
              type="text"
              className="field__input text-xs"
              placeholder="1234"
              value={houseNumber}
              onChange={(e) => handleHouseNumberChange(e.target.value)}
              disabled={disabled || isSearching}
              aria-label="Número o puerta"
            />
          </div>

          <div className="flex-1 flex flex-col gap-1 pb-0.5">
            <Button
              variant="secondary"
              size="small"
              disabled={disabled || isSearching || !addressDraft.trim()}
              onClick={() => void handleSearch()}
              className="whitespace-nowrap w-full"
            >
              {isSearching ? (
                <span className="flex items-center justify-center gap-1.5">
                  <span className="spinner-xs" />
                  Buscando…
                </span>
              ) : (
                'Buscar ubicación'
              )}
            </Button>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={disabled}
              className="text-[11px] text-blue-600 hover:underline disabled:text-slate-400 text-right pr-1"
            >
              Usar mi ubicación
            </button>
          </div>
        </div>
      </div>

      {/* ── Errors & Mismatches ────────────────────────────────────────────── */}
      {searchError && <Alert variant="error">{searchError}</Alert>}
      {geoError && <Alert variant="error">{geoError}</Alert>}
      {ubigeoMismatch && <Alert variant="warning">{ubigeoMismatch}</Alert>}

      {/* ── Candidate Results (Selectable cards) ───────────────────────────── */}
      {candidates.length > 0 && (
        <div
          className="rounded-md border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 text-xs overflow-hidden"
          role="region"
          aria-label="Resultados de búsqueda de ubicación"
        >
          <div className="px-3 py-1.5 bg-slate-50 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
              Resultados encontrados ({candidates.length}) — selecciona el correcto
            </span>
          </div>
          {candidates.map((c, idx) => {
            const candidateId = c.place_id ?? `${c.latitude}_${c.longitude}`
            const isSelected = selectedCandidateId === candidateId
            const humanFormatted = buildHumanAddress(c.address, c.display_name, houseNumber)

            return (
              <button
                key={c.place_id ?? idx}
                type="button"
                onClick={() => selectCandidate(c)}
                aria-pressed={isSelected}
                className={`w-full text-left px-3 py-2 transition-colors flex items-start justify-between gap-2 ${
                  isSelected
                    ? 'bg-blue-50/80 border-l-4 border-blue-600 pl-2'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <p className="font-medium text-slate-800 leading-snug">
                    {humanFormatted}
                  </p>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {c.display_name}
                  </p>
                </div>
                {isSelected ? (
                  <span className="text-blue-600 font-semibold text-[11px] whitespace-nowrap pt-0.5">
                    ✓ Seleccionado
                  </span>
                ) : (
                  <span className="text-slate-400 text-[11px] whitespace-nowrap pt-0.5">
                    Seleccionar
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Map ───────────────────────────────────────────────────────────── */}
      <div className="relative">
        <LocationMap
          latitude={tempLat}
          longitude={tempLon}
          fallbackLatitude={initialCenter?.latitude}
          fallbackLongitude={initialCenter?.longitude}
          addressText={addressDraft}
          isConfirmed={isConfirmed}
          onLocationChange={(lat, lng) => {
            setTempLat(lat)
            setTempLon(lng)
            setIsConfirmed(false)
          }}
          onDragEnd={(lat, lng) => void handleMapLocationChange(lat, lng)}
          interactive={!disabled}
          height={mapHeight}
        />
        <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400 px-0.5">
          <span>Arrastra el marcador o haz clic en el mapa para ajustar la posición exacta.</span>
          {tempLat != null && tempLon != null && (
            <span className="font-mono text-slate-500">
              [{tempLat.toFixed(5)}, {tempLon.toFixed(5)}]
            </span>
          )}
        </div>
      </div>

      {/* ── Reverse geocode suggestion banner ──────────────────────────────── */}
      {(isReversing || reverseResult) && (
        <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800 flex items-start justify-between gap-2">
          {isReversing ? (
            <span className="flex items-center gap-1.5">
              <span className="spinner-xs" />
              Obteniendo dirección del punto…
            </span>
          ) : (
            <>
              <div>
                <p className="font-medium">Dirección sugerida por el mapa:</p>
                <p className="text-blue-700 mt-0.5">
                  {buildHumanAddress(
                    reverseResult?.address,
                    reverseResult?.display_name,
                    houseNumber
                  )}
                </p>
                {!reverseResult?.address?.house_number && (
                  <p className="text-[11px] text-blue-600/80 mt-0.5">
                    El mapa no encontró un número exacto. Puedes ingresarlo en el campo &quot;N° / Puerta&quot;.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={applyReverseAddress}
                className="text-blue-700 font-semibold hover:underline whitespace-nowrap self-center bg-blue-100/60 px-2 py-1 rounded"
              >
                Usar dirección sugerida
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Manual coordinates inputs ──────────────────────────────────────── */}
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

      {/* ── Explicit Location Confirmation Banner / Button ─────────────────── */}
      <div className="pt-1 flex items-center justify-between border-t border-slate-100 gap-3">
        <div>
          {isConfirmed ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Ubicación confirmada
            </span>
          ) : tempLat != null && tempLon != null ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Ubicación ajustada (pendiente de confirmar)
            </span>
          ) : (
            <span className="text-xs text-slate-400">
              Busca una dirección o haz clic en el mapa para fijar la sede.
            </span>
          )}
        </div>

        <Button
          type="button"
          variant={isConfirmed ? 'secondary' : 'primary'}
          size="small"
          disabled={disabled || tempLat == null || tempLon == null}
          onClick={handleConfirmLocation}
        >
          {isConfirmed ? 'Reconfirmar ubicación' : 'Confirmar esta ubicación'}
        </Button>
      </div>
    </div>
  )
}
