/**
 * Tests for geocoding-api.ts — F005.4
 *
 * Verifies coordinate helper functions and that API client shapes
 * are correct. Does NOT call real network endpoints.
 */
import { describe, it, expect } from 'vitest'
import {
  wgs84ToMapLibreLngLat,
  mapLibreLngLatToWgs84,
} from './geocoding-api'

describe('wgs84ToMapLibreLngLat', () => {
  it('returns [longitude, latitude] for MapLibre', () => {
    const [lng, lat] = wgs84ToMapLibreLngLat(-12.0464, -77.0428)
    expect(lng).toBe(-77.0428)
    expect(lat).toBe(-12.0464)
  })

  it('round-trips correctly', () => {
    const lat = -12.0464
    const lon = -77.0428
    const [lng, latBack] = wgs84ToMapLibreLngLat(lat, lon)
    const [latRt, lonRt] = mapLibreLngLatToWgs84({ lng, lat: latBack })
    expect(latRt).toBeCloseTo(lat, 7)
    expect(lonRt).toBeCloseTo(lon, 7)
  })
})

describe('mapLibreLngLatToWgs84', () => {
  it('returns [latitude, longitude] WGS84 from MapLibre LngLat', () => {
    const [lat, lon] = mapLibreLngLatToWgs84({ lng: -77.0428, lat: -12.0464 })
    expect(lat).toBe(-12.0464)
    expect(lon).toBe(-77.0428)
  })
})
