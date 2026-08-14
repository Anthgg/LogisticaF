# Auditoría post-F045 · Contrato frontend ↔ backend

Estado: **RUNTIME_FIXED_FRONTEND**.

Fuente de verdad: OpenAPI real de `Anthgg/Logistica` en
`5486774aff0d100fa5210107bd4397944267e7a0`, con 973 operaciones. La copia
generada y versionada es `scripts/contracts/backend-routes.phase045.json`.

```bash
npm run contract:manifest -- \
  --url http://127.0.0.1:8000/openapi.json \
  --backend-sha 5486774aff0d100fa5210107bd4397944267e7a0
npm run contract:audit
```

El manifiesto se regeneró contra el OpenAPI local F045 y produjo diff cero. El
auditor valida además que `source_backend_sha` sea exactamente el SHA anterior;
si cambia o falta, termina con exit 1.

## Resultado

| Medición | Antes de la cuarta pasada | Después |
|---|---:|---:|
| Runtime detectadas por el auditor original | 308 | — |
| MATCH | 259 | — |
| PATH_MISMATCH | 40 | 0 |
| STATIC_COLLIDES_WITH_PATH_PARAM | 8 | 0 |
| METHOD_MISMATCH | 1 | 0 |
| Total fuera de contrato | **47** | **0** |
| Runtime detectadas por el auditor reforzado | — | 857 |
| MATCH con el auditor reforzado | — | **857** |
| UNPARSED / UNRESOLVED | — | **0** |

El total final es mayor porque el auditor ahora resuelve constantes, ternarios,
helpers de query y paths pasados a wrappers. El criterio de cierre no cambia:
toda llamada runtime clasificada termina en `MATCH`. El wrapper genérico
`useQuery` se informa por separado y sus call sites concretos sí se auditan.

## Decisiones de producto aplicadas

La evidencia histórica de los 12 gaps se conserva aquí. Ninguno se resolvió
afirmando que el backend implementó algo nuevo: se corrigió o retiró únicamente
el consumidor frontend.

### GAP-01 · No conformidades de calidad

- Evidencia F045: no hay endpoints de no conformidades.
- Resultado: feature aislada retirada; API y navegación runtime eliminadas.
- Requests a endpoints inexistentes: 0.

### GAP-02 · Certificados anclados a versión

- Evidencia F045: certificados son subrecursos de
  `/quality-inspection-plans/controls/{control_id}`.
- Resultado: editor restaurado y rediseñado para `controlId`; list/create usan
  el control y update/delete usan `certificate_id`.
- Sin `controlId`: no request y estado explícito.

### GAP-03 · Rotación como reporte

- Evidencia F045: no existe `/putaway/rotation/*`; la rotación sí existe como
  política de putaway.
- Resultado: reporte futuro y sus APIs retirados; políticas preservadas.

### GAP-04 · Documentos de putaway

- Evidencia F045: no existen `/putaway/documents/*` ni
  `/orders/{id}/documents` en este dominio.
- Resultado: consumidores futuros retirados, sin afectar documentos logísticos
  generales.

### GAP-05 · Dashboard/historial/integridad extra de putaway

- Evidencia F045: no hay endpoints de dashboard ni historial de putaway.
- Resultado: widgets y rutas dependientes retirados. Tasks, sesiones, scans,
  placements, políticas y recomendaciones permanecen.

### GAP-06 · Historial y placement de cuarentena

- Evidencia F045: existe integridad del caso, no `/history` ni `/placements`.
- Resultado: timeline y diálogo huérfanos retirados; cualquier acción no
  publicada devuelve indisponibilidad explícita sin emitir request.

### GAP-07 · Archive/upload-session de evidencia

- Evidencia F045: `GET /quality-inspections/{id}/evidence` y
  `POST /evidence-links`; no existen archive ni upload-session.
- Resultado: se reutiliza la infraestructura real de evidencia; acciones no
  soportadas quedan explícitamente no disponibles.

### GAP-08 · Validación/PATCH de versión

- Evidencia F045: validación `GET` por plan; versiones admiten get, activate,
  hash y retire, no PATCH genérico ni validate por versión.
- Resultado: validación movida al plan; edición arbitraria de versión retirada
  o presentada como solo lectura.

### GAP-09 · Controles y scopes sin plan

- Evidencia F045: ambos son subrecursos de
  `/quality-inspection-plans/{plan_id}`.
- Resultado: consumidores exigen `planId`; sin plan no realizan peticiones.
  Muestreos, tolerancias y certificados exigen además el `controlId` real.

### GAP-10 · Verificaciones vehiculares

- Evidencia F045: `GET /vehicles/{vehicle_id}/verifications` y
  `POST /vehicle-verifications/{verification_id}/apply`; no existe detail ni
  evidence por verification id.
- Resultado: listado por vehículo y apply real. Datos ausentes se muestran como
  no disponibles, sin arrays vacíos ni requests inventadas.

### GAP-11 · Diferencias de recepción

- Evidencia F045: `POST /reception-difference-cases/from-receipt` y
  `GET /reception-difference-cases/summary`; no existen eligible-receipts ni
  quality-preview.
- Resultado: el flujo parte del receipt seleccionado y usa el resumen real. El
  preview no soportado se muestra como no disponible sin request.

### GAP-12 · Preview de split

- Evidencia F045: solo existe
  `POST /inbound-inventory-disposition-allocations/{id}/split`.
- Resultado: la previsualización es cálculo local con el input del usuario; la
  confirmación usa el POST real. No se emite GET `/split`.

## F041/F042/F043 preservadas

- F041: plan reutilizable, packaging, peso, temperatura, certificados,
  muestreo y tolerancias permanecen consumiendo recursos reales.
- F042: caso, bloqueo, aprobación, rechazo, liberación y autorizaciones
  permanecen; extras sin backend no ejecutan requests.
- F043: tasks, capacidad, compatibilidad, política de rotación, proximidad,
  sesiones, scans, complete y finalize permanecen.

El móvil F043 usa el flujo publicado:

1. `POST /putaway/tasks/{task_id}/sessions`
2. `POST /putaway/sessions/{session_id}/scans`
3. `POST /putaway/sessions/{session_id}/scans/{event_id}/validate-product`
4. `POST /putaway/sessions/{session_id}/scans/{event_id}/validate-location`
5. creación/confirmación de placement por el recurso real de la tarea
6. `POST /putaway/sessions/{session_id}/complete`
7. `POST /putaway/placements/{confirmation_id}/finalize`

CSRF, cookies, tenant/site scope, RBAC, Step-Up e idempotencia no se relajaron.

## Gate de CI

`.github/workflows/ci.yml` ejecuta, sin `continue-on-error`:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run test:run`
5. `npm run contract:audit`
6. `npm run build`

El step se llama **Run API Contract Audit** y usa exclusivamente el manifiesto
versionado: no requiere backend live, Cloud Run ni internet.
