# Reconciliación del contrato de permisos (F006 PR 3.1)

`BACKEND_BASE_SHA = b381e5311c6dbae04e6185612054ba36bbae91b2`
`FRONTEND_BASE_SHA = 0656aa0db73f4f3cef24602ceacbf0708378099b`

## Resultado

| Métrica | Antes | Después |
|---|---:|---:|
| `TOTAL_FRONTEND_PERMISSION_DRIFT` | 131 | **0** |
| `ACTIVE_SCREEN_PERMISSION_DRIFT` | 23 | **0** |
| Códigos declarados en el frontend | 358 | 236 |

| Clasificación | Cantidad |
|---|---:|
| `CANONICAL_RENAME` | 18 |
| `STALE_UNUSED_FRONTEND_CODE` | 107 |
| `BACKEND_PERMISSION_MISSING` | 0 |
| `TEST_ONLY_STALE_CODE` | 0 |
| `LEGACY_ROLE_COMPATIBILITY` | 0 |
| `NEEDS_MANUAL_REVIEW` | 0 |
| Operaciones que el backend no publica | 6 |
| **Total** | **131** |

`GUESSED_CLASSIFICATIONS = 0` · `GUESSED_PERMISSION_MAPPINGS = 0` ·
`BACKEND_PERMISSIONS_CREATED = 0` · `DUPLICATE_SEMANTIC_PERMISSION_CREATED = FALSE`

## Corrección de lo que PR 3 concluyó

PR 3 reportó tres «dominios ausentes» —`supplier_evaluations`, `quality_sampling_plans`,
`quality_tolerances`— y dijo que resolverlos exigía añadir permisos al backend. **Era
falso.** Los tres existen en el catálogo bajo otro nombre:

| PR 3 dijo | El catálogo tiene |
|---|---|
| `quality_sampling_plans.*` no existe | `logistics.quality_plan.create_sampling`, `…update_sampling`, `…delete_sampling` |
| `quality_tolerances.*` no existe | `logistics.quality_plan.create_tolerance`, `…update_tolerance`, `…delete_tolerance` |
| `supplier_evaluations.*` no existe | `logistics.quotation_evaluations.*`, `logistics.supplier_evaluation_templates.*` |

El error fue buscar por prefijo del dominio en vez de por el endpoint que la pantalla
llama. Ninguno de los 131 necesitó un permiso nuevo en el backend.

## Cómo se clasificó cada código

Nada se decidió por parecido de nombres. Para cada código:

1. se localizó el componente que lo exige y si es **alcanzable** desde el router
   (se recorrieron los imports desde `AppRouter.tsx`, incluidos los `import()` diferidos);
2. se identificó la llamada a la API que ese gate protege;
3. se resolvió el método y la ruta reales;
4. se buscó esa operación en el artefacto de cobertura del backend
   (`scripts/audit_permission_coverage.py --json`, 1007 operaciones), que dice qué guard
   la protege.

El guard del endpoint es la respuesta. `view_balance_preparation` no se tradujo a
`read_balance_preparation` porque los nombres se parezcan, sino porque
`GET /api/logistics/inventory/ledger/balance-preparation` —la llamada que hace esa
pantalla— exige `logistics.inventory_ledger.read_balance_preparation`.

## Los 18 renombrados

| Pantalla / acción | Código anterior | Código canónico | Endpoint que lo exige |
|---|---|---|---|
| Kardex · exportaciones | `inventory_ledger.export` | `inventory_kardex.export` | `POST /inventory/kardex/exports` |
| Ledger · verificar partición | `inventory_ledger.verify_partition` | `inventory_ledger.verify` | `POST /inventory/ledger/partitions/{id}/verify` |
| Ledger · preparación de saldo | `inventory_ledger.view_balance_preparation` | `inventory_ledger.read_balance_preparation` | `GET /inventory/ledger/balance-preparation` |
| Ledger · preparación de trazabilidad | `inventory_ledger.view_traceability_preparation` | `inventory_ledger.read_traceability_preparation` | `GET /inventory/ledger/traceability-preparation` |
| OC · generar desde plan | `purchase_orders.generate` | `purchase_orders.create` | `POST /purchase-orders/plan-generation` |
| OC · rechazar | `purchase_orders.reject` | `purchase_orders.approve` | `POST /purchase-orders/{id}/reject` |
| OC · devolver para cambios | `purchase_orders.return` | `purchase_orders.approve` | `POST /purchase-orders/{id}/return-for-changes` |
| OC · enviar a aprobación | `purchase_orders.submit_approval` | `purchase_orders.update` | `POST /purchase-orders/{id}/submit` |
| Calidad · muestreo (leer) | `quality_sampling_plans.read` | `quality_plan.read` | `GET /quality-inspection-plans/controls/{id}/samplings` |
| Calidad · muestreo (crear) | `quality_sampling_plans.create` | `quality_plan.create_sampling` | `POST /quality-inspection-plans/controls/{id}/samplings` |
| Calidad · tolerancias (leer) | `quality_tolerances.read` | `quality_plan.read` | `GET /quality-inspection-plans/controls/{id}/tolerances` |
| Calidad · tolerancias (crear) | `quality_tolerances.create` | `quality_plan.create_tolerance` | `POST /quality-inspection-plans/controls/{id}/tolerances` |
| Evaluaciones · crear | `supplier_evaluations.create` | `quotation_evaluations.create` | `POST /supplier-evaluations/evaluations` |
| Evaluaciones · calcular | `supplier_evaluations.calculate` | `quotation_evaluations.calculate` | `POST /supplier-evaluations/evaluations/{id}/calculate` |
| Evaluaciones · registrar decisión | `supplier_evaluations.record_decision` | `quotation_evaluation_decisions.record` | `POST /supplier-evaluations/evaluations/{id}/decisions` |
| Plantillas · leer | `supplier_evaluations.read` | `supplier_evaluation_templates.read` | `GET /supplier-evaluations/templates` |
| Plantillas · gestionar | `supplier_evaluations.manage_templates` | `supplier_evaluation_templates.manage` | `POST /supplier-evaluations/templates` |
| Conductores · categorías de licencia | `driver_license_categories.manage` | `drivers.update` | `POST /driver-license-categories/seed` |

