# 401 y 403

Son cosas distintas y el cliente HTTP las distingue:

| Estado | Significado | Código | Reacción |
|---|---|---|---|
| 401 | no sé quién eres | `SESSION_REQUIRED` | intento de refresco; si falla, `/login` |
| 403 | sé quién eres y no puedes | `FORBIDDEN` | `ForbiddenPage` o aviso en el sitio |
| 403 | falta verificación reforzada | `STEP_UP_REQUIRED` | pedir step-up y reintentar |
| 403 | la prueba de step-up no vale | `STEP_UP_PROOF_NOT_FOUND` | pedir step-up de nuevo |

Los tres códigos de 403 los envía el backend en `{ error: { code } }`
(`auth_dependencies.py`); el frontend no los inventa. Cuando la respuesta no trae código
propio, el cliente ya no devuelve un `HTTP_403` anónimo: asigna `FORBIDDEN`, para que
ninguna pantalla tenga que reinterpretar el número por su cuenta.

```ts
import { isAccessDeniedError, isStepUpError } from '../api/api-client'
```

`isStepUpError` distingue lo que se puede reintentar tras verificarse; `isAccessDeniedError`,
lo que no cambia por reintentar. Un 401 nunca satisface `isAccessDeniedError`.

## Refresco de sesión

El refresco se intenta **solo** en 401, nunca en 403 —un permiso que falta no se arregla
renovando el token— y a través de una única promesa compartida, de modo que varias
peticiones que fallan a la vez no disparan varios refrescos ni un bucle.
