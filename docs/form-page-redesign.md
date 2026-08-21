# Rediseño de formularios de estructura logística

Los CRUD principales de organizaciones, sedes y almacenes usan páginas dedicadas. Los listados conservan únicamente pestañas, toolbar, filtros, tabla y paginación; no repiten el nombre ni la descripción del módulo.

`EntityFormPage` define el contrato visual compartido:

- breadcrumb compacto y encabezado de operación;
- contenido fluido y resumen contextual de 340 px en desktop;
- una columna en tablet y móvil;
- secciones separadas por espacio o borde, sin una card contenedora gigante;
- barra de acciones consistente con `Cancelar` y `Guardar`, sticky en desktop.

## Mapas

- Organización: `CountryMapPreview` centra MapLibre en el país seleccionado, sin marcador ni coordenadas persistidas.
- Sede: reutiliza `LocationPicker` y `LocationMap` con mapa de 460 px.
- Almacén heredado: mapa de sede read-only; no duplica coordenadas.
- Almacén propio: reutiliza `LocationPicker`, exige confirmación y envía latitud/longitud WGS84.

Los modales de detalle no editables pueden seguir existiendo. Los modales de alta/edición de estas tres entidades no forman parte del flujo CRUD.
