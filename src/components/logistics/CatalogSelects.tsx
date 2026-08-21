import { useEffect, useState } from 'react'
import { referenceCatalogsApi } from '../../api/reference-catalogs-api'
import { SearchableCombobox, type ComboboxOption } from '../ui/SearchableCombobox'
import type {
  CountryCatalogItem,
  TimezoneCatalogItem,
  WarehouseTypeCatalogItem,
} from '../../types/logistics-resources'
import { getErrorMessage } from '../../utils/errors'

/**
 * Selectores de catálogo de referencia (F005.1).
 *
 * Los tres comparten el mismo contrato: muestran el nombre humano y persisten el
 * código canónico del backend. Ninguno lleva la lista embebida.
 * Utilizan SearchableCombobox controlado en React para eliminar el menú nativo del SO.
 */

type SelectState<T> = {
  items: T[]
  isLoading: boolean
  error: string | null
}

function useCatalog<T>(load: () => Promise<T[]>, deps: unknown[]): SelectState<T> {
  const [items, setItems] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    load()
      .then((result) => {
        if (!cancelled) setItems(result)
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(caught))
          setItems([])
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { items, isLoading, error }
}

export function CountrySelect({
  value,
  onChange,
  disabled = false,
  id = 'country-select',
  label = 'País',
}: {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  id?: string
  label?: string
}) {
  const { items, isLoading, error } = useCatalog<CountryCatalogItem>(
    () => referenceCatalogsApi.listCountries(),
    [],
  )

  const options: ComboboxOption[] = items.map((item) => ({
    value: item.code,
    label: item.name,
    code: item.code,
  }))

  const placeholder = isLoading
    ? 'Cargando…'
    : error
      ? 'Error al cargar países'
      : items.length === 0
        ? 'Sin países'
        : 'Selecciona un país'

  return (
    <SearchableCombobox
      id={id}
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled || isLoading || Boolean(error)}
      isLoading={isLoading}
      error={error}
      placeholder={placeholder}
      searchPlaceholder="Buscar país..."
      emptyMessage="Sin países"
    />
  )
}

export function TimezoneSelect({
  value,
  countryCode,
  onChange,
  disabled = false,
  id = 'timezone-select',
  label = 'Zona horaria',
}: {
  value: string
  /** Acota las zonas al país elegido. */
  countryCode?: string
  onChange: (code: string) => void
  disabled?: boolean
  id?: string
  label?: string
}) {
  const { items, isLoading, error } = useCatalog<TimezoneCatalogItem>(
    () => referenceCatalogsApi.listTimezones(countryCode || undefined),
    [countryCode],
  )

  // Cambiar de país puede dejar seleccionada una zona que ya no pertenece al
  // catálogo filtrado. Mantenerla dejaría el formulario en un estado imposible.
  useEffect(() => {
    if (isLoading || error || !value) return
    if (!items.some((item) => item.code === value)) {
      onChange('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, isLoading, error, value])

  const options: ComboboxOption[] = items.map((item) => ({
    value: item.code,
    label: `${item.name} (${item.code})`,
    code: item.code,
  }))

  const placeholder = isLoading
    ? 'Cargando…'
    : error
      ? 'Error al cargar zonas horarias'
      : items.length === 0
        ? 'Sin zonas horarias'
        : 'Selecciona una zona horaria'

  return (
    <SearchableCombobox
      id={id}
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled || isLoading || Boolean(error)}
      isLoading={isLoading}
      error={error}
      placeholder={placeholder}
      searchPlaceholder="Buscar zona horaria..."
      emptyMessage="Sin zonas horarias"
    />
  )
}

export function WarehouseTypeSelect({
  value,
  onChange,
  disabled = false,
  id = 'warehouse-type-select',
  label = 'Tipo',
}: {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  id?: string
  label?: string
}) {
  const { items, isLoading, error } = useCatalog<WarehouseTypeCatalogItem>(
    () => referenceCatalogsApi.listWarehouseTypes(),
    [],
  )

  const options: ComboboxOption[] = items.map((item) => ({
    value: item.code,
    label: item.name,
    code: item.code,
  }))

  const placeholder = isLoading
    ? 'Cargando…'
    : error
      ? 'Error al cargar tipos'
      : items.length === 0
        ? 'Sin tipos'
        : 'Selecciona un tipo'

  return (
    <SearchableCombobox
      id={id}
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled || isLoading || Boolean(error)}
      isLoading={isLoading}
      error={error}
      placeholder={placeholder}
      searchPlaceholder="Buscar tipo de almacén..."
      emptyMessage="Sin tipos"
    />
  )
}
