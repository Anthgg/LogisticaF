import { apiRequest } from './api-client'
import type {
  GeoDepartmentResponse,
  GeoDistrictResponse,
  GeoProvinceResponse,
  UbigeoHierarchyResponse,
} from '../types/logistics-resources'

export const geographyApi = {
  listDepartments: () =>
    apiRequest<GeoDepartmentResponse[]>({
      path: '/logistics/geography/departments',
      method: 'GET',
    }),

  listProvincesByDepartment: (departmentCode: string) =>
    apiRequest<GeoProvinceResponse[]>({
      path: `/logistics/geography/departments/${departmentCode}/provinces`,
      method: 'GET',
    }),

  listDistrictsByProvince: (provinceCode: string) =>
    apiRequest<GeoDistrictResponse[]>({
      path: `/logistics/geography/provinces/${provinceCode}/districts`,
      method: 'GET',
    }),

  getDistrictByCode: (ubigeoCode: string) =>
    apiRequest<UbigeoHierarchyResponse>({
      path: `/logistics/geography/districts/${ubigeoCode}`,
      method: 'GET',
    }),
}
