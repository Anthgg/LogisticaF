# F006 PR 3 · Cierre

`BACKEND_CONTRACT_SHA = b381e5311c6dbae04e6185612054ba36bbae91b2`
`FRONTEND_BASE_SHA = 00b2e85398f18905c22c79c7a78d5eca4e07de9b`

## Qué se hizo

1. **Retirado el bypass comodín del frontend.** `checkPermissionMatch` concedía todos
   los permisos a quien tuviera un rol de ámbito global. Ahora comprueba pertenencia
   exacta. Es el equivalente en el cliente del bypass que PR 1 retiró del backend.
2. **Prueba de regresión sobre el proveedor real.** Las suites existentes inyectaban un
   contexto falso y nunca ejecutaban la comprobación; por eso el bypass pasaba en verde.
   6 de las 8 pruebas nuevas fallan contra el código anterior.
3. **401 y 403 diferenciados en el cliente HTTP.** Un 403 sin código propio ya no llega
   como `HTTP_403` anónimo, y `isStepUpError` / `isAccessDeniedError` permiten reaccionar
   sin releer el número de estado.
4. **Trinquete de contrato de permisos en CI.** `npm run permissions:audit` compara cada
   código que usa el frontend contra el catálogo del backend, vendorizado como artefacto
   derivado.

## Qué se encontró y no se tocó

La auditoría (§5) mostró que la infraestructura de permisos ya existía casi entera de
fases anteriores: 153 ficheros la usan, 40 rutas declaran permiso, los 56 módulos de
navegación declaran requisito (40 por permiso, 16 marcados `legacyAlwaysAllowed`), y
existen `ForbiddenPage`, `PermissionGate` y los guards. `SIN_REQUISITO = 0`.

Lo que faltaba no era sistema, era que el sistema no se anulara a sí mismo.

**131 códigos de permiso del frontend no existen en el catálogo del backend, y 23 de
ellos se exigen en pantallas reales.** Mientras el bypass estaba, daba igual. Sin él, esas
23 pantallas y acciones quedan ocultas para todo el mundo. No es un problema de seguridad
—el backend nunca concedió esos permisos y sus endpoints siguen protegidos por los
reales— sino de interfaz: esconde funciones que el backend sí permitiría.

No se ha corregido ninguno. Elegir a qué permiso real corresponde cada pantalla es una
decisión sobre la matriz de autorización, y `GUESSED_PERMISSION_MAPPINGS = 0`. Tres
dominios enteros (`supplier_evaluations`, `quality_sampling_plans`, `quality_tolerances`)
no tienen **ningún** permiso en el catálogo: eso se resuelve en el backend, no aquí.
Detalle en [permission-contract-drift.md](permission-contract-drift.md).

## Verificación

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `npm run lint` | OK (16 avisos preexistentes, ninguno en ficheros tocados) |
| `npm run test:run` | 763 pruebas en 103 ficheros, todo en verde |
| `npm run contract:audit` | OK |
| `npm run permissions:audit` | OK (131 / 23, en el trinquete) |
| `npm run build` | OK |

## Métricas

| Métrica | Valor |
|---|---:|
| `FRONTEND_ADMIN_BYPASS` | 0 |
| `WILDCARD_PERMISSION_SUPPORT` | FALSE |
| `GUESSED_PERMISSION_MAPPINGS` | 0 |
| `GUESSED_ROLE_MAPPINGS` | 0 |
| `LEGACY_ROLE_ACCESS_COUNT` | 4 |
| `UNKNOWN_PERMISSION_CODES` | 131 (trinquete) |
| `UNKNOWN_CODES_IN_USE` | 23 (trinquete) |
| `NAVIGATION_MODULES_WITHOUT_REQUIREMENT` | 0 |

## Pendiente, fuera de PR 3

- Resolver los 23 códigos inexistentes en uso, con la matriz del backend delante.
- Los 52 endpoints legacy protegidos por nombre de rol (4 rutas en el frontend).
- Despliegue: **no** se despliega en esta PR.
