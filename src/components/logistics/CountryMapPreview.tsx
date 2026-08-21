import { LocationMap } from './LocationMap'

interface CountryViewport {
  name: string
  latitude: number
  longitude: number
  zoom: number
}

const COUNTRY_VIEWPORTS: Record<string, CountryViewport> = {
  AR: { name: 'Argentina', latitude: -38.4161, longitude: -63.6167, zoom: 3.4 },
  BO: { name: 'Bolivia', latitude: -16.2902, longitude: -63.5887, zoom: 4.4 },
  BR: { name: 'Brasil', latitude: -14.235, longitude: -51.9253, zoom: 3.2 },
  CL: { name: 'Chile', latitude: -33.4489, longitude: -70.6693, zoom: 3.2 },
  CO: { name: 'Colombia', latitude: 4.5709, longitude: -74.2973, zoom: 4.2 },
  EC: { name: 'Ecuador', latitude: -1.8312, longitude: -78.1834, zoom: 5 },
  ES: { name: 'España', latitude: 40.4637, longitude: -3.7492, zoom: 4.7 },
  MX: { name: 'México', latitude: 23.6345, longitude: -102.5528, zoom: 4 },
  PE: { name: 'Perú', latitude: -9.19, longitude: -75.0152, zoom: 4.4 },
  PY: { name: 'Paraguay', latitude: -23.4425, longitude: -58.4438, zoom: 5 },
  US: { name: 'Estados Unidos', latitude: 39.8283, longitude: -98.5795, zoom: 3.2 },
  UY: { name: 'Uruguay', latitude: -32.5228, longitude: -55.7658, zoom: 5.2 },
  VE: { name: 'Venezuela', latitude: 6.4238, longitude: -66.5897, zoom: 4.3 },
}

export function CountryMapPreview({ countryCode }: { countryCode: string }) {
  const normalizedCode = countryCode.trim().toUpperCase()
  const viewport = COUNTRY_VIEWPORTS[normalizedCode] ?? COUNTRY_VIEWPORTS.PE

  return (
    <section aria-labelledby="country-map-title" className="space-y-2">
      <div>
        <h2 id="country-map-title" className="text-sm font-semibold text-slate-900">
          Contexto geográfico
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Vista referencial del país; no representa una dirección física.
        </p>
      </div>
      <LocationMap
        latitude={viewport.latitude}
        longitude={viewport.longitude}
        zoom={viewport.zoom}
        interactive={false}
        showMarker={false}
        height={280}
        ariaLabel={`Mapa de contexto de ${viewport.name}`}
      />
      <p className="text-xs text-slate-600" data-testid="country-map-preview">
        <span className="font-semibold text-slate-900">{viewport.name}</span> ({normalizedCode})
      </p>
    </section>
  )
}
