# Post-Fase 045 · Integración PDF frontend

Estado: cerrado contra el `main` definitivo del backend `d55e7f2b64ea6d8ce278fb626046c12d3dab1286`, que incorpora el hotfix de descarga y el de maquetación de firmas.

La sincronización descrita en la última sección ya se ejecutó; sus resultados están en «Evidencia».

## Baselines verificados

- Frontend base: `8cef5a6a9cf3e560fe8a982a180e2546ba3e4a78`.
- Branch: `feat/post-phase-045-pdf-frontend-integration`.
- Tag `phase-045-baseline`: objeto `52ecff655531f0489a1e50adda594a222fa66deb`; target `1713e62fc79efca8e1daa8e5ef9951a13e030c01`.
- Backend provisional: `4c85d1166798a2488b484074a0712bdad17da543`.
- Backend definitivo: `d55e7f2b64ea6d8ce278fb626046c12d3dab1286`.
- OpenAPI definitivo: 973 operaciones totales; 14 preview PDF, 19 download PDF, 33 PDF en total.

## Diff contractual definitivo

`4c85d116…` → `d55e7f2b…`, ambos con 973 operaciones:

- paths agregados: 0; paths eliminados: 0;
- operaciones agregadas: 0; operaciones eliminadas: 0;
- métodos cambiados: 0; parámetros de query cambiados: 0;
- PDF: 14 preview / 19 download / 33 total, sin variación.

El diff del backend entre ambos SHA toca cuatro archivos de render y un test:
`documents/rendering/rendering.py`, `templates/base/base_v1.html`,
`templates/shared/print.css`, `requirements.txt`, `tests/test_pdf_signature_layout.py`,
más el workflow de CI del backend. **Ningún router, esquema Pydantic ni mapa de
permisos cambió**, así que el diff funcional del contrato es 0: lo que cambió es
la geometría del PDF generado, no su interfaz.

El manifest solo modela method/path/query. La semántica binaria, `Content-Type` y `Content-Disposition` se verifican mediante OpenAPI, cliente PDF y tests específicos.

## Inventario de integración

| Módulo | Preview | Download | Estado de UI |
| --- | --- | --- | --- |
| Documents lifecycle | Sí | Sí; incluye `original=true` sensible | Integrado en listado, visor y detalle real |
| Company Profile | Sí | Sí | Integrado en el generador institucional real |
| Reception Appointments / CIT | Sí | Sí | Integrado en el resumen de cita del check-in real |
| Purchase Requisitions | Sí | Sí | Integrado en la pestaña Documento real |
| Warehouse label individual | No aplica | Sí | Integrado como descarga A6; no se simula preview |
| Warehouse labels batch | No aplica | Sí | `BACKEND_ONLY`: adaptador contractual; no existe selección múltiple real |
| Gate Check-In / CPV | No existe preview PDF | Sí | Integrado como descarga; el preview existente continúa siendo JSON |
| Talonarios / Series | No aplica | Sí | `BACKEND_ONLY`: adaptadores contractuales sin flujo renderizado |
| General templates | Sí | Sí | `BACKEND_ONLY`: adaptadores contractuales |
| Purchasing rendering | Sí | Sí | `BACKEND_ONLY`: adaptadores contractuales |
| Inbound rendering | Sí | Sí | `BACKEND_ONLY`: adaptadores contractuales |
| Inventory rendering | Sí | Sí | `BACKEND_ONLY`: adaptadores contractuales; preserva `blind_count_mode` |
| Outbound rendering | Sí | Sí | `BACKEND_ONLY`: adaptadores contractuales |
| Outbound package | Sí | Sí | `BACKEND_ONLY`: adaptadores contractuales |
| Dispatch rendering | Sí | Sí | `BACKEND_ONLY`: adaptadores contractuales |
| Transport rendering | Sí | Sí | `BACKEND_ONLY`: adaptadores contractuales |
| Transport package | Sí | Sí | `BACKEND_ONLY`: adaptadores contractuales |
| Delivery rendering | Sí | Sí | `BACKEND_ONLY`: adaptadores contractuales |

No se crearon páginas ni payloads artificiales para los adaptadores `BACKEND_ONLY`.

