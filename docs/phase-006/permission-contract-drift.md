# Deriva entre el mapa de permisos del frontend y el catálogo del backend

`node scripts/audit-permission-contract.mjs`

## Qué mide

El frontend traduce nombres simbólicos a códigos de permiso en
`src/features/logistics-permissions/logistics-permissions-map.ts`, escrito a mano. El
catálogo canónico vive en el backend (`rbac/permission_catalog.py`, 555 permisos) y se
vendoriza aquí como artefacto derivado:
`scripts/contracts/backend-permissions.phase006.json`.

Un código que el backend no conoce **no puede concederse nunca**. El gate que lo exige
queda cerrado para todo el mundo, siempre.

## Estado

| Métrica | Valor |
|---|---:|
| Permisos en el catálogo del backend | 555 |
| Códigos declarados en el mapa | 358 |
| `UNKNOWN_PERMISSION_CODES` | 131 |
| `UNKNOWN_CODES_IN_USE` | 23 |

Ambos números son trinquete en CI: pueden bajar, no subir.

| Dominio | Inexistentes | En uso |
|---|---:|---:|
| `inbound_receiving` | 25 | 0 |
| `supplier_evaluations` | 23 | 8 |
| `purchase_orders` | 19 | 5 |
| `inventory_ledger` | 11 | 4 |
| `files` | 10 | 0 |
| `quality_sampling_plans` | 6 | 2 |
| `quality_tolerances` | 6 | 2 |
| resto | 31 | 2 |

## Por qué no se veía

Hasta esta PR el proveedor concedía todos los permisos a cualquier usuario con un rol de
ámbito global (ver [frontend-authorization.md](frontend-authorization.md)). Con ese
atajo, un código inventado daba igual: el gate abría de todas formas para quien
importaba. Al retirarlo, cada código inexistente se convierte en una pantalla o un botón
que ya no aparece para nadie.

**Esto no es un agujero de seguridad.** El backend nunca concedió esos permisos y los
endpoints detrás de esas pantallas siguen protegidos por los permisos reales que
declaran. Es lo contrario: la interfaz ahora esconde funciones que el backend sí
permitiría.

## Las dos derivas son distintas

**Renombrado.** El mapa usa un verbo y el catálogo otro:

| Frontend | Catálogo |
|---|---|
| `logistics.inventory_ledger.view_balance_preparation` | `logistics.inventory_ledger.read_balance_preparation` |
| `logistics.inventory_ledger.view_traceability_preparation` | `logistics.inventory_ledger.read_traceability_preparation` |
| `logistics.evidence.create` | `logistics.files.evidence.create` |

**Dominio ausente.** El catálogo no tiene *ningún* permiso para ellos:

- `logistics.supplier_evaluations.*` — 0 en catálogo, 8 exigidos por la interfaz
- `logistics.quality_sampling_plans.*` — 0 en catálogo, 2 exigidos
- `logistics.quality_tolerances.*` — 0 en catálogo, 2 exigidos

No es un error de nomenclatura del frontend: son áreas funcionales completas cuyos
permisos el backend nunca definió.

## Qué no se ha hecho aquí, y por qué

No se ha corregido ninguno de los 131. Elegir a qué permiso real corresponde cada
pantalla es una decisión sobre la matriz de autorización —quién debe poder hacer qué—,
no un renombrado mecánico. La orden de PR 3 fija `GUESSED_PERMISSION_MAPPINGS = 0`, y
adivinar aquí es exactamente lo que produciría un mapeo plausible y equivocado.

Tampoco se ha añadido una excepción del tipo «si el código no existe, deja pasar»: eso
sería reintroducir el bypass con otro nombre.

Las 23 pantallas afectadas están listadas con su fichero en la salida del script.
Resolverlas requiere, para cada una, comparar contra la matriz del backend y decidir
entre corregir el código en el frontend o añadir el permiso al catálogo.
