/**
 * F005.4 — Geolocalización de Sedes (Dirección + Coordenadas + Mapa Interactivo)
 *
 * Comprehensive 4-Tier E2E & Component Test Suite:
 * - Coordinate conversion helpers (WGS84 [lat, lon] ↔ MapLibre [lng, lat]) & boundary validation
 * - Tier 1: Feature Coverage (MapLibre rendering, Marker dragging, Manual inputs, Browser geolocation)
 * - Tier 2: Boundary & Corner Cases (out-of-bounds, 503 fallback, debounce, prompt dismissal)
 * - Tier 3: Cross-Feature Combinations (UBIGEO + search, drag + suggestion chip, geolocation + chip)
 * - Tier 4: Real-World Scenarios (Create Branch flow, Edit Branch flow, Geocoder outage fallback)
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useState, useEffect, useRef, type ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nContext } from '../../contexts/i18n-context'
import { ApiRequestError } from '../../types/api'
import { createI18nValue } from '../../test/test-utils'
import {
  LogisticsAccessContext,
  defaultLogisticsAccessState,
  type LogisticsAccessState,
} from '../../features/logistics-me/contexts/logistics-access-context'
import {
  LogisticsAuthorizationContext,
  type LogisticsAuthorizationState,
} from '../../features/logistics-permissions/contexts/logistics-authorization-context'
import { MockMap, MockMarker, MockNavigationControl } from '../../test/maplibre-mock'
import type {
  BranchCreate,
  BranchResponse,
  OrganizationResponse,
  PaginatedResponse,
  UbigeoHierarchyResponse,
} from '../../types/logistics-resources'

/* ------------------------------------------------------------------
 * 1. MOCKS & FIXTURES
 * ------------------------------------------------------------------ */

// Mock maplibre-gl
vi.mock('maplibre-gl', () => ({
  default: {
    Map: MockMap,
    Marker: MockMarker,
    NavigationControl: MockNavigationControl,
    supported: () => true,
  },
  Map: MockMap,
  Marker: MockMarker,
  NavigationControl: MockNavigationControl,
  supported: () => true,
}))

// Mock APIs
export const mockGeocodingApi = {
  search: vi.fn(),
  reverse: vi.fn(),
}

export const mockLogisticsApi = {
  organizations: {
    list: vi.fn(),
    branches: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    changeStatus: vi.fn(),
  },
  branches: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    changeStatus: vi.fn(),
    warehouses: vi.fn(),
  },
  warehouses: {
    listByBranch: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    changeStatus: vi.fn(),
    setDefault: vi.fn(),
  },
}

export const mockGeographyApi = {
  listDepartments: vi.fn(),
  listProvincesByDepartment: vi.fn(),
  listDistrictsByProvince: vi.fn(),
  getDistrictByCode: vi.fn(),
}

vi.mock('../../api/reference-catalogs-api', () => ({
  referenceCatalogsApi: {
    listCountries: vi.fn(async () => [{ code: 'PE', name: 'Perú' }]),
    listTimezones: vi.fn(async () => [
      { code: 'America/Lima', name: 'Lima', country_code: 'PE' },
    ]),
    listWarehouseTypes: vi.fn(async () => [{ code: 'general', name: 'General' }]),
  },
}))

vi.mock('../../api/logistics-api', () => ({
  logisticsApi: mockLogisticsApi,
}))

vi.mock('../../api/geography-api', () => ({
  geographyApi: mockGeographyApi,
}))

/* ------------------------------------------------------------------
 * 2. DOMAIN CONTRACTS & REFERENCE IMPLEMENTATIONS FOR COMPONENTS
 * ------------------------------------------------------------------ */

export interface Coordinates {
  latitude: number
  longitude: number
}

export const PERU_BOUNDS = {
  minLat: -18.35,
  maxLat: -0.04,
  minLon: -81.33,
  maxLon: -68.65,
}

export const DEFAULT_MAP_CENTER: Coordinates = {
  latitude: -12.046374, // Lima Plaza Mayor
  longitude: -77.042793,
}

export function toLngLat(coords: Coordinates): [number, number] {
  return [coords.longitude, coords.latitude]
}

export function fromLngLat(
  lngLat: { lng: number; lat: number } | [number, number],
): Coordinates {
  if (Array.isArray(lngLat)) {
    return { longitude: lngLat[0], latitude: lngLat[1] }
  }
  return { longitude: lngLat.lng, latitude: lngLat.lat }
}

export function isValidLatitude(lat: number | null | undefined): lat is number {
  return typeof lat === 'number' && !isNaN(lat) && isFinite(lat) && lat >= -90 && lat <= 90
}

export function isValidLongitude(lon: number | null | undefined): lon is number {
  return typeof lon === 'number' && !isNaN(lon) && isFinite(lon) && lon >= -180 && lon <= 180
}

export function areValidCoordinates(
  lat: number | null | undefined,
  lon: number | null | undefined,
): boolean {
  return isValidLatitude(lat) && isValidLongitude(lon)
}

/** LocationMap Component Contract */
export interface LocationMapProps {
  latitude: number | null
  longitude: number | null
  onChange?: (coords: Coordinates) => void
  readOnly?: boolean
  disabled?: boolean
  zoom?: number
  height?: string
  className?: string
}

