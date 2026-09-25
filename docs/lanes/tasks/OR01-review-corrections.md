# OR01 — Devolución a los lanes existentes

Leer completo metodo_ainnovate.md si no se hizo en este chat, CLAUDE.md, docs/lanes/REVIEW-PROTOCOL.md y docs/lanes/reports/OR01-ACADEMY-REVIEW-2026-09-15.md. Retomar trabajo existente sin reemplazar archivos ajenos. El usuario revisa antes de cualquier push; preparar diff, evidencia y reporte antes de solicitar aprobación. Este archivo asigna secciones por propietario: no ejecutar todas desde un único chat.

## Academy — A1, A2 y parte Academy de T1

Corregir pérdida de cambios del editor JSON al mutar visualmente cursos/portadas, preservando borradores válidos e inválidos. Validar JPEG decodificable en servidor y reemplazar fixture positivo falso por imagen genuina. Corregir BodyInit de tests/academy-covers.test.ts sin any ni supresión de tipos. Mantener v1/v2, permisos admin/owner, preview y export. Añadir pruebas de regresión ejecutables y browser donde corresponde. Si se necesita una dependencia de decoder, proponerla a Infra; no modificar package/lock simultáneamente. Leer feature Academy antes de código y actualizarla al terminar. Escribir reporte `docs/lanes/reports/OR01-ACADEMY-FIXES.md` con criterios A1/A2/T1, pasos de prueba, hashes y deltas globales.

Después de estas correcciones, preparar pruebas SQL/Storage aisladas que ya estaban pendientes: guardar/recuperar, rechazo anon/authenticated/acceso cruzado, CAS desde dos conexiones, transacción sin revisiones parciales y upload/lectura real de portada privada. No aplicar SQL al proyecto compartido. No crear un proyecto externo de pago como efecto lateral; usar entorno descartable local/configurado o entregar configuración reproducible y dependencia precisa. No declarar Storage real validado por mocks.

## Infraestructura — S1 y alcance del typecheck T1

Es el propietario actual de la sesión común, con mejoras I05 posteriores a S01. Coordinar con el autor de S01; un solo escritor de WorkspaceAccess. Corregir logout remoto lento/nuevo login y propagación entre pestañas, manteniendo ventana fija de 12 horas y validación de membresía. Probar logout retenido, inicio posterior, error remoto y refresh tardío; no reintroducir sesiones cerradas ni extender ventana por refresh. Corregir tsconfig para evitar compilar snapshots históricos de artifacts manteniendo código/tests vigentes. No borrar artefactos ni ocultar errores de tests. Escribir `docs/lanes/reports/OR01-INFRA-FIXES.md`, incluyendo typecheck completo después del ajuste Academy.

## Calendar — CAL1, mismo lane de Academy

Conservar mes/día elegidos durante renovación de token de la misma identidad, incluido feed con zona no UTC y respuesta demorada/error. Limpiar datos correctamente si cambia usuario. Respetar permisos y cobertura temporal actuales; no tocar backend de calendario ni inventar eventos. Cambios limitados a CalendarWorkspace, helper y pruebas propios; documentar en calendar-view y entregar `docs/lanes/reports/OR01-CALENDAR-FIXES.md`. No coordinar otro escritor sobre Academy al mismo tiempo: este trabajo lo retoma su lane existente.

## Cierre y revisión

Cada reporte usa REPORT-TEMPLATE.md, identifica hallazgos resueltos, evidencia nueva, pruebas pendientes y cambios de documentación. El orquestador revisa la integración y Franco el resultado concreto antes de push/publicación. No editar reportes ajenos ni hacer deploy para cerrar un hallazgo. No se autoriza publicación nueva mediante esta devolución. Dejar la aplicación y pruebas preparadas para revisión.
