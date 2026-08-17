import { apiRequest } from './api-client'
import type {
  CountryCatalogItem,
  TimezoneCatalogItem,
  WarehouseTypeCatalogItem,
} from '../types/logistics-resources'

/**
 * Catálogos de referencia del backend (F005.1).
 *
 * Existen para que el frontend deje de mantener sus propias listas: país y zona
 * horaria eran texto libre, y los tipos de almacén estaban escritos a la vez en el
 * validador del backend y en `WarehousesPage`.
 */
export const referenceCatalogsApi = {
  listCountries: () =>
    apiRequest<CountryCatalogItem[]>({ path: '/logistics/catalogs/countries' }),

  /** `countryCode` acota las zonas a las del país elegido; el backend siempre añade UTC. */
  listTimezones: (countryCode?: string) =>
    apiRequest<TimezoneCatalogItem[]>({
      path: countryCode
        ? `/logistics/catalogs/timezones?country_code=${encodeURIComponent(countryCode)}`
        : '/logistics/catalogs/timezones',
    }),

  listWarehouseTypes: () =>
    apiRequest<WarehouseTypeCatalogItem[]>({
      path: '/logistics/catalogs/warehouse-types',
    }),
}
