import { useCallback, useEffect, useState } from 'react'
import { geographyApi } from '../../api/geography-api'
import { Alert } from '../common/Alert'
import { SearchableCombobox, type ComboboxOption } from '../ui/SearchableCombobox'
import type {
  GeoDepartmentResponse,
  GeoDistrictResponse,
  GeoProvinceResponse,
  UbigeoHierarchyResponse,
} from '../../types/logistics-resources'
import { getErrorMessage } from '../../utils/errors'

/**
 * Selector jerárquico Departamento → Provincia → Distrito.
 *
 * Lo que se persiste es el código UBIGEO de 6 dígitos del distrito, nunca los
 * nombres: «Miraflores» existe en cuatro distritos distintos del Perú, así que un
 * nombre no identifica un lugar. Departamento y provincia solo sirven para acotar
 * la lista y se derivan del código al reabrir el formulario.
 * Utiliza SearchableCombobox con búsqueda reactiva para una selección rápida.
 */
export function UbigeoSelector({
  value,
  resolved,
  onChange,
  disabled = false,
}: {
  /** Código UBIGEO de 6 dígitos ya seleccionado, si lo hay. */
  value: string | null
  /** Jerarquía que ya resolvió el backend, para precargar sin ida y vuelta extra. */
  resolved?: UbigeoHierarchyResponse | null
  onChange: (ubigeoCode: string | null) => void
  disabled?: boolean
}) {
  const [departments, setDepartments] = useState<GeoDepartmentResponse[]>([])
  const [provinces, setProvinces] = useState<GeoProvinceResponse[]>([])
  const [districts, setDistricts] = useState<GeoDistrictResponse[]>([])

  const [departmentCode, setDepartmentCode] = useState('')
  const [provinceCode, setProvinceCode] = useState('')

  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false)
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false)
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 1. Departamentos: una sola vez.
  useEffect(() => {
    let cancelled = false
    setIsLoadingDepartments(true)
    geographyApi
      .listDepartments()
      .then((items) => {
        if (!cancelled) setDepartments(items)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(getErrorMessage(caught))
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDepartments(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 2. Precarga en edición: el backend ya devolvió la jerarquía resuelta, así que
  //    basta con reponer los dos niveles superiores; el usuario no vuelve a elegir.
  useEffect(() => {
    if (resolved) {
      setDepartmentCode(resolved.department_code)
      setProvinceCode(resolved.province_code)
    } else if (!value) {
      setDepartmentCode('')
      setProvinceCode('')
    }
  }, [resolved, value])

  const loadProvinces = useCallback(async (code: string) => {
    if (!code) {
      setProvinces([])
      return
    }
    setIsLoadingProvinces(true)
    setError(null)
    try {
      setProvinces(await geographyApi.listProvincesByDepartment(code))
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
      setProvinces([])
    } finally {
      setIsLoadingProvinces(false)
    }
  }, [])

  const loadDistricts = useCallback(async (code: string) => {
    if (!code) {
      setDistricts([])
      return
    }
    setIsLoadingDistricts(true)
    setError(null)
    try {
      setDistricts(await geographyApi.listDistrictsByProvince(code))
    } catch (caught: unknown) {
      setError(getErrorMessage(caught))
      setDistricts([])
    } finally {
      setIsLoadingDistricts(false)
    }
  }, [])

  useEffect(() => {
    void loadProvinces(departmentCode)
  }, [departmentCode, loadProvinces])

  useEffect(() => {
    void loadDistricts(provinceCode)
  }, [provinceCode, loadDistricts])

  // Cambiar de departamento invalida provincia y distrito: mantener una provincia
  // del departamento anterior dejaría el formulario en un estado imposible.
  const changeDepartment = (code: string) => {
    setDepartmentCode(code)
    setProvinceCode('')
    setDistricts([])
    onChange(null)
  }

  const changeProvince = (code: string) => {
    setProvinceCode(code)
    onChange(null)
  }

  const departmentOptions: ComboboxOption[] = departments.map((d) => ({
    value: d.code,
    label: d.name,
    code: d.code,
  }))

  const provinceOptions: ComboboxOption[] = provinces.map((p) => ({
    value: p.code,
    label: p.name,
    code: p.code,
  }))

  const districtOptions: ComboboxOption[] = districts.map((dist) => ({
    value: dist.code,
    label: dist.name,
    code: dist.code,
  }))

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SearchableCombobox
          id="ubigeo-department"
          label="Departamento"
          value={departmentCode}
          options={departmentOptions}
          onChange={changeDepartment}
          disabled={disabled || isLoadingDepartments}
          isLoading={isLoadingDepartments}
          placeholder={
            isLoadingDepartments
              ? 'Cargando…'
              : departments.length === 0
                ? 'Sin departamentos'
                : 'Seleccionar departamento'
          }
          searchPlaceholder="Buscar departamento..."
          emptyMessage="Sin departamentos"
        />

        <SearchableCombobox
          id="ubigeo-province"
          label="Provincia"
          value={provinceCode}
          options={provinceOptions}
          onChange={changeProvince}
          disabled={disabled || !departmentCode || isLoadingProvinces}
          isLoading={isLoadingProvinces}
          placeholder={
            !departmentCode
              ? 'Elige departamento primero'
              : isLoadingProvinces
                ? 'Cargando…'
                : provinces.length === 0
                  ? 'Sin provincias en este departamento'
                  : 'Seleccionar provincia'
          }
          searchPlaceholder="Buscar provincia..."
          emptyMessage="Sin provincias en este departamento"
        />

        <SearchableCombobox
          id="ubigeo-district"
          label="Distrito"
          value={value ?? ''}
          options={districtOptions}
          onChange={(distCode) => onChange(distCode || null)}
          disabled={disabled || !provinceCode || isLoadingDistricts}
          isLoading={isLoadingDistricts}
          placeholder={
            !provinceCode
              ? 'Elige provincia primero'
              : isLoadingDistricts
                ? 'Cargando…'
                : districts.length === 0
                  ? 'Sin distritos en esta provincia'
                  : 'Seleccionar distrito'
          }
          searchPlaceholder="Buscar distrito..."
          emptyMessage="Sin distritos en esta provincia"
        />
      </div>
    </div>
  )
}
