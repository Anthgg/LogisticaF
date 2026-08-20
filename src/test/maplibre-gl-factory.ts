/**
 * maplibre-gl-factory.ts
 *
 * Drop-in replacement for `maplibre-gl` used in Vitest (jsdom environment).
 * Real maplibre-gl requires WebGL and canvas APIs that jsdom cannot provide.
 *
 * This module re-exports the mock classes from maplibre-mock.ts in the same
 * shape that the real maplibre-gl exports:
 *
 *   import maplibregl from 'maplibre-gl'                 // default export
 *   import { Map, Marker } from 'maplibre-gl'            // named exports
 *   const { Map } = await import('maplibre-gl')          // dynamic import
 *
 * All three shapes are supported via named + default exports.
 */
import { MockMap, MockMarker, MockNavigationControl } from './maplibre-mock'

export const Map = MockMap
export const Marker = MockMarker
export const NavigationControl = MockNavigationControl
export const supported = () => true

const maplibreGl = {
  Map: MockMap,
  Marker: MockMarker,
  NavigationControl: MockNavigationControl,
  supported: () => true,
}

export default maplibreGl