Todos los códigos llevan el prefijo `logistics.`, omitido en la tabla por espacio.

### Separación de funciones preservada

`purchase_orders.reject` y `.return` van a `approve`, no a `create`: en el backend son la
misma decisión —aceptar o no una OC— y así crear sigue sin ser aprobar. `submit_approval`
va a `update` porque enviar a aprobación modifica la orden, no la aprueba. Quien solo
puede crear no obtiene ninguna de las tres.

### Consulta y mutación no se mezclan

Las páginas de particiones del ledger separan `canView` (`inventory_ledger.read`) de
`canVerify` (`inventory_ledger.verify`). Ver el listado no exige el permiso que verifica.
Lo mismo en calidad: leer usa `quality_plan.read`, crear usa `create_sampling` /
`create_tolerance`.

## Los 107 eliminados

Códigos declarados en el mapa sin ningún consumidor: ni en componentes alcanzables, ni en
componentes muertos, ni en pruebas. Se retiraron del mapa. Concentrados en
`inbound_receiving` (25), `files` (10), conductores (13) y evidencia (4): nomenclatura de
una versión anterior del catálogo que nunca se actualizó.

El `satisfies` del mapa contra el contrato generado garantiza que ninguno vuelva.

## Las 6 operaciones que el backend no publica

Estas no eran deriva de nomenclatura. La interfaz ofrece la acción y **el backend no tiene
el endpoint**; en varios casos el propio cliente lo dice o devuelve datos fabricados:

| Acción | Estado real del cliente |
|---|---|
| Despacho de OC (`send`) | `purchaseOrderDispatchApi` lanza «no publicado como endpoint» en los 7 métodos; el panel no lo renderiza nadie |
| Descalificar candidato | `evaluationScoresApi.disqualify` devuelve un objeto fabricado |
| Solicitar override de puntaje | `requestOverride` fabrica la respuesta |
| Emitir CCO | `evaluationDocumentsApi` es simulado entero |
| Delegaciones de aprobación | la ruta renderiza una página que dice que la función no existe |
| Reversión de descalificación | declarado, sin consumidor |

Se cerraban exigiendo un permiso inventado. Funcionaba por accidente —nadie puede tener
un permiso que no existe— pero mentía sobre el motivo y ensuciaba el contrato.

Ahora usan un centinela explícito (`src/features/logistics-permissions/unpublished-operations.ts`):

```ts
export const UNPUBLISHED_OPERATIONS = {
  purchaseOrderDispatch: 'UNPUBLISHED:purchase_order_dispatch',
  evaluationDisqualification: 'UNPUBLISHED:evaluation_disqualification',
  evaluationScoreOverride: 'UNPUBLISHED:evaluation_score_override',
  comparativeDocument: 'UNPUBLISHED:comparative_document',
} as const
```

No empieza por `logistics.`, así que el auditor de contrato lo ignora, y `hasPermission`
lo niega como cualquier cadena ausente del conjunto efectivo. La acción sigue cerrada; la
diferencia es que ahora consta por qué, y cuando el backend publique la operación se
sustituye por su permiso canónico.

**No se crearon permisos backend para estas seis.** Un permiso sin endpoint no autoriza
nada: sería un código nuevo en el catálogo cuya única función es aparentar que la función
existe.

## Rutas de evaluaciones

`supplier_evaluations.read` protegía 8 rutas. El backend no publica **ninguna** lectura de
evaluaciones —sus cuatro operaciones son de escritura—, pero sí publica la de plantillas.
Las rutas se separaron según eso:

- plantillas (2 rutas) → `logistics.supplier_evaluation_templates.read`;
- evaluaciones (6 rutas) → `anyOf` de las tres operaciones reales del módulo
  (`quotation_evaluations.create`, `.calculate`, `quotation_evaluation_decisions.record`).

Quien tenga cualquiera de esas tres necesita entrar; quien no tenga ninguna no tiene nada
que hacer allí. Ningún código inventado, ningún permiso de lectura fabricado.

## Delegaciones de aprobación

La ruta renderiza `ApprovalUnavailablePage`, que no muestra ningún dato. Se retiró el
guard de permiso y queda el acceso al módulo: no hay nada que autorizar.

## El contrato deja de escribirse a mano

```
rbac/permission_catalog.py                        (fuente canónica)
  └─ scripts/generate_permission_contract.py      (backend, con gate en CI)
       └─ docs/phase-006/permission-contract.json (artefacto derivado)
            └─ scripts/contracts/backend-permissions.phase006.json  (copia vendorizada)
                 └─ scripts/generate-permission-contract.mjs
                      └─ generated/permission-codes.ts  (tipo, 555 códigos)
                           └─ satisfies en logistics-permissions-map.ts
```

`PERMISSION_CATALOG_SOURCE_OF_TRUTH = rbac/permission_catalog.py`
`FRONTEND_PERMISSION_CONTRACT = GENERATED_DERIVATIVE`

Un código que el backend no conozca **deja de compilar**. Verificado introduciendo
`logistics.organizations.read_inventado` en el mapa: 1 error de tipos; al retirarlo, 0.

Coste en el paquete: **ninguno**. La unión de tipos se borra al compilar; no se embarca
ninguna lista de 555 cadenas.