Reparto de las 33 operaciones: **10 con superficie de UI real** (documents
preview/download, company profile preview/download, CIT preview/download,
requisición preview/download, etiqueta individual, acta CPV) y **23
`BACKEND_ONLY`** (talonarios 2, etiquetas batch 1 y los 20 adaptadores de
renderizado de plantillas, purchasing, inbound, inventory, outbound, outbound
package, dispatch, transport, transport package y delivery).

## Cliente PDF

`requestPdf` reutiliza la misma tubería de `api-client.ts` para:

- `credentials: include`;
- CSRF en métodos mutables y su único retry canónico;
- refresh de sesión y notificación 401;
- `X-Step-Up-Proof-ID` opcional;
- `AbortSignal` y timeout;
- idioma de request/response;
- normalización de errores 400/401/403/404/409/422/500.

La respuesta estructurada incluye `blob`, `size`, `contentType`, `contentDisposition`, `filename` y `response`. Se exige `application/pdf`, tamaño mayor que cero y firma `%PDF-`.

El parser de `Content-Disposition` prioriza `filename*` UTF-8 válido, admite `filename`, aplica fallback contextual y elimina traversal, NUL, CR/LF, controles y caracteres reservados. Preview y download crean object URLs solo después de validar el Blob y los revocan según su ciclo de vida.

## Seguridad y UX

- Los botones combinan capabilities del recurso con permisos frontend canónicos.
- El original cancelado requiere capability específica, `logistics.audit.read_sensitive` y guardia de operación sensible.
- CIT usa `logistics.reception_appointments.preview` y `.download`.
- CPV usa `logistics.gate_documents.download` y guardia sensible.
- El backend conserva la autoridad final de tenant isolation y RBAC.
- La UX diferencia sesión expirada, permiso denegado, PDF inválido y error de servidor.
- Una intención de preview no dispara download; una intención de download no dispara preview.
- El batch vacío falla localmente con `EMPTY_PDF_SELECTION` y no emite red.

## Evidencia

Contra el backend definitivo `d55e7f2b…`:

- Contract audit: 890 llamadas runtime; 890 MATCH; 0 inválidas; 1 wrapper trazado en sus call sites.
- Tests: 603 passed, 0 failed, 0 skipped (91 archivos).
- TypeScript: 0 errores.
- Lint: 0 errores; 14 warnings preexistentes; 0 nuevos.
- Build: PASS.
- Smoke Chromium anónimo: PASS — 401 JSON, sin `Content-Disposition`, sin `%PDF-`, sin popup, sin descarga.
- Smoke autenticado: no ejecutado, sin credenciales de prueba autorizadas.

El test del gate de contrato tenía un presupuesto de 20 s que se agotaba bajo la
carga de la suite en paralelo, aunque el auditor tarda ~2 s aislado. Se amplió el
margen de tiempo; la comprobación no cambió.

Cuatro specs de Playwright ajenos al PDF (`actions.spec.ts` y tres de
`phase-038-inbound-docks.spec.ts`) fallan también en `origin/main` `8cef5a6a`
verificado en un worktree limpio: son deuda preexistente, no una regresión de
esta rama.

## Gate ejecutado contra el backend definitivo

1. Checkout backend en `main` = `d55e7f2b…`, sin tocar datos ni volúmenes. OK.
2. `/health` 200 y `/openapi.json` 200 con 973 operaciones. OK.
3. OpenAPI nuevo comparado con el provisional `4c85d116…`: sin cambios funcionales. OK.
4. No se emitió `POST_PHASE_045_PDF_FRONTEND_REQUIRES_BACKEND_CONTRACT_REVIEW`.
5. `scripts/contracts/backend-routes.phase045.json` regenerado desde el OpenAPI real. OK.
6. `source_backend_sha` y ambos `EXPECTED_BACKEND_SHA` actualizados. OK.
7. Preview 14, download 19, total 33, cotejados 1:1 contra el OpenAPI vivo. OK.
8. typecheck, lint, suite completa, contract audit y build. OK.
9. Smoke Chromium anónimo contra el backend nuevo. OK.
10. CI sobre el SHA frontend definitivo: ver el PR.
11. PR abierto para revisión.

No mergear. No iniciar F046.
