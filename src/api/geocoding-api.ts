/**
 * Geocoding API client — F005.4
 *
 * Calls backend endpoints:
 *   POST /api/logistics/geocoding/search
 *   POST /api/logistics/geocoding/reverse
 *
 * Never calls Nominatim or any map tile provider directly from the browser.
 */
import { apiRequest } from './api-client'

// ──────────────────────────────────────────────────────────────────────────────
// DTO types mirroring backend schemas (geocoding/schemas.py)
// ──────────────────────────────────────────────────────────────────────────────

export interface GeocodeAddressDTO {
  road: string | null
  house_number: string | null
  neighbourhood: string | null
  suburb: string | null
  district: string | null
  city: string | null
  province: string | null
  department: string | null
  postcode: string | null
  country: string | null
  country_code: string | null
}

export interface GeocodeLocationResultDTO {
  latitude: number
  longitude: number
  display_name: string
  place_id: string | null
  osm_type: string | null
  osm_id: string | null
  bounding_box: [number, number, number, number] | null
  address: GeocodeAddressDTO | null
  confidence: number | null
  raw_type: string | null
}

// ──────────────────────────────────────────────────────────────────────────────
// Request / Response envelopes
// ──────────────────────────────────────────────────────────────────────────────

export interface GeocodeSearchRequest {
  address: string
  ubigeo_code?: string | null
  /** 1–20, default 5 */
  limit?: number
}

export interface GeocodeSearchData {
  results: GeocodeLocationResultDTO[]
  count: number
}

export interface GeocodeSearchResponse {
  success: boolean
  data: GeocodeSearchData
}

export interface GeocodeReverseRequest {
  latitude: number
  longitude: number
  /** OSM zoom level 0-18 */
  zoom?: number
}

export interface GeocodeReverseResponse {
  success: boolean
  data: GeocodeLocationResultDTO | null
}

// ──────────────────────────────────────────────────────────────────────────────
// Coordinate helpers — explicit to avoid [lat,lon] vs [lng,lat] confusion
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Convert from WGS84 storage format [latitude, longitude] to MapLibre's
 * LngLatLike format [longitude, latitude].
 */
export function wgs84ToMapLibreLngLat(lat: number, lon: number): [number, number] {
  return [lon, lat]
}

/**
 * Convert from MapLibre's LngLat object to WGS84 [latitude, longitude] tuple.
 */
export function mapLibreLngLatToWgs84(lngLat: { lng: number; lat: number }): [number, number] {
  return [lngLat.lat, lngLat.lng]
}

/**
 * Canonical helper to construct a human-friendly address from structured postal components.
 * Prioritizes: road + house_number, neighbourhood/suburb, district, province/city, department, country.
 * Eliminates redundant locality names (e.g. "Miraflores, Miraflores, Lima, Lima").
 */
export function buildHumanAddress(
  addr: GeocodeAddressDTO | null | undefined,
  fallbackDisplayName?: string,
  manualHouseNumber?: string
): string {
  if (!addr) {
    return fallbackDisplayName || ''
  }

  const parts: string[] = []

  // 1. Street / Road + House Number
  const streetName = (addr.road || '').trim()
  const houseNum = (manualHouseNumber || addr.house_number || '').trim()

  if (streetName && houseNum) {
    parts.push(`${streetName} ${houseNum}`)
  } else if (streetName) {
    parts.push(streetName)
  } else if (houseNum) {
    parts.push(`N° ${houseNum}`)
  }

  // 2. Neighbourhood / Urbanización / Sector
  const urb = (addr.neighbourhood || addr.suburb || '').trim()
  if (urb && !parts.some((p) => p.toLowerCase() === urb.toLowerCase())) {
    parts.push(urb)
  }

  // 3. District
  const district = (addr.district || '').trim()
  if (district && !parts.some((p) => p.toLowerCase() === district.toLowerCase())) {
    parts.push(district)
  }

  // 4. Province / City
  const prov = (addr.province || addr.city || '').trim()
  if (prov && !parts.some((p) => p.toLowerCase() === prov.toLowerCase())) {
    parts.push(prov)
  }

  // 5. Department
  const dept = (addr.department || '').trim()
  if (dept && !parts.some((p) => p.toLowerCase() === dept.toLowerCase())) {
    parts.push(dept)
  }

  // 6. Country
  const country = (addr.country || 'Perú').trim()
  if (country && !parts.some((p) => p.toLowerCase() === country.toLowerCase())) {
    parts.push(country)
  }

  if (parts.length === 0) {
    return fallbackDisplayName || ''
  }

  return parts.join(', ')
}

// ──────────────────────────────────────────────────────────────────────────────
// API calls
// ──────────────────────────────────────────────────────────────────────────────

export const geocodingApi = {
  /**
   * Forward geocoding: address → candidates list.
   * Requires authentication + branch read/create/update permission.
   */
  search: (body: GeocodeSearchRequest) =>
    apiRequest<GeocodeSearchResponse>({
      path: '/logistics/geocoding/search',
      method: 'POST',
      body,
    }),

  /**
   * Reverse geocoding: WGS84 coordinates → address.
   * Requires authentication + branch read/create/update permission.
   */
  reverse: (body: GeocodeReverseRequest) =>
    apiRequest<GeocodeReverseResponse>({
      path: '/logistics/geocoding/reverse',
      method: 'POST',
      body,
    }),
}
