# Autorización en el frontend (F006 PR 3)

> El frontend **no es una barrera de seguridad**. Ocultar un botón no sustituye a la
> autorización del backend. Todo lo descrito aquí sirve para no ofrecer al usuario
> acciones que van a acabar en 403, no para impedir nada.

`BACKEND_CONTRACT_SHA = b381e5311c6dbae04e6185612054ba36bbae91b2`
`FRONTEND_BASE_SHA = 00b2e85398f18905c22c79c7a78d5eca4e07de9b`

## Origen de los permisos

`PRINCIPAL_PERMISSIONS_SOURCE = GET /api/logistics/me/permissions`

Devuelve el conjunto efectivo ya resuelto por el backend: `permissions`,
`sensitive_permissions`, `step_up_permissions` y los `roles` con su ámbito. El frontend
no deriva permisos de nombres de rol ni los calcula: los recibe.
`BACKEND_CHANGE_REQUIRED = FALSE`.

## Auditoría del mecanismo existente

Clasificación pedida en §5, sobre el frontend tal como estaba en `FRONTEND_BASE_SHA`:

| Clase | Qué es | Dónde |
|---|---|---:|
| A · solo sesión | `ProtectedRoute`: exige autenticación, nada más | 2 usos |
| B · por nombre de rol | `RoleRoute` (3 rutas) y `PermissionRoute` con capacidad legacy (1) | 4 rutas |
| C · por código de permiso | `useLogisticsPermissions` (128 ficheros), `LogisticsAccessRoute` (40 rutas), `PermissionGate` (4) | 153 ficheros |
| D · sin control | — | 0 |
| E · decide el backend | llamadas cuya respuesta 403 se maneja en la vista | ver [401-403-handling](401-403-handling.md) |
| F · duplicado / inconsistente | el bypass comodín del proveedor | 1, corregido |

La conclusión de la auditoría es que **la infraestructura ya existía casi entera** —se
construyó en fases anteriores— y que el trabajo de PR 3 no era añadir un sistema nuevo
sino arreglar lo que la anulaba. Las 4 rutas de clase B corresponden a los
52 endpoints legacy protegidos por nombre de rol en el backend; migrarlos está
explícitamente fuera de PR 3.

## El hallazgo: el ámbito no es un conjunto de permisos

En `LogisticsAuthorizationProvider` la comprobación de permisos empezaba así:

```ts
if (hasGlobal || permissions.has('*') || permissions.has('admin') || permissions.has('ALL'))
  return true
```

Las tres cadenas comodín no existen en el catálogo —555 permisos, ninguno comodín—, así
que nunca casaban. Pero `hasGlobal` sí:

```ts
roles.some((role) => role.scope_type === 'GLOBAL')
```

`GLOBAL` significa que una asignación **no está acotada a una organización**. No dice
nada sobre qué permisos trae. Un rol personalizado y estrecho asignado con ámbito global
recibía, en la interfaz, los 555 permisos.

El efecto era anular todo lo construido encima: cada `PermissionGate`, cada guard de
ruta y cada filtro de navegación devolvían `true`. Es el mismo bypass que F006 PR 1
retiró del backend (`if user.role == "admin": return user`), reaparecido en el cliente.
El backend seguía negando —la seguridad real está allí—, así que el síntoma visible era
un usuario con botones que respondían 403.

Ahora la comprobación es pertenencia exacta al conjunto efectivo:

```ts
const checkPermissionMatch = useCallback(
  (code: string): boolean => permissions.has(code),
  [permissions],
)
```

`hasGlobal` sigue usándose en `canAccessOrganization` / `canAccessBranch` /
`canAccessWarehouse` / `canAccessScope`, donde sí es la semántica correcta: ahí la
pregunta es territorial, no de permisos.

`WILDCARD_PERMISSION_SUPPORT = FALSE` · `FRONTEND_ADMIN_BYPASS = 0`

## Por qué ninguna prueba lo detectaba

Las 3 suites de permisos existentes (33 pruebas) inyectan un estado de contexto falso a
través de `LogisticsAuthorizationContext.Provider`. Ninguna montaba el proveedor real,
así que ninguna llegaba nunca a `checkPermissionMatch`. La suite pasaba entera con el
bypass dentro.

`LogisticsAuthorizationProvider.scope.test.tsx` monta el proveedor de verdad, con la API
y los hooks de sesión simulados. De sus 8 pruebas, 6 fallan contra el código anterior.

## Estado

| Métrica | Valor |
|---|---:|
| `FRONTEND_ADMIN_BYPASS` | 0 |
| `WILDCARD_PERMISSION_SUPPORT` | FALSE |
| `GUESSED_PERMISSION_MAPPINGS` | 0 |
| `GUESSED_ROLE_MAPPINGS` | 0 |
| `LEGACY_ROLE_ACCESS_COUNT` | 4 rutas |
| Pruebas | 759 en 103 ficheros |

Ver también [permission-gates.md](permission-gates.md),
[route-guards.md](route-guards.md), [401-403-handling.md](401-403-handling.md),
[permission-contract-drift.md](permission-contract-drift.md) y
[pr3-closeout.md](pr3-closeout.md).
