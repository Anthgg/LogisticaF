# Rutas frontend de estructura logística

| Operación | Ruta | Permiso existente |
| --- | --- | --- |
| Crear organización | `/logistics/organizations/new` | `logistics.organizations.create` |
| Editar organización | `/logistics/organizations/:organizationId/edit` | `logistics.organizations.update` |
| Crear sede | `/logistics/branches/new` | `logistics.branches.create` |
| Editar sede | `/logistics/branches/:branchId/edit` | `logistics.branches.update` |
| Crear almacén | `/logistics/warehouses/new` | `logistics.warehouses.create` |
| Editar almacén | `/logistics/warehouses/:warehouseId/edit` | `logistics.warehouses.update` |

Los botones de alta y edición navegan a estas rutas. `Cancelar` y un guardado exitoso vuelven al listado correspondiente. Las rutas están dentro de los mismos `LogisticsPermissionRoute` que protegían el CRUD; no se agregaron permisos ni excepciones por rol.

La edición de almacén soporta deep link: carga el almacén por ID, deriva organización/sede de la respuesta y usa el PATCH estructural anidado para conservar el aislamiento de tenant.
