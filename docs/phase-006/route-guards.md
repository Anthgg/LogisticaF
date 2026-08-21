# Guards de ruta

Todas las rutas cuelgan de `ProtectedRoute` (exige sesión). Dentro, las de logística
pasan por `LogisticsAccessRoute`, que además de la sesión comprueba el acceso al módulo
y, si la ruta lo declara, un permiso.

```tsx
<Route element={<LogisticsAccessRoute permission={LOGISTICS_PERMISSIONS.warehouses.read} />}>
  <Route path="/logistics/warehouses" element={<WarehousesPage />} />
</Route>
```

| Guard | Criterio | Rutas |
|---|---|---:|
| `LogisticsAccessRoute permission=` | un código de permiso | 38 |
| `LogisticsAccessRoute anyOf=` | cualquiera de varios códigos | 2 |
| `RoleRoute roles={['admin','supervisor']}` | nombre de rol (legacy) | 3 |
| `PermissionRoute permission="viewReports"` | capacidad legacy (`utils/permissions.ts`) | 1 |

Sin sesión: redirección a `/login` conservando el destino en `state.from`. Con sesión y
sin permiso: `ForbiddenPage` (403). La diferencia importa —una invita a identificarse, la
otra dice que ya sabemos quién eres y no puedes— y es la misma que aplica el cliente HTTP
(ver [401-403-handling.md](401-403-handling.md)).

Mientras el permiso se está cargando el guard no decide: no redirige ni deja pasar. Así
no aparece un 403 momentáneo antes de que llegue `/logistics/me/permissions`.

## Lo que queda por nombre de rol

Las 4 rutas legacy (`RoleRoute` y `PermissionRoute`) corresponden a los 52 endpoints que
el backend todavía protege por rol y no por permiso. `LEGACY_ROLE_ACCESS_COUNT = 4`.
Migrarlas está fuera de PR 3: exige decidir el permiso de cada endpoint en el backend, no
renombrar la comprobación en el cliente.
