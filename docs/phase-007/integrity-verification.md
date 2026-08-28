# F007 · Verificación de integridad de auditoría

## Alcance

Este hotfix corrige la descripción de la garantía en la interfaz y su
documentación. No cambia el algoritmo SHA-256, el backend, los contratos, los
permisos, RLS, la exportación, el esquema de PostgreSQL ni las migraciones.
No inicia F008.

## INTEGRITY VERIFICATION

La comprobación compara el hash SHA-256 almacenado con el calculado a partir del
contenido canónico actual del evento. La cobertura corresponde a los campos que
selecciona la serialización existente; no se extiende automáticamente a todas las
columnas de la fila.

Una coincidencia permite informar que ambos hashes concuerdan. Una discrepancia
demuestra una inconsistencia, sin identificar por sí sola su causa. La
comprobación puede detectar corrupción accidental y cambios en el contenido
cubierto que no actualicen también el hash.

Un actor con acceso suficiente para reescribir tanto el evento como su hash puede
hacer que ambos vuelvan a coincidir. Esta comprobación no acredita resistencia
frente a ese actor, no demuestra autoría y no constituye una firma digital externa.

Se mantiene el mecanismo existente:

```text
HASH_INTEGRITY_MODE=ROW_HASH_ONLY
TAMPER_EVIDENCE_AGAINST_DB_WRITER=FALSE
```

## Política de aplicación

La auditoría sigue siendo append-only en la aplicación: no se habilitan
operaciones de actualización ni eliminación de eventos mediante la API.
Esta política limita las operaciones disponibles en la aplicación; es una
propiedad distinta de la resistencia frente a escrituras directas en PostgreSQL.

```text
AUDIT_APPEND_ONLY_APPLICATION=TRUE
AUDIT_UPDATE_API_COUNT=0
AUDIT_DELETE_API_COUNT=0
```

## Inventario del texto anterior

Referencia del inventario: frontend
`2f948007688564905b9873fa2a653c6d61b57393`. Las líneas de esta tabla corresponden a
esa revisión, antes del hotfix.

Se cuenta una etiqueta por cada cadena visible de auditoría que promete que el
registro no puede cambiar o que la comprobación descarta escrituras directas en
la base de datos. El conteo incluye carga, ayuda, resultado y vista sin permiso.

```text
MISLEADING_INTEGRITY_LABELS_BEFORE=4
```

| Ubicación en la revisión base | Afirmación que debe corregirse |
| --- | --- |
| `src/components/audit/AuditEventDetailModal.tsx:143` | La carga presenta el registro como imposible de modificar. |
| `src/components/audit/AuditEventDetailModal.tsx:323` | La ayuda atribuye protección frente a cambios directos en la base de datos. |
| `src/components/audit/AuditEventDetailModal.tsx:356` | El resultado positivo promete que el registro permanece intacto y no puede modificarse. |
| `src/pages/AuditEventsPage.tsx:230` | La descripción de la vista sin permiso atribuye al registro esa misma garantía absoluta. |

Además se precisan dos encabezados: el del modal en la línea 320 y la descripción
general de la página en la línea 245. Describir SHA-256 como criptográfico no
constituye por sí solo una promesa falsa, por lo que estas dos precisiones no se
suman al conteo de cuatro.

La revisión abarca todo el frontend, incluidos tests, ayuda, badges, modales,
README, documentación, snapshots y archivos de traducción. No había documentación
F007, snapshots de auditoría ni traducciones de estos textos en la revisión base;
el texto de auditoría se definía directamente en los dos componentes.

No se cuentan ni se cambian las menciones a versiones históricas, snapshots o
políticas append-only de otros módulos. Tampoco se cuentan las referencias
técnicas a hashes, rutas de API, identificadores, pruebas negativas ni
advertencias que distinguen un hash de una firma digital.

## Mensajes y contrato

Para `valid=true`, el resultado debe mostrar:

> ✓ Integridad verificada
>
> El hash almacenado coincide con el contenido actual del evento.

Para `valid=false`, el mensaje debe indicar que el hash almacenado no coincide con
el contenido actual. No debe atribuir automáticamente una causa a la discrepancia.
Una petición fallida tampoco permite concluir que exista una discrepancia de hash.

La ayuda describe la comparación entre el hash SHA-256 almacenado y el calculado
a partir del contenido actual. SHA-256 se presenta como algoritmo de hash, sin
atribuirle una firma digital.

Se conserva `POST /api/logistics/audit-events/{event_id}/verify-integrity`.
El resultado se decide mediante `valid`; `stored_hash` y `computed_hash` explican
la comparación. No se crean campos nuevos ni se interpreta una respuesta exitosa
como prueba de validez. La respuesta existente no incluye `checked_at`, por lo que
la interfaz no debe fabricar una fecha de verificación a partir de ese campo.

## Comprobaciones de aceptación

Las pruebas deben cubrir el resultado válido, la discrepancia, los textos de
carga y la vista sin permiso, además de impedir la reaparición de promesas de
garantías que el mecanismo no ofrece. El gate de texto se aplica a las etiquetas
de auditoría; no redefine políticas de otros módulos ni interpreta contenido
arbitrario de eventos como etiquetas de la interfaz.

La regresión requerida es:

```sh
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run contract:audit
npm run permissions:audit
```

Los criterios de aceptación incluyen `MISLEADING_INTEGRITY_LABELS=0`,
`PERMISSION_DRIFT=0`, `ACTIVE_PERMISSION_DRIFT=0` y `PATH_MISMATCH=0`, sin cambios
de backend, base de datos ni migraciones.

Esta nota no certifica resultados de pruebas, CI, merge o despliegue. Esas
evidencias y el smoke visual en producción se registran por separado. La
verificación productiva debe abrir un evento existente y comprobar su integridad
sin modificarlo.
