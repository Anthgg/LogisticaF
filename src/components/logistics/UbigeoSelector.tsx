import { useCallback, useEffect, useState } from 'react'
import { geographyApi } from '../../api/geography-api'
import { Alert } from '../common/Alert'
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

  return (
    <div className="form-grid">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="field">
        <label className="field__label" htmlFor="ubigeo-department">
          Departamento
        </label>
        <div className="field__control">
          <select
            id="ubigeo-department"
            className="field__input"
            value={departmentCode}
            disabled={disabled || isLoadingDepartments}
            onChange={(e) => changeDepartment(e.target.value)}
          >
            <option value="">
              {isLoadingDepartments ? 'Cargando…' : 'Selecciona un departamento'}
            </option>
            {departments.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="ubigeo-province">
          Provincia
        </label>
        <div className="field__control">
          <select
            id="ubigeo-province"
            className="field__input"
            value={provinceCode}
            disabled={disabled || !departmentCode || isLoadingProvinces}
            onChange={(e) => changeProvince(e.target.value)}
          >
            <option value="">
              {!departmentCode
                ? 'Selecciona primero un departamento'
                : isLoadingProvinces
                  ? 'Cargando…'
                  : provinces.length === 0
                    ? 'Sin provincias en este departamento'
                    : 'Selecciona una provincia'}
            </option>
            {provinces.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="ubigeo-district">
          Distrito
        </label>
        <div className="field__control">
          <select
            id="ubigeo-district"
            className="field__input"
            value={value ?? ''}
            disabled={disabled || !provinceCode || isLoadingDistricts}
            onChange={(e) => onChange(e.target.value || null)}
          >
            <option value="">
              {!provinceCode
                ? 'Selecciona primero una provincia'
                : isLoadingDistricts
                  ? 'Cargando…'
                  : districts.length === 0
                    ? 'Sin distritos en esta provincia'
                    : 'Selecciona un distrito'}
            </option>
            {districts.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