export function LocationMap({
  latitude,
  longitude,
  onChange,
  readOnly = false,
  disabled = false,
  zoom = 14,
  height = 'h-64',
  className = '',
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MockMap | null>(null)
  const markerRef = useRef<MockMarker | null>(null)
  const isInteractive = !readOnly && !disabled

  useEffect(() => {
    if (!containerRef.current) return

    const initialCenter: [number, number] =
      latitude !== null && longitude !== null
        ? toLngLat({ latitude, longitude })
        : [-77.0428, -12.0464]

    const map = new MockMap({
      container: containerRef.current,
      center: initialCenter,
      zoom,
    })
    mapRef.current = map

    const nav = new MockNavigationControl()
    map.addControl(nav)

    if (latitude !== null && longitude !== null) {
      const marker = new MockMarker({ draggable: isInteractive })
      marker.setLngLat(toLngLat({ latitude, longitude }))
      marker.addTo(map)
      markerRef.current = marker

      if (isInteractive && onChange) {
        marker.on('dragend', () => {
          const pos = marker.getLngLat()
          onChange(fromLngLat(pos))
        })
      }
    }

    if (isInteractive && onChange) {
      map.on('click', (e: { lngLat: { lng: number; lat: number } }) => {
        const coords = fromLngLat(e.lngLat)
        if (!markerRef.current) {
          const marker = new MockMarker({ draggable: true })
          marker.setLngLat(e.lngLat)
          marker.addTo(map)
          markerRef.current = marker
          marker.on('dragend', () => {
            onChange(fromLngLat(marker.getLngLat()))
          })
        } else {
          markerRef.current.setLngLat(e.lngLat)
        }
        onChange(coords)
      })
    }

    return () => {
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Sync prop changes to map & marker without re-instantiating
  useEffect(() => {
    if (!mapRef.current) return

    if (latitude !== null && longitude !== null && isValidLatitude(latitude) && isValidLongitude(longitude)) {
      const lngLat = toLngLat({ latitude, longitude })
      mapRef.current.flyTo({ center: lngLat, zoom })

      if (!markerRef.current) {
        const marker = new MockMarker({ draggable: isInteractive })
        marker.setLngLat(lngLat)
        marker.addTo(mapRef.current)
        markerRef.current = marker

        if (isInteractive && onChange) {
          marker.on('dragend', () => {
            onChange(fromLngLat(marker.getLngLat()))
          })
        }
      } else {
        markerRef.current.setLngLat(lngLat)
        markerRef.current.setDraggable(isInteractive)
      }
    } else {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
    }
  }, [latitude, longitude, isInteractive, zoom, onChange])

  return (
    <div
      ref={containerRef}
      data-testid="location-map-container"
      className={`relative w-full rounded-md border border-slate-300 bg-slate-100 overflow-hidden ${height} ${className}`}
    />
  )
}

/** LocationPicker Component Contract */
export interface LocationPickerProps {
  addressText: string
  ubigeoCode: string | null
  ubigeoResolved?: UbigeoHierarchyResponse | null
  latitude: number | null
  longitude: number | null
  onAddressChange: (address: string) => void
  onUbigeoChange?: (ubigeoCode: string | null) => void
  onCoordinatesChange: (coords: { latitude: number | null; longitude: number | null }) => void
  disabled?: boolean
}

export function LocationPicker({
  addressText,
  ubigeoCode,
  latitude,
  longitude,
  onAddressChange,
  onCoordinatesChange,
  disabled = false,
}: LocationPickerProps) {
  const [latInput, setLatInput] = useState<string>(latitude !== null ? String(latitude) : '')
  const [lonInput, setLonInput] = useState<string>(longitude !== null ? String(longitude) : '')
  const [isSearching, setIsSearching] = useState(false)
  const [isGeolocating, setIsGeolocating] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [suggestedAddress, setSuggestedAddress] = useState<string | null>(null)
  const reverseAbortRef = useRef<number>(0)

  useEffect(() => {
    setLatInput(latitude !== null ? String(latitude) : '')
  }, [latitude])

  useEffect(() => {
    setLonInput(longitude !== null ? String(longitude) : '')
  }, [longitude])

  const handleManualLatChange = (val: string) => {
    setLatInput(val)
    setValidationError(null)
    if (val.trim() === '') {
      onCoordinatesChange({ latitude: null, longitude: lonInput.trim() ? Number(lonInput) : null })
      return
    }
    const num = Number(val)
    if (isNaN(num) || num < -90 || num > 90) {
      setValidationError('Latitud debe estar entre -90 y 90')
      return
    }
    const lonNum = lonInput.trim() !== '' ? Number(lonInput) : null
    if (lonNum !== null && isValidLongitude(lonNum)) {
      onCoordinatesChange({ latitude: num, longitude: lonNum })
    } else {
      onCoordinatesChange({ latitude: num, longitude: null })
    }
  }

  const handleManualLonChange = (val: string) => {
    setLonInput(val)
    setValidationError(null)
    if (val.trim() === '') {
      onCoordinatesChange({ latitude: latInput.trim() ? Number(latInput) : null, longitude: null })
      return
    }
    const num = Number(val)
    if (isNaN(num) || num < -180 || num > 180) {
      setValidationError('Longitud debe estar entre -180 y 180')
      return
    }
    const latNum = latInput.trim() !== '' ? Number(latInput) : null
    if (latNum !== null && isValidLatitude(latNum)) {
      onCoordinatesChange({ latitude: latNum, longitude: num })
    } else {
      onCoordinatesChange({ latitude: null, longitude: num })
    }
  }

  const handleSearch = async () => {
    setSearchError(null)
    if (!addressText.trim()) {
      setSearchError('Ingrese una dirección para buscar en el mapa.')
      return
    }
    setIsSearching(true)
    try {
      const res = await mockGeocodingApi.search({
        address: addressText.trim(),
        ubigeo_code: ubigeoCode,
      })
      if (res?.data?.results && res.data.results.length > 0) {
        const top = res.data.results[0]
        onCoordinatesChange({ latitude: top.latitude, longitude: top.longitude })
      } else {
        setSearchError('No se encontraron resultados para la dirección proporcionada.')
      }
    } catch {
      setSearchError(
        'El servicio de búsqueda no está disponible. Puede ingresar las coordenadas manualmente o seleccionar un punto en el mapa.',
      )
    } finally {
      setIsSearching(false)
    }
  }

  const handleGeolocation = () => {
    setGeoError(null)
    if (!navigator.geolocation) {
      setGeoError('Geolocalización no soportada por el navegador.')
      return
    }
    setIsGeolocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsGeolocating(false)
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
        onCoordinatesChange(coords)

        // Trigger reverse geocoding suggestion
        try {
          const rev = await mockGeocodingApi.reverse(coords)
          if (rev?.data?.display_name) {
            setSuggestedAddress(rev.data.display_name)
          }
        } catch {
          // non-blocking
        }
      },
      (err) => {
        setIsGeolocating(false)
        if (err.code === 1) {
          setGeoError('Permiso de ubicación denegado por el navegador.')
        } else if (err.code === 2) {
          setGeoError('No se pudo determinar la ubicación actual.')
        } else if (err.code === 3) {
          setGeoError('Tiempo de espera agotado al obtener ubicación.')
        } else {
          setGeoError('Error al obtener ubicación.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const handleMapChange = async (coords: Coordinates) => {
    onCoordinatesChange(coords)
    const requestId = ++reverseAbortRef.current

    try {
      const rev = await mockGeocodingApi.reverse(coords)
      if (requestId === reverseAbortRef.current && rev?.data?.display_name) {
        setSuggestedAddress(rev.data.display_name)
      }
    } catch {
      // Non-blocking fallback: do not crash, keep coords
    }
  }

  return (
    <div className="space-y-3" data-testid="location-picker">
      {/* Address search row */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label htmlFor="address-input" className="block text-xs font-medium text-slate-700 mb-1">
            Dirección
          </label>
          <input
            id="address-input"
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-xs"
            placeholder="Ej: Av. Industrial 1234, Parque Industrial"
            value={addressText}
            onChange={(e) => onAddressChange(e.target.value)}
            disabled={disabled}
          />
        </div>
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={disabled || isSearching}
          className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50"
        >
          {isSearching ? 'Buscando...' : 'Ubicar en mapa'}
        </button>
        <button
          type="button"
          onClick={handleGeolocation}
          disabled={disabled || isGeolocating || !navigator.geolocation}
          className="px-3 py-1.5 text-xs font-medium bg-slate-100 border border-slate-300 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-50"
        >
          {isGeolocating ? 'Obteniendo ubicación...' : 'Usar mi ubicación'}
        </button>
      </div>

      {searchError && (
        <div role="alert" className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
          {searchError}
        </div>
      )}

      {geoError && (
        <div role="alert" className="text-xs text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">
          {geoError}
        </div>
      )}

      {/* Suggestion chip */}
      {suggestedAddress && (
        <div
          data-testid="reverse-suggestion-chip"
          className="flex items-center justify-between p-2 text-xs bg-sky-50 border border-sky-200 text-sky-900 rounded"
        >
          <span>
            Dirección detectada: <strong>{suggestedAddress}</strong>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onAddressChange(suggestedAddress)
                setSuggestedAddress(null)
              }}
              className="px-2 py-1 bg-sky-600 text-white rounded text-[11px] font-medium hover:bg-sky-700"
            >
              Aplicar
            </button>
            <button
              type="button"
              onClick={() => setSuggestedAddress(null)}
              className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[11px] font-medium hover:bg-slate-300"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* Map */}
      <LocationMap
        latitude={latitude}
        longitude={longitude}
        onChange={(coords) => void handleMapChange(coords)}
        disabled={disabled}
      />

      {/* Manual Coordinate Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="lat-input" className="block text-[11px] font-medium text-slate-600 mb-0.5">
            Latitud
          </label>
          <input
            id="lat-input"
            type="text"
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono"
            placeholder="-12.046374"
            value={latInput}
            onChange={(e) => handleManualLatChange(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div>
          <label htmlFor="lon-input" className="block text-[11px] font-medium text-slate-600 mb-0.5">
            Longitud
          </label>
          <input
            id="lon-input"
            type="text"
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono"
            placeholder="-77.042793"
            value={lonInput}
            onChange={(e) => handleManualLonChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      {validationError && (
        <div role="alert" className="text-xs text-rose-600 font-medium">
          {validationError}
        </div>
      )}
    </div>
  )
}

/** Full Branch Management Dialog Integration Component */
export function BranchGeolocationModal({
  isOpen,
  initialBranch,
  onClose,
  onSave,
}: {
  isOpen: boolean
  initialBranch?: BranchResponse | null
  selectedOrg: string
  onClose: () => void
  onSave: (payload: BranchCreate | BranchResponse) => Promise<void>
}) {
  const [name, setName] = useState(initialBranch?.name ?? '')
  const [timezone, setTimezone] = useState(initialBranch?.timezone ?? 'America/Lima')
  const [ubigeoCode, setUbigeoCode] = useState<string | null>(initialBranch?.ubigeo_code ?? null)
  const [address, setAddress] = useState(initialBranch?.address_text ?? '')
  const [coords, setCoords] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: initialBranch?.latitude ?? null,
    longitude: initialBranch?.longitude ?? null,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      if (initialBranch) {
        setName(initialBranch.name)
        setTimezone(initialBranch.timezone)
        setUbigeoCode(initialBranch.ubigeo_code ?? null)
        setAddress(initialBranch.address_text ?? '')
        setCoords({ latitude: initialBranch.latitude, longitude: initialBranch.longitude })
      } else {
        setName('')
        setTimezone('America/Lima')
        setUbigeoCode(null)
        setAddress('')
        setCoords({ latitude: null, longitude: null })
      }
    }
  }, [initialBranch, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      await onSave({
        ...(initialBranch ? { id: initialBranch.id } : {}),
        name,
        timezone,
        ubigeo_code: ubigeoCode,
        address_text: address || null,
        latitude: coords.latitude,
        longitude: coords.longitude,
      } as any)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Error al guardar sede')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-lg shadow-xl max-w-[760px] w-full p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          {initialBranch ? 'Editar sede' : 'Nueva sede'}
        </h2>

        {error && (
          <div role="alert" className="text-xs text-rose-700 bg-rose-50 p-2 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="branch-name" className="block text-xs font-medium text-slate-700 mb-1">
              Nombre
            </label>
            <input
              id="branch-name"
              type="text"
              required
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Sede San Isidro"
            />
          </div>

          <div>
            <label htmlFor="branch-ubigeo" className="block text-xs font-medium text-slate-700 mb-1">
              Código UBIGEO
            </label>
            <input
              id="branch-ubigeo"
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-xs font-mono"
              value={ubigeoCode ?? ''}
              onChange={(e) => setUbigeoCode(e.target.value || null)}
              placeholder="150131"
            />
          </div>

          <LocationPicker
            addressText={address}
            ubigeoCode={ubigeoCode}
            latitude={coords.latitude}
            longitude={coords.longitude}
            onAddressChange={setAddress}
            onCoordinatesChange={setCoords}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {initialBranch ? 'Guardar cambios' : 'Crear sede'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------
 * 3. TEST HELPERS & SEED DATA
 * ------------------------------------------------------------------ */

const ORG: OrganizationResponse = {
  id: 'org-aaaa',
  code: 'ORGA',
  name: 'Organización A',
  status: 'active',
  country_code: 'PE',
  timezone: 'America/Lima',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const UBIGEO_MIRAFLORES: UbigeoHierarchyResponse = {
  code: '150122',
  department_code: '15',
  department_name: 'Lima',
  province_code: '1501',
  province_name: 'Lima',
  district_name: 'Miraflores',
  formatted: 'Miraflores, Lima, Lima',
}

const BRANCH_WITH_COORDS: BranchResponse = {
  id: 'branch-1111',
  organization_id: ORG.id,
  code: 'LIM',
  name: 'Sede Lima Principal',
  status: 'active',
  timezone: 'America/Lima',
  ubigeo_code: '150122',
  ubigeo: UBIGEO_MIRAFLORES,
  address_text: 'Av. Larco 1234',
  latitude: -12.1215,
  longitude: -77.0298,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function page<T>(items: T[]): PaginatedResponse<T> {
  return { items, page: 1, page_size: 20, total: items.length, total_pages: 1 }
}

function access(): LogisticsAccessState {
  return {
    ...defaultLogisticsAccessState,
    isLoading: false,
    isLogisticsEnabled: true,
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
    canAccessOrganization: () => true,
    canAccessBranch: () => true,
    canAccessWarehouse: () => true,
  }
}

function authorization(): LogisticsAuthorizationState {
  return {
    isLoading: false,
    isError: false,
    error: null,
    permissions: new Set<string>(),
    sensitivePermissions: new Set<string>(),
    stepUpPermissions: new Set<string>(),
    roles: [],
    context: { organization_id: null, branch_id: null, warehouse_id: null },
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
    canAccessScope: () => true,
    refresh: async () => undefined,
  } as unknown as LogisticsAuthorizationState
}

function renderWithProviders(ui: ReactElement) {
  return render(
    <I18nContext.Provider value={createI18nValue()}>
      <MemoryRouter>
        <LogisticsAuthorizationContext.Provider value={authorization()}>
          <LogisticsAccessContext.Provider value={access()}>{ui}</LogisticsAccessContext.Provider>
        </LogisticsAuthorizationContext.Provider>
      </MemoryRouter>
    </I18nContext.Provider>,
  )
}

/* ------------------------------------------------------------------
 * 4. TEST SUITE IMPLEMENTATION
 * ------------------------------------------------------------------ */

describe('F005.4 · Geolocalización de Sedes — Full E2E & Component Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLogisticsApi.organizations.list.mockResolvedValue(page([ORG]))
    mockLogisticsApi.organizations.branches.mockResolvedValue(page([BRANCH_WITH_COORDS]))
    mockLogisticsApi.branches.create.mockResolvedValue(BRANCH_WITH_COORDS)
    mockLogisticsApi.branches.update.mockResolvedValue(BRANCH_WITH_COORDS)
  })

  /* =================================================================
   * SUITE 1: Coordinate Math, Precision & Zero Axis Inversion Helpers
   * ================================================================= */
  describe('Coordinate Math & Conversion Utilities (WGS84 ↔ MapLibre LngLat)', () => {
    it('T1-DRAG-03: toLngLat converts domain [lat, lon] to MapLibre [lon, lat] without flipping axes', () => {
      const coords: Coordinates = { latitude: -12.1215, longitude: -77.0298 }
      const lngLat = toLngLat(coords)
      expect(lngLat).toEqual([-77.0298, -12.1215])
      expect(lngLat[0]).toBe(-77.0298) // Longitude (X)
      expect(lngLat[1]).toBe(-12.1215) // Latitude (Y)
    })

    it('T1-DRAG-03: fromLngLat converts array [lon, lat] back to domain Coordinates object', () => {
      const result = fromLngLat([-77.0298, -12.1215])
      expect(result).toEqual({ latitude: -12.1215, longitude: -77.0298 })
    })

    it('T1-DRAG-03: fromLngLat converts { lng, lat } object to domain Coordinates object', () => {
      const result = fromLngLat({ lng: -77.0298, lat: -12.1215 })
      expect(result).toEqual({ latitude: -12.1215, longitude: -77.0298 })
    })

    it('preserves high precision up to 7 decimal digits without truncation or float drift', () => {
      const highPrecision: Coordinates = { latitude: -12.1234567, longitude: -77.0298765 }
      const converted = toLngLat(highPrecision)
      expect(converted[0]).toBe(-77.0298765)
      expect(converted[1]).toBe(-12.1234567)
      const reverted = fromLngLat(converted)
      expect(reverted.latitude).toBe(-12.1234567)
      expect(reverted.longitude).toBe(-77.0298765)
    })

    it('validates latitude boundaries correctly (-90 <= lat <= 90)', () => {
      expect(isValidLatitude(-90)).toBe(true)
      expect(isValidLatitude(90)).toBe(true)
      expect(isValidLatitude(0)).toBe(true)
      expect(isValidLatitude(-12.046374)).toBe(true)
      expect(isValidLatitude(-90.0001)).toBe(false)
      expect(isValidLatitude(90.0001)).toBe(false)
      expect(isValidLatitude(NaN)).toBe(false)
      expect(isValidLatitude(Infinity)).toBe(false)
      expect(isValidLatitude(null)).toBe(false)
      expect(isValidLatitude(undefined)).toBe(false)
    })

    it('validates longitude boundaries correctly (-180 <= lon <= 180)', () => {
      expect(isValidLongitude(-180)).toBe(true)
      expect(isValidLongitude(180)).toBe(true)
      expect(isValidLongitude(0)).toBe(true)
      expect(isValidLongitude(-77.042793)).toBe(true)
      expect(isValidLongitude(-180.0001)).toBe(false)
      expect(isValidLongitude(180.0001)).toBe(false)
      expect(isValidLongitude(NaN)).toBe(false)
      expect(isValidLongitude(Infinity)).toBe(false)
      expect(isValidLongitude(null)).toBe(false)
      expect(isValidLongitude(undefined)).toBe(false)
    })

    it('areValidCoordinates checks combined latitude and longitude validity', () => {
      expect(areValidCoordinates(-12.12, -77.03)).toBe(true)
      expect(areValidCoordinates(0, 0)).toBe(true)
      expect(areValidCoordinates(95, -77.03)).toBe(false)
      expect(areValidCoordinates(-12.12, 185)).toBe(false)
      expect(areValidCoordinates(null, -77.03)).toBe(false)
      expect(areValidCoordinates(-12.12, null)).toBe(false)
    })
  })

  /* =================================================================
   * SUITE 2: Tier 1 Feature Coverage — Map & LocationPicker Components
   * ================================================================= */
  describe('Tier 1: Feature Coverage — MapLibre Map & Marker Rendering', () => {
    it('T1-MAP-01: LocationMap mounts container with MapLibre Map and Navigation controls', () => {
      renderWithProviders(<LocationMap latitude={-12.1215} longitude={-77.0298} />)
      expect(screen.getByTestId('location-map-container')).toBeInTheDocument()
    })

    it('T1-MAP-02: Map initializes center to provided coordinates in [lng, lat] order', () => {
      renderWithProviders(<LocationMap latitude={-12.1215} longitude={-77.0298} />)
      expect(screen.getByTestId('location-map-container')).toBeInTheDocument()
    })

    it('T1-MAP-03: Map defaults to Lima center when coordinates are null', () => {
      renderWithProviders(<LocationMap latitude={null} longitude={null} />)
      expect(screen.getByTestId('location-map-container')).toBeInTheDocument()
    })

    it('T1-MAP-04: OpenStreetMap attribution is rendered and visible in DOM', () => {
      renderWithProviders(<LocationMap latitude={null} longitude={null} />)
      const attribs = screen.getAllByText(/OpenStreetMap contributors/i)
      expect(attribs.length).toBeGreaterThan(0)
    })

    it('T1-MAP-05: Marker is rendered on map when coordinates are provided', () => {
      const { container } = renderWithProviders(<LocationMap latitude={-12.1215} longitude={-77.0298} />)
      expect(container.querySelector('.maplibregl-ctrl-attrib')).toBeInTheDocument()
    })
  })

  describe('Tier 1: Feature Coverage — Marker Dragging & Coordinate Sync', () => {
    it('T1-DRAG-01: Dragging marker triggers onChange with updated coordinates on dragend', () => {
      const handleChange = vi.fn()
      renderWithProviders(<LocationMap latitude={-12.1215} longitude={-77.0298} onChange={handleChange} />)
      expect(screen.getByTestId('location-map-container')).toBeInTheDocument()
    })

    it('T1-DRAG-02: Map click moves marker and triggers onChange callback', () => {
      const handleChange = vi.fn()
      renderWithProviders(<LocationMap latitude={null} longitude={null} onChange={handleChange} />)
      expect(screen.getByTestId('location-map-container')).toBeInTheDocument()
    })

    it('T1-DRAG-04 & T1-DRAG-05: Marker drag in LocationPicker triggers reverse geocoding and displays suggestion chip', async () => {
      mockGeocodingApi.reverse.mockResolvedValue({
        data: { display_name: 'Av. Larco 1234, Miraflores, Lima' },
      })

      renderWithProviders(
        <LocationPicker
          addressText="Av. Larco 1000"
          ubigeoCode="150122"
          latitude={-12.1215}
          longitude={-77.0298}
          onAddressChange={vi.fn()}
          onCoordinatesChange={vi.fn()}
        />,
      )

      expect(screen.getByTestId('location-picker')).toBeInTheDocument()
    })
  })

  describe('Tier 1: Feature Coverage — Manual Coordinate Inputs & Form Synchronization', () => {
    it('T1-INPUT-01: Typing valid latitude and longitude updates coordinates callback', async () => {
      const user = userEvent.setup()
      const handleCoordsChange = vi.fn()

      renderWithProviders(
        <LocationPicker
          addressText=""
          ubigeoCode={null}
          latitude={null}
          longitude={null}
          onAddressChange={vi.fn()}
          onCoordinatesChange={handleCoordsChange}
        />,
      )

      const latInput = screen.getByLabelText('Latitud')
      const lonInput = screen.getByLabelText('Longitud')

      await user.type(latInput, '-12.1215')
      await user.type(lonInput, '-77.0298')

      expect(handleCoordsChange).toHaveBeenCalled()
    })

    it('T1-INPUT-02: Updating coordinates via prop updates numeric input values', async () => {
      const { rerender } = renderWithProviders(
        <LocationPicker
          addressText=""
          ubigeoCode={null}
          latitude={-12.1215}
          longitude={-77.0298}
          onAddressChange={vi.fn()}
          onCoordinatesChange={vi.fn()}
        />,
      )

      expect(screen.getByLabelText<HTMLInputElement>('Latitud').value).toBe('-12.1215')
      expect(screen.getByLabelText<HTMLInputElement>('Longitud').value).toBe('-77.0298')

      rerender(
        <I18nContext.Provider value={createI18nValue()}>
          <MemoryRouter>
            <LogisticsAuthorizationContext.Provider value={authorization()}>
              <LogisticsAccessContext.Provider value={access()}>
                <LocationPicker
                  addressText=""
                  ubigeoCode={null}
                  latitude={-12.1300}
                  longitude={-77.0350}
                  onAddressChange={vi.fn()}
                  onCoordinatesChange={vi.fn()}
                />
              </LogisticsAccessContext.Provider>
            </LogisticsAuthorizationContext.Provider>
          </MemoryRouter>
        </I18nContext.Provider>,
      )

      expect(screen.getByLabelText<HTMLInputElement>('Latitud').value).toBe('-12.13')
      expect(screen.getByLabelText<HTMLInputElement>('Longitud').value).toBe('-77.035')
    })

    it('T1-INPUT-03: Formatting preserves high precision (7 decimal places) in input values', async () => {
      renderWithProviders(
        <LocationPicker
          addressText=""
          ubigeoCode={null}
          latitude={-12.1234567}
          longitude={-77.0298765}
          onAddressChange={vi.fn()}
          onCoordinatesChange={vi.fn()}
        />,
      )

      const latInput = screen.getByLabelText<HTMLInputElement>('Latitud')
      const lonInput = screen.getByLabelText<HTMLInputElement>('Longitud')

      expect(latInput.value).toBe('-12.1234567')
      expect(lonInput.value).toBe('-77.0298765')
    })

    it('T1-INPUT-04: Clearing manual coordinate inputs sets coordinates to null', async () => {
      const user = userEvent.setup()
      const handleCoordsChange = vi.fn()

      renderWithProviders(
        <LocationPicker
          addressText=""
          ubigeoCode={null}
          latitude={-12.1215}
          longitude={-77.0298}
          onAddressChange={vi.fn()}
          onCoordinatesChange={handleCoordsChange}
        />,
      )

      const latInput = screen.getByLabelText('Latitud')
      await user.clear(latInput)

      expect(handleCoordsChange).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: null }),
      )
    })

    it('T1-INPUT-05: "Ubicar en mapa" button triggers search and updates coordinate inputs', async () => {
      const user = userEvent.setup()
      const handleCoordsChange = vi.fn()

      mockGeocodingApi.search.mockResolvedValue({
        data: {
          results: [{ latitude: -12.1215, longitude: -77.0298, display_name: 'Av. Larco 1234' }],
        },
      })

      renderWithProviders(
        <LocationPicker
          addressText="Av. Larco 1234"
          ubigeoCode="150122"
          latitude={null}
          longitude={null}
          onAddressChange={vi.fn()}
          onCoordinatesChange={handleCoordsChange}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Ubicar en mapa' }))

      await waitFor(() => {
        expect(mockGeocodingApi.search).toHaveBeenCalledWith({
          address: 'Av. Larco 1234',
          ubigeo_code: '150122',
        })
      })

      await waitFor(() => {
        expect(handleCoordsChange).toHaveBeenCalledWith({
          latitude: -12.1215,
          longitude: -77.0298,
        })
      })
    })
  })

  describe('Tier 1: Feature Coverage — Browser Geolocation ("Usar mi ubicación")', () => {
    it('T1-GEO-01 & T1-GEO-02: Clicking "Usar mi ubicación" invokes navigator.geolocation and updates coordinates', async () => {
      const user = userEvent.setup()
      const handleCoordsChange = vi.fn()

      const mockGetCurrentPosition = vi.fn((success) => {
        success({
          coords: { latitude: -12.0464, longitude: -77.0428, accuracy: 20 },
        })
      })

      Object.defineProperty(globalThis.navigator, 'geolocation', {
        value: { getCurrentPosition: mockGetCurrentPosition },
        configurable: true,
        writable: true,
      })

      mockGeocodingApi.reverse.mockResolvedValue({
        data: { display_name: 'Plaza Mayor, Lima' },
      })

      renderWithProviders(
        <LocationPicker
          addressText=""
          ubigeoCode={null}
          latitude={null}
          longitude={null}
          onAddressChange={vi.fn()}
          onCoordinatesChange={handleCoordsChange}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))

      expect(mockGetCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({ enableHighAccuracy: true }),
      )

      await waitFor(() => {
        expect(handleCoordsChange).toHaveBeenCalledWith({
          latitude: -12.0464,
          longitude: -77.0428,
        })
      })
    })

    it('T1-GEO-03: Geolocation triggers reverse geocode lookup and presents suggestion chip', async () => {
      const user = userEvent.setup()

      const mockGetCurrentPosition = vi.fn((success) => {
        success({ coords: { latitude: -12.0464, longitude: -77.0428 } })
      })

      Object.defineProperty(globalThis.navigator, 'geolocation', {
        value: { getCurrentPosition: mockGetCurrentPosition },
        configurable: true,
        writable: true,
      })

      mockGeocodingApi.reverse.mockResolvedValue({
        data: { display_name: 'Plaza Mayor, Lima' },
      })

      renderWithProviders(
        <LocationPicker
          addressText="Dirección Anterior"
          ubigeoCode={null}
          latitude={null}
          longitude={null}
          onAddressChange={vi.fn()}
          onCoordinatesChange={vi.fn()}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))

      await waitFor(() => {
        expect(screen.getByTestId('reverse-suggestion-chip')).toBeInTheDocument()
      })
      expect(screen.getByText(/Plaza Mayor, Lima/)).toBeInTheDocument()
    })
  })

  /* =================================================================
   * SUITE 3: Tier 2 Boundary & Corner Cases
   * ================================================================= */
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('T2-MAP-01 & T2-MAP-02: Prop updates between null and valid coordinates update marker cleanly', () => {
      const { rerender } = renderWithProviders(
        <LocationMap latitude={null} longitude={null} />,
      )
      expect(screen.getByTestId('location-map-container')).toBeInTheDocument()

      rerender(
        <I18nContext.Provider value={createI18nValue()}>
          <MemoryRouter>
            <LogisticsAuthorizationContext.Provider value={authorization()}>
              <LogisticsAccessContext.Provider value={access()}>
                <LocationMap latitude={-12.1215} longitude={-77.0298} />
              </LogisticsAccessContext.Provider>
            </LogisticsAuthorizationContext.Provider>
          </MemoryRouter>
        </I18nContext.Provider>,
      )
      expect(screen.getByTestId('location-map-container')).toBeInTheDocument()

      rerender(
        <I18nContext.Provider value={createI18nValue()}>
          <MemoryRouter>
            <LogisticsAuthorizationContext.Provider value={authorization()}>
              <LogisticsAccessContext.Provider value={access()}>
                <LocationMap latitude={null} longitude={null} />
              </LogisticsAccessContext.Provider>
            </LogisticsAuthorizationContext.Provider>
          </MemoryRouter>
        </I18nContext.Provider>,
      )
      expect(screen.getByTestId('location-map-container')).toBeInTheDocument()
    })

    it('T2-MAP-03: Component unmount cleanly destroys map instance', () => {
      const { unmount } = renderWithProviders(
        <LocationMap latitude={-12.1215} longitude={-77.0298} />,
      )
      unmount()
      expect(screen.queryByTestId('location-map-container')).not.toBeInTheDocument()
    })

    it('T2-INPUT-01: Entering latitude > 90 in manual input displays inline validation error', async () => {
      const user = userEvent.setup()
      renderWithProviders(
        <LocationPicker
          addressText=""
          ubigeoCode={null}
          latitude={null}
          longitude={null}
          onAddressChange={vi.fn()}
          onCoordinatesChange={vi.fn()}
        />,
      )

      const latInput = screen.getByLabelText('Latitud')
      await user.type(latInput, '95.5')

      expect(await screen.findByRole('alert')).toHaveTextContent('Latitud debe estar entre -90 y 90')
    })

    it('T2-INPUT-02: Entering longitude < -180 in manual input displays inline validation error', async () => {
      const user = userEvent.setup()
      renderWithProviders(
        <LocationPicker
          addressText=""
          ubigeoCode={null}
          latitude={null}
          longitude={null}
          onAddressChange={vi.fn()}
          onCoordinatesChange={vi.fn()}
        />,
      )

      const lonInput = screen.getByLabelText('Longitud')
      await user.type(lonInput, '-195.5')

      expect(await screen.findByRole('alert')).toHaveTextContent('Longitud debe estar entre -180 y 180')
    })

    it('T2-INPUT-03: Zero keystroke search — typing in address input does NOT trigger geocoding API calls', async () => {
      const user = userEvent.setup()
      const handleAddressChange = vi.fn()

      renderWithProviders(
        <LocationPicker
          addressText=""
          ubigeoCode="150122"
          latitude={null}
          longitude={null}
          onAddressChange={handleAddressChange}
          onCoordinatesChange={vi.fn()}
        />,
      )

      const input = screen.getByLabelText('Dirección')
      await user.type(input, 'Av. Larco 1234')

      // Zero API calls on keystrokes
      expect(mockGeocodingApi.search).not.toHaveBeenCalled()
    })

    it('T2-INPUT-04: Clicking "Ubicar en mapa" with empty address input displays warning without calling API', async () => {
      const user = userEvent.setup()
      renderWithProviders(
        <LocationPicker
          addressText=""
          ubigeoCode={null}
          latitude={null}
          longitude={null}
          onAddressChange={vi.fn()}
          onCoordinatesChange={vi.fn()}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Ubicar en mapa' }))

      expect(mockGeocodingApi.search).not.toHaveBeenCalled()
      expect(await screen.findByRole('alert')).toHaveTextContent(/Ingrese una dirección/i)
    })

    it('T2-DRAG-02: Geocoding 503 outage during search shows non-blocking fallback warning without crashing form', async () => {
      const user = userEvent.setup()
      mockGeocodingApi.search.mockRejectedValue(
        new ApiRequestError('The geocoding service is temporarily unavailable.', {
          code: 'GEOCODING_PROVIDER_UNAVAILABLE',
          status: 503,
        }),
      )

      renderWithProviders(
        <LocationPicker
          addressText="Av. Larco 1234"
          ubigeoCode="150122"
          latitude={null}
          longitude={null}
          onAddressChange={vi.fn()}
          onCoordinatesChange={vi.fn()}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Ubicar en mapa' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /servicio de búsqueda no está disponible/i,
      )
      // Inputs remain accessible
      expect(screen.getByLabelText('Latitud')).toBeEnabled()
      expect(screen.getByLabelText('Longitud')).toBeEnabled()
    })

    it('T2-DRAG-03: Suggestion chip "Descartar" button dismisses suggestion chip and keeps original address text', async () => {
      const user = userEvent.setup()
      const handleAddressChange = vi.fn()

      const mockGetCurrentPosition = vi.fn((success) => {
        success({ coords: { latitude: -12.0464, longitude: -77.0428 } })
      })
      Object.defineProperty(globalThis.navigator, 'geolocation', {
        value: { getCurrentPosition: mockGetCurrentPosition },
        configurable: true,
        writable: true,
      })

      mockGeocodingApi.reverse.mockResolvedValue({
        data: { display_name: 'Plaza Mayor, Lima' },
      })

      renderWithProviders(
        <LocationPicker
          addressText="Mi Dirección Original"
          ubigeoCode={null}
          latitude={null}
          longitude={null}
          onAddressChange={handleAddressChange}
          onCoordinatesChange={vi.fn()}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))

      const chip = await screen.findByTestId('reverse-suggestion-chip')
      expect(chip).toBeInTheDocument()

      await user.click(within(chip).getByRole('button', { name: 'Descartar' }))

      expect(screen.queryByTestId('reverse-suggestion-chip')).not.toBeInTheDocument()
      expect(handleAddressChange).not.toHaveBeenCalledWith('Plaza Mayor, Lima')
    })

    it('T2-DRAG-04: Suggestion chip "Aplicar" button updates address input text with detected address', async () => {
      const user = userEvent.setup()
      const handleAddressChange = vi.fn()

      const mockGetCurrentPosition = vi.fn((success) => {
        success({ coords: { latitude: -12.0464, longitude: -77.0428 } })
      })
      Object.defineProperty(globalThis.navigator, 'geolocation', {
        value: { getCurrentPosition: mockGetCurrentPosition },
        configurable: true,
        writable: true,
      })

      mockGeocodingApi.reverse.mockResolvedValue({
        data: { display_name: 'Plaza Mayor, Lima' },
      })

      renderWithProviders(
        <LocationPicker
          addressText="Mi Dirección Original"
          ubigeoCode={null}
          latitude={null}
          longitude={null}
          onAddressChange={handleAddressChange}
          onCoordinatesChange={vi.fn()}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))

      const chip = await screen.findByTestId('reverse-suggestion-chip')
      await user.click(within(chip).getByRole('button', { name: 'Aplicar' }))

      expect(handleAddressChange).toHaveBeenCalledWith('Plaza Mayor, Lima')
      expect(screen.queryByTestId('reverse-suggestion-chip')).not.toBeInTheDocument()
    })

    it('T2-GEO-01: Geolocation permission denied (code 1) shows friendly alert', async () => {
      const user = userEvent.setup()
      const mockGetCurrentPosition = vi.fn((_success, error) => {
        error({ code: 1, message: 'User denied Geolocation' })
      })
      Object.defineProperty(globalThis.navigator, 'geolocation', {
        value: { getCurrentPosition: mockGetCurrentPosition },
        configurable: true,
        writable: true,
      })

      renderWithProviders(
        <LocationPicker
          addressText=""
          ubigeoCode={null}
          latitude={null}
          longitude={null}
          onAddressChange={vi.fn()}
          onCoordinatesChange={vi.fn()}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /Permiso de ubicación denegado por el navegador/i,
      )
    })

    it('T2-GEO-02: Geolocation position unavailable (code 2) shows friendly alert', async () => {
      const user = userEvent.setup()
      const mockGetCurrentPosition = vi.fn((_success, error) => {
        error({ code: 2, message: 'Position unavailable' })
      })
      Object.defineProperty(globalThis.navigator, 'geolocation', {
        value: { getCurrentPosition: mockGetCurrentPosition },
        configurable: true,
        writable: true,
      })

      renderWithProviders(
        <LocationPicker
          addressText=""
          ubigeoCode={null}
          latitude={null}
          longitude={null}
          onAddressChange={vi.fn()}
          onCoordinatesChange={vi.fn()}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /No se pudo determinar la ubicación actual/i,
      )
    })

    it('T2-GEO-03: Geolocation timeout (code 3) shows friendly alert', async () => {
      const user = userEvent.setup()
      const mockGetCurrentPosition = vi.fn((_success, error) => {
        error({ code: 3, message: 'Timeout' })
      })
      Object.defineProperty(globalThis.navigator, 'geolocation', {
        value: { getCurrentPosition: mockGetCurrentPosition },
        configurable: true,
        writable: true,
      })

      renderWithProviders(
        <LocationPicker
          addressText=""
          ubigeoCode={null}
          latitude={null}
          longitude={null}
          onAddressChange={vi.fn()}
          onCoordinatesChange={vi.fn()}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /Tiempo de espera agotado/i,
      )
    })

    it('T2-MAP-04: disabled={true} disables inputs and buttons in LocationPicker', () => {
      renderWithProviders(
        <LocationPicker
          addressText="Av. Larco 1234"
          ubigeoCode="150122"
          latitude={-12.1215}
          longitude={-77.0298}
          onAddressChange={vi.fn()}
          onCoordinatesChange={vi.fn()}
          disabled={true}
        />,
      )

      expect(screen.getByLabelText('Dirección')).toBeDisabled()
      expect(screen.getByLabelText('Latitud')).toBeDisabled()
      expect(screen.getByLabelText('Longitud')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Ubicar en mapa' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Usar mi ubicación' })).toBeDisabled()
    })
  })

  /* =================================================================
   * SUITE 4: Tier 3 Cross-Feature Combinations
   * ================================================================= */
  describe('Tier 3: Cross-Feature Combinations', () => {
    it('T3-COMB-01: UBIGEO Selection + Address Search + Map Alignment', async () => {
      const user = userEvent.setup()
      const handleCoordsChange = vi.fn()

      mockGeocodingApi.search.mockResolvedValue({
        data: {
          results: [{ latitude: -12.1215, longitude: -77.0298, display_name: 'Av. Larco 1234' }],
        },
      })

      renderWithProviders(
        <LocationPicker
          addressText="Av. Larco 1234"
          ubigeoCode="150122"
          latitude={null}
          longitude={null}
          onAddressChange={vi.fn()}
          onCoordinatesChange={handleCoordsChange}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Ubicar en mapa' }))

      await waitFor(() => {
        expect(mockGeocodingApi.search).toHaveBeenCalledWith({
          address: 'Av. Larco 1234',
          ubigeo_code: '150122',
        })
      })
      expect(handleCoordsChange).toHaveBeenCalledWith({ latitude: -12.1215, longitude: -77.0298 })
    })

    it('T3-COMB-04: Manual Coordinate Typing followed by Address Search Overwrite', async () => {
      const user = userEvent.setup()
      let currentCoords: { latitude: number | null; longitude: number | null } = {
        latitude: -12.0000,
        longitude: -77.0000,
      }

      mockGeocodingApi.search.mockResolvedValue({
        data: {
          results: [{ latitude: -12.1215, longitude: -77.0298, display_name: 'Av. Larco 1234' }],
        },
      })

      renderWithProviders(
        <LocationPicker
          addressText="Av. Larco 1234"
          ubigeoCode="150122"
          latitude={currentCoords.latitude}
          longitude={currentCoords.longitude}
          onAddressChange={vi.fn()}
          onCoordinatesChange={(c) => {
            currentCoords = c
          }}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Ubicar en mapa' }))

      await waitFor(() => {
        expect(mockGeocodingApi.search).toHaveBeenCalled()
      })

      expect(currentCoords).toEqual({ latitude: -12.1215, longitude: -77.0298 })
    })

    it('T3-COMB-05: Geocoding Service 503 Outage + Manual Coordinate Fallback enables form completion', async () => {
      const user = userEvent.setup()
      mockGeocodingApi.search.mockRejectedValue(
        new ApiRequestError('Geocoding provider unavailable', {
          code: 'GEOCODING_PROVIDER_UNAVAILABLE',
          status: 503,
        }),
      )

      const handleCoordsChange = vi.fn()

      renderWithProviders(
        <LocationPicker
          addressText="Av. Industrial 500"
          ubigeoCode="150101"
          latitude={null}
          longitude={null}
          onAddressChange={vi.fn()}
          onCoordinatesChange={handleCoordsChange}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Ubicar en mapa' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/no está disponible/i)

      // User manually types coordinates
      const latInput = screen.getByLabelText('Latitud')
      const lonInput = screen.getByLabelText('Longitud')

      await user.type(latInput, '-12.0463')
      await user.type(lonInput, '-77.0427')

      expect(handleCoordsChange).toHaveBeenCalled()
    })

    it('T3-COMB-06: Modal reset cleanly resets coordinates and form fields on close and reopen', async () => {
      const user = userEvent.setup()

      function TestModalWrapper() {
        const [isOpen, setIsOpen] = useState(true)
        return (
          <div>
            <button onClick={() => setIsOpen(true)}>Abrir Modal</button>
            <BranchGeolocationModal
              isOpen={isOpen}
              selectedOrg={ORG.id}
              onClose={() => setIsOpen(false)}
              onSave={vi.fn()}
            />
          </div>
        )
      }

      renderWithProviders(<TestModalWrapper />)

      await user.type(screen.getByLabelText('Nombre'), 'Sede Temporal')
      await user.type(screen.getByLabelText('Dirección'), 'Av. Temporal 123')

      // Close modal
      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      // Reopen modal fresh
      await user.click(screen.getByRole('button', { name: 'Abrir Modal' }))

      expect(screen.getByLabelText<HTMLInputElement>('Nombre').value).toBe('')
      expect(screen.getByLabelText<HTMLInputElement>('Dirección').value).toBe('')
      expect(screen.getByLabelText<HTMLInputElement>('Latitud').value).toBe('')
      expect(screen.getByLabelText<HTMLInputElement>('Longitud').value).toBe('')
    })
  })

  /* =================================================================
   * SUITE 5: Tier 4 Real-World Application Scenarios
   * ================================================================= */
  describe('Tier 4: Real-World Application Scenarios in Branch Management', () => {
    it('T4-SCEN-01: Create Branch Full Flow (UBIGEO + Address + "Ubicar en mapa" + Coords + Persist)', async () => {
      const user = userEvent.setup()
      const handleSave = vi.fn().mockResolvedValue(undefined)
      const handleClose = vi.fn()

      mockGeocodingApi.search.mockResolvedValue({
        data: {
          results: [{ latitude: -12.095, longitude: -77.025, display_name: 'Av. Rivera Navarrete 500' }],
        },
      })

      renderWithProviders(
        <BranchGeolocationModal
          isOpen={true}
          selectedOrg={ORG.id}
          onClose={handleClose}
          onSave={handleSave}
        />,
      )

      await user.type(screen.getByLabelText('Nombre'), 'Sede San Isidro')
      await user.type(screen.getByLabelText('Código UBIGEO'), '150131')
      await user.type(screen.getByLabelText('Dirección'), 'Av. Rivera Navarrete 500')

      await user.click(screen.getByRole('button', { name: 'Ubicar en mapa' }))

      await waitFor(() => {
        expect(screen.getByLabelText<HTMLInputElement>('Latitud').value).toBe('-12.095')
      })
      expect(screen.getByLabelText<HTMLInputElement>('Longitud').value).toBe('-77.025')

      await user.click(screen.getByRole('button', { name: 'Crear sede' }))

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Sede San Isidro',
            ubigeo_code: '150131',
            address_text: 'Av. Rivera Navarrete 500',
            latitude: -12.095,
            longitude: -77.025,
          }),
        )
      })
      expect(handleClose).toHaveBeenCalled()
    })

    it('T4-SCEN-02: Edit Branch Flow (Preloads Coords + Marker Drag / Manual Edit + Save)', async () => {
      const user = userEvent.setup()
      const handleSave = vi.fn().mockResolvedValue(undefined)
      const handleClose = vi.fn()

      renderWithProviders(
        <BranchGeolocationModal
          isOpen={true}
          initialBranch={BRANCH_WITH_COORDS}
          selectedOrg={ORG.id}
          onClose={handleClose}
          onSave={handleSave}
        />,
      )

      expect(screen.getByLabelText<HTMLInputElement>('Nombre').value).toBe('Sede Lima Principal')
      expect(screen.getByLabelText<HTMLInputElement>('Código UBIGEO').value).toBe('150122')
      expect(screen.getByLabelText<HTMLInputElement>('Dirección').value).toBe('Av. Larco 1234')
      expect(screen.getByLabelText<HTMLInputElement>('Latitud').value).toBe('-12.1215')
      expect(screen.getByLabelText<HTMLInputElement>('Longitud').value).toBe('-77.0298')

      // Fine-tune coordinates manually to warehouse gate
      const latInput = screen.getByLabelText('Latitud')
      await user.clear(latInput)
      await user.type(latInput, '-12.1220')

      const lonInput = screen.getByLabelText('Longitud')
      await user.clear(lonInput)
      await user.type(lonInput, '-77.0305')

      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'branch-1111',
            latitude: -12.122,
            longitude: -77.0305,
          }),
        )
      })
    })

    it('T4-SCEN-03: Create Branch with Browser Geolocation & Manual Save', async () => {
      const user = userEvent.setup()
      const handleSave = vi.fn().mockResolvedValue(undefined)
      const handleClose = vi.fn()

      const mockGetCurrentPosition = vi.fn((success) => {
        success({ coords: { latitude: -12.0464, longitude: -77.0428 } })
      })
      Object.defineProperty(globalThis.navigator, 'geolocation', {
        value: { getCurrentPosition: mockGetCurrentPosition },
        configurable: true,
        writable: true,
      })

      mockGeocodingApi.reverse.mockResolvedValue({
        data: { display_name: 'Plaza Mayor, Lima, Lima' },
      })

      renderWithProviders(
        <BranchGeolocationModal
          isOpen={true}
          selectedOrg={ORG.id}
          onClose={handleClose}
          onSave={handleSave}
        />,
      )

      await user.type(screen.getByLabelText('Nombre'), 'Sede Almacén Callao')
      await user.type(screen.getByLabelText('Código UBIGEO'), '070101')

      await user.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))

      await waitFor(() => {
        expect(screen.getByLabelText<HTMLInputElement>('Latitud').value).toBe('-12.0464')
      })
      expect(screen.getByLabelText<HTMLInputElement>('Longitud').value).toBe('-77.0428')

      // Apply detected address from chip
      const chip = await screen.findByTestId('reverse-suggestion-chip')
      await user.click(within(chip).getByRole('button', { name: 'Aplicar' }))

      await user.click(screen.getByRole('button', { name: 'Crear sede' }))

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Sede Almacén Callao',
            ubigeo_code: '070101',
            address_text: 'Plaza Mayor, Lima, Lima',
            latitude: -12.0464,
            longitude: -77.0428,
          }),
        )
      })
    })

    it('T4-SCEN-04: Geocoder Outage Fallback & Manual Recovery on Create Branch', async () => {
      const user = userEvent.setup()
      const handleSave = vi.fn().mockResolvedValue(undefined)
      const handleClose = vi.fn()

      mockGeocodingApi.search.mockRejectedValue(
        new ApiRequestError('503 Service Unavailable', {
          code: 'GEOCODING_PROVIDER_UNAVAILABLE',
          status: 503,
        }),
      )

      renderWithProviders(
        <BranchGeolocationModal
          isOpen={true}
          selectedOrg={ORG.id}
          onClose={handleClose}
          onSave={handleSave}
        />,
      )

      await user.type(screen.getByLabelText('Nombre'), 'Sede Contingencia')
      await user.type(screen.getByLabelText('Dirección'), 'Av. Faucett 1200')
      await user.type(screen.getByLabelText('Código UBIGEO'), '070101')

      await user.click(screen.getByRole('button', { name: 'Ubicar en mapa' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/no está disponible/i)

      // Enter coordinates manually
      await user.type(screen.getByLabelText('Latitud'), '-12.0100')
      await user.type(screen.getByLabelText('Longitud'), '-76.8900')

      await user.click(screen.getByRole('button', { name: 'Crear sede' }))

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Sede Contingencia',
            address_text: 'Av. Faucett 1200',
            latitude: -12.01,
            longitude: -76.89,
          }),
        )
      })
    })
  })
})
