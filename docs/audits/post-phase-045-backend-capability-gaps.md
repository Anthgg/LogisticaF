# Auditoría post-F045 · Contrato frontend ↔ backend

Fuente de verdad: **OpenAPI real** del backend `Anthgg/Logistica` @
`5486774aff0d100fa5210107bd4397944267e7a0` (973 operaciones), capturado en
`scripts/contracts/backend-routes.phase045.json`.

Reproducir con:

```bash
npm run contract:manifest -- --url http://127.0.0.1:8000/openapi.json --backend-sha <sha>
npm run contract:audit
```

## Estado

| | Llamadas |
|---|---|
| Runtime totales | 308 |
| MATCH | 259 |
| Fuera de contrato al empezar la tercera pasada | 74 |
| **Corregidas en esta pasada** | **27** |
| **Pendientes** | **47** |

Las 27 corregidas eran rutas mal escritas contra recursos que **sí existen**.
Ninguna capacidad de producto se retiró para bajar el contador.

---

## 1. Corregido · rutas inventadas sobre recursos reales

| Frontend (incorrecto) | Backend real | Fase |
|---|---|---|
| `/quality-inspections/inspections/{id}` | `/quality-inspections/{id}` | F042 |
| `/quality-quarantine/cases/{id}` | `/quality-quarantine-cases/{id}` | F042 |
| `/quality-availability/future-*-preparation/{id}` | `/quality-quarantine-cases/{id}/future-*-preparation` | F042 |
| `/quality-availability/putaway-preparation/{id}` | `/quality-quarantine-cases/{id}/putaway-preparation` | F042 |
| `/quality-quarantine-cases/{id}/disposition-decisions` | `/quality-quarantine-cases/{id}/decisions` | F042 |
| `/quality-inspection-evidence/evidence?inspection_id=` | `/quality-inspections/{id}/evidence` | F042 |
| `/quality-plan-versions/{id}` | `/quality-inspection-plans/versions/{id}` | F041 |
| `/quality/versions/{id}/*` | `/quality-inspection-plans/versions/{id}/*` | F041 |
| `/quality/controls/{id}` | `/quality-inspection-plans/controls/{id}` | F041 |
| `/quality/scopes/{id}` | `/quality-inspection-plans/scopes/{id}` | F041 |
| `/quality-inspections/controls/{id}` | `/quality-inspection-controls/{id}` | F042 |
| `/quality-inspection-plans/category-plans` | `/quality-inspection-plans/resolve?product_category_id=` | F041 |
| `/quality-inspection-plans/preview` | `/quality-inspection-plans/resolve?product_id=` | F041 |

---

## 2. Capacidades verificadas como PRESENTES en backend

Contra el plan de fases, estas capacidades **no son gaps**: existen y ahora se
consumen bien o pueden consumirse.

### F041 · Planes de calidad
Plan reutilizable, controles, **tolerancias**, **muestreos**, **certificados**,
condiciones, ámbitos, versiones, activación/retiro, resolución por producto y
categoría, métricas, integridad y snapshot. 52 endpoints publicados.

### F042 · Cuarentena
Casos, activación, cierre, **decisiones de disposición**, **autorizaciones de
liberación y rechazo** (con ejecución separada), reinspección, preparaciones
futuras, integridad y zonas de cuarentena. 18 + 4 endpoints.

### F043 · Putaway dirigido
Tareas, asignación, inicio, pausa, reanudación, finalización, **capacidad**,
**compatibilidad**, **proximidad**, políticas y recomendaciones. Y el flujo
móvil completo: `POST /putaway/tasks/{id}/sessions` → `POST
/putaway/sessions/{id}/scans` → `validate-product` / `validate-location` →
`POST /putaway/sessions/{id}/complete` → `POST /putaway/placements/{id}/finalize`.

**El escaneo móvil producto+ubicación de F043 NO es un gap de backend**: está
publicado. El frontend lo tenía deshabilitado por apuntar a `/putaway/scan`,
que nunca existió. Migrarlo requiere que la UI abra una sesión sobre una tarea.

---

## 3. Gaps y pendientes (47 llamadas)

Ninguna de estas rutas existe en el backend `5486774`. Se listan con la
clasificación que les corresponde para que la decisión sea explícita.

### GAP-01 · No conformidades de calidad
- **Fase**: F042 (documento de no conformidad)
- **Frontend**: `qualityNonConformitiesApi` (5 llamadas: issue, preview, detalle, cancel, reprint)
- **Evidencia backend**: `grep non-conform` sobre el OpenAPI → **0 endpoints**
- **Riesgo**: la pantalla ofrece emitir un documento que no puede emitirse
- **Clasificación**: `BACKEND_CAPABILITY_MISSING`
- **Recomendación**: si F042 exige el documento formal de no conformidad, hace falta hotfix backend; si no, retirar la UI

