# F006 PR 3.1 · Cierre

`BACKEND_BASE_SHA = b381e5311c6dbae04e6185612054ba36bbae91b2`
`BACKEND_MERGE_SHA = abea8bd932d0f781d03124ca98384bb49d4cebfb` (PR #25)
`FRONTEND_BASE_SHA = 0656aa0db73f4f3cef24602ceacbf0708378099b`

## Qué resolvió

PR 3 retiró el bypass que concedía todos los permisos a quien tuviera un rol de ámbito
global. Al hacerlo salió a la luz que el frontend declaraba 131 códigos de permiso que el
catálogo del backend no contiene, 23 de ellos exigidos por pantallas vivas: mientras el
bypass estaba, daba igual; sin él, esas pantallas quedaban ocultas para todo el mundo.

| Métrica | Antes | Después |
|---|---:|---:|
| `TOTAL_FRONTEND_PERMISSION_DRIFT` | 131 | **0** |
| `ACTIVE_SCREEN_PERMISSION_DRIFT` | 23 | **0** |

| Clasificación | Cantidad |
|---|---:|
| `CANONICAL_RENAME` | 18 |
| `STALE_UNUSED_FRONTEND_CODE` | 107 |
| Operaciones que el backend no publica | 6 |
| `BACKEND_PERMISSION_MISSING` | 0 |
| `TEST_ONLY_STALE_CODE` | 0 |
| `LEGACY_ROLE_COMPATIBILITY` | 0 |
| `NEEDS_MANUAL_REVIEW` | 0 |
| **Total** | **131** |

La suma reconcilia con el total inicial. El detalle, con el endpoint que justifica cada
decisión, está en
[permission-contract-reconciliation.md](permission-contract-reconciliation.md).

## No hizo falta ningún permiso nuevo

PR 3 concluyó que tres dominios faltaban en el backend. Era falso: existían con otro
nombre. Buscar por prefijo del dominio en lugar de por el endpoint que llama la pantalla
produjo esa conclusión, y la corrección está anotada en el documento original.

`BACKEND_PERMISSIONS_CREATED = 0` · `ROLE_PERMISSION_MAPPINGS_CHANGED = 0` ·
`ROLE_PROTECTED_OPERATIONS: 52 → 52` — ninguna de las 23 pantallas necesitaba migrar un
endpoint legacy, así que las 52 operaciones protegidas por nombre de rol siguen intactas
y fuera de alcance.

## El contrato deja de mantenerse a mano

```
rbac/permission_catalog.py                        fuente canónica
  └─ scripts/generate_permission_contract.py      backend, con gate en CI
       └─ docs/phase-006/permission-contract.json artefacto derivado
            └─ scripts/contracts/…phase006.json   copia vendorizada
                 └─ scripts/generate-permission-contract.mjs
                      └─ generated/permission-codes.ts   tipo, 555 códigos
                           └─ satisfies en logistics-permissions-map.ts
```

Un código que el backend no conozca **deja de compilar**. Comprobado introduciendo
`logistics.organizations.read_inventado` en el mapa: 1 error de tipos; al retirarlo, 0.

Coste en el paquete: ninguno. La unión de tipos se borra al compilar.

`PERMISSION_CATALOG_SOURCE_OF_TRUTH = rbac/permission_catalog.py`
`FRONTEND_PERMISSION_CONTRACT = GENERATED_DERIVATIVE`

## El trinquete se sustituyó por cero

PR 3 dejó el listón en 131/23 para no bloquear el arreglo del bypass. Ahora es 0/0.
Mantenerlo en 131 habría dejado a CI diciendo que 131 está estupendo y 132 es un problema.

## Verificación

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `npm run lint` | OK (16 avisos preexistentes, ninguno en ficheros tocados) |
| `npm run test:run` | 806 pruebas en 104 ficheros, todo en verde |
| `npm run contract:audit` | OK |
| `npm run permissions:contract:check` | `GENERATED_PERMISSION_CONTRACT_DRIFT=0` |
| `npm run permissions:audit` | 0 / 0 |
| `npm run build` | OK |

Una ejecución de la suite falló en `ShipmentDetailPage.test.tsx` por el flake de sesión ya
registrado como deuda (`SESSION_TEST_FLAKE`); en solitario y en las ejecuciones siguientes
pasa. No lo introduce esta PR y no se tocó.

## Regresión de autorización

| Comprobación | Resultado |
|---|---|
| `GLOBAL_SCOPE_DOES_NOT_IMPLY_GLOBAL_PERMISSIONS` | TRUE |
| `FRONTEND_WILDCARD_PERMISSION_BYPASS` | 0 |
| `CUSTOM_ROLE_SUPPORT` | PASS — un rol con 3 permisos muestra exactamente esos 3 |
| `ROLE_NAME_BYPASS_COUNT` | 0 |
| `AUTHORIZATION_PROVIDER_REAL_INTEGRATION_TESTS` | 51 |
| `HTTP_401_HANDLING` / `HTTP_403_HANDLING` | PASS (sin cambios respecto a PR 3) |

Las 51 pruebas montan el proveedor real. Antes de PR 3 no había ninguna: todas las suites
de permisos inyectaban un contexto falso, que es por lo que el bypass pasaba en verde.

## Estado de F006

```
PHASE_F006_PR1_COMPLETE=TRUE
PHASE_F006_PR2_COMPLETE=TRUE
PHASE_F006_PR3_COMPLETE=TRUE
PHASE_F006_PR3_1_COMPLETE=TRUE
F006_PERMISSION_CONTRACT_RECONCILED=TRUE
F006_CODE_COMPLETE=TRUE
F006_PRODUCTION_DEPLOYMENT_PENDING=TRUE
F006_PRODUCTION_DEPLOYMENT_BLOCKED=FALSE
```

No se despliega en esta PR.

## Deuda que sigue separada

`SQLALCHEMY_MAPPER_COLLISION` · `SESSION_TEST_FLAKE` · `FIXTURE_ADMIN_DATA_HYGIENE=80` ·
`RLS_BASELINE_DRIFT` · `SERVICE_ACCOUNT_LEAST_PRIVILEGE` ·
`PRODUCTION_ENVIRONMENT_PROTECTION` · `ROLE_PROTECTED_OPERATIONS=52`.

Y una nueva, encontrada durante esta auditoría: **parte de la interfaz de evaluación de
proveedores y de órdenes de compra está respaldada por datos fabricados en el cliente**
—`evaluationDocumentsApi` entero, `evaluationExportsApi`, seis de los siete módulos de OC—
en lugar de por llamadas al backend. No es un problema de permisos y no se tocó aquí, pero
conviene registrarlo: son pantallas que parecen funcionar y no lo hacen.
