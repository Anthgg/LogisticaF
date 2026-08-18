import { useEffect, useState } from 'react'
import { referenceCatalogsApi } from '../../api/reference-catalogs-api'
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

function placeholder(
  isLoading: boolean,
  error: string | null,
  isEmpty: boolean,
  idle: string,
  emptyLabel: string,
): string {
  if (isLoading) return 'Cargando…'
  if (error) return 'Error al cargar'
  if (isEmpty) return emptyLabel
  return idle
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

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        <select
          id={id}
          className="field__input"
          value={value}
          disabled={disabled || isLoading || Boolean(error)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">
            {placeholder(isLoading, error, items.length === 0, 'Selecciona un país', 'Sin países')}
          </option>
          {items.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="field__error">{error}</p>}
    </div>
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

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        <select
          id={id}
          className="field__input"
          value={value}
          disabled={disabled || isLoading || Boolean(error)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">
            {placeholder(
              isLoading,
              error,
              items.length === 0,
              'Selecciona una zona horaria',
              'Sin zonas para este país',
            )}
          </option>
          {items.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name} — {item.code}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="field__error">{error}</p>}
    </div>
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

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        <select
          id={id}
          className="field__input"
          value={value}
          disabled={disabled || isLoading || Boolean(error)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">
            {placeholder(isLoading, error, items.length === 0, 'Selecciona un tipo', 'Sin tipos')}
          </option>
          {items.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="field__error">{error}</p>}
    </div>
  )
}