### GAP-02 · Certificados anclados a versión en vez de control
- **Fase**: F041
- **Frontend**: `QualityCertificateRequirementsEditor` recibe `versionId` y llama a `certificate-requirements`
- **Evidencia backend**: el recurso real es `POST /quality-inspection-plans/controls/{control_id}/certificates` y `PATCH|DELETE /certificates/{certificate_id}`
- **Clasificación**: **no es gap de backend** — es un desajuste del modelo del frontend
- **Recomendación**: pasar `controlId` al editor y consumir el recurso real

### GAP-03 · Rotación como reporte
- **Fase**: F043
- **Frontend**: `putawayRotationApi` (4 llamadas: warehouses, compliance, expiring, products)
- **Evidencia backend**: 0 endpoints `/putaway/rotation/*`. La rotación **como regla** existe vía `/putaway/policies`
- **Clasificación**: `REMOVE_FUTURE_FEATURE` — F043 exige rotación como criterio de asignación, no un dashboard de rotación

### GAP-04 · Documentos de putaway
- **Fase**: F043 · **Frontend**: `putawayDocumentsApi` (5 llamadas)
- **Evidencia backend**: 0 endpoints `/putaway/documents/*` ni `/orders/{id}/documents`
- **Clasificación**: `REMOVE_FUTURE_FEATURE`

### GAP-05 · Dashboard e integridad de putaway
- **Frontend**: `putawayHistoryApi` (2 llamadas) · **Backend**: 0 endpoints
- **Clasificación**: `REMOVE_FUTURE_FEATURE`

### GAP-06 · Historial y placements de cuarentena
- **Fase**: F042 · **Frontend**: `QualityQuarantineHistoryTimeline`, `ConfirmQuarantinePlacementDialog`
- **Evidencia backend**: existe `/quality-quarantine-cases/{id}/integrity`, no `/history` ni `/placements`
- **Clasificación**: `BACKEND_CAPABILITY_MISSING` (trazabilidad del caso)

### GAP-07 · Evidencia: archivar y sesión de carga
- **Fase**: F042 · **Frontend**: `qualityInspectionEvidenceApi`
- **Evidencia backend**: existe `GET /quality-inspections/{id}/evidence` y `POST /evidence-links`; no `archive` ni `upload-session`
- **Clasificación**: `BACKEND_CAPABILITY_MISSING`

### GAP-08 · Validación por versión de plan
- **Fase**: F041 · **Frontend**: `versions/{id}/validate`, `PATCH versions/{id}`
- **Evidencia backend**: la validación es **por plan** (`GET /{plan_id}/validate`); las versiones solo admiten `activate`, `hash`, `retire`
- **Clasificación**: `BACKEND_CAPABILITY_MISSING` o rediseño del frontend a validación por plan

### GAP-09 · Listados sin ámbito de plan
- **Frontend**: `GET /quality-controls`, `GET /quality-plan-scopes` (4 llamadas)
- **Evidencia backend**: ambos son subrecursos: `/{plan_id}/controls`, `/{plan_id}/scopes`
- **Clasificación**: rediseño del frontend, no gap

### GAP-10 · Verificaciones vehiculares
- **Frontend**: detalle por `verification_id` y evidencias
- **Evidencia backend**: solo `POST /vehicle-verifications/{id}/apply` y `GET /vehicles/{vehicle_id}/verifications`
- **Clasificación**: `BACKEND_CAPABILITY_MISSING`

### GAP-11 · Diferencias de recepción
- **Frontend**: `eligible-receipts`, `{id}/quality-preview`
- **Evidencia backend**: existen `/from-receipt` y `/summary`, no esos dos
- **Clasificación**: `BACKEND_CAPABILITY_MISSING` (F040)

### GAP-12 · Split de disposición como previsualización
- **Frontend**: `GET /inbound-inventory-disposition/allocations/{id}/split`
- **Evidencia backend**: `POST /inbound-inventory-disposition-allocations/{id}/split` — ejecuta el split, no lo previsualiza
- **Clasificación**: rediseño del frontend

---

## 4. Qué falta para cerrar el contrato a cero

Las 47 pendientes **no se resuelven corrigiendo rutas**: cada una exige decidir
entre (a) rediseñar el consumidor para el recurso real, (b) retirar la UI, o
(c) pedir un hotfix de backend. Esa decisión es de producto.

Mientras tanto el frontend **sigue emitiendo esas peticiones**, así que
`npm run contract:audit` devuelve exit 1 y el gate de CI no se activa: un gate
que falla desde el primer día no protege nada.
