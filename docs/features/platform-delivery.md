# Feature: Entrega revisable de NBC Sales en Vercel

Estado: I01 implementada y lista para revisión, revisión 1, 2026-09-14. Baseline publicado en preview y acceso anónimo comprobado; revisión técnica y de Franco pendientes. Mejoras nuevas de presentación no implementadas ni publicadas.

## Objetivo

Franco necesita mostrar a Anas el master dashboard por HTTPS. Conectar Vercel es la primera prioridad de Infraestructura; no depende de completar Caller, Lead Engine o Academy de esta ronda.

## Flujo y alcance

Verificar equipo/proyecto → validar snapshot BASELINE.json → preparar staging y runtime → compilar → publicar baseline autorizado → comprobar acceso externo y rutas → entregar guía y evidencia de revisión. Si para publicar se necesita código nuevo, preparar ese candidato para revisión de Franco antes del upload. Reglas completas en `../lanes/tasks/I01-vercel.md` y `../lanes/REVIEW-PROTOCOL.md`.

El shell existente conserva colores NBC y rutas Home, Caller, Lead Engine, Academy, Ask Anas e Integrations. Las mejoras pequeñas de presentación que se preparen después de la conexión son un candidato separado sujeto a revisión; no amplían I01 a un rediseño completo.

## Archivos y dependencias

Configuración de hosting/build, scripts `vercel-*`/`deploy-*`, PlatformShell/Home, CSS global y configuración del layout según ownership en `../lanes/README.md`. Feature propia de Infra para evitar editar master-platform.md junto con otros lanes. Depende de permisos reales de Vercel, configuración runtime privada y fuente congelada. No altera modelo de datos ni contratos de API.

## Aceptación y evidencia

URL HTTPS comprobada sin sesión Vercel, navegación desktop/móvil, endpoints privados que rechazan acceso anónimo, sin secretos en artefactos, procedencia del código publicada y guía de recorrido de 2–3 minutos. Registrar fecha/entorno de verificación. Distinguir revisión visual de cuenta privada de Anas. No crear actividad de voz pagada para demostrar el hosting.

## Ejecución y resultado

### Plan de ejecución I01, revisión 1

Avance: proyecto creado con HTTP 200 y seis variables preview configuradas; build aislado con Node 24.21.0 aprobado sin cambiar archivos del snapshot. La primera solicitud sin `target` fue inferida como producción por Vercel y se canceló; la segunda usa `target: staging` explícito y está READY. Las dos URLs preview redirigen a Vercel (302). Se aplicará una excepción de Deployment Protection solo a la URL inmutable del baseline, usando `PATCH /aliases/{deploymentId}/protection-bypass` con `override: {scope: alias-protection-override, action: create}` según OpenAPI oficial. Se preserva la protección general del proyecto y la autorización de la aplicación; no se generan enlaces con secretos ni invitaciones. Rechazo anónimo comprobado primero en staging local.

Consultar cuenta/equipo/proyectos con el token local sin imprimir secretos y crear o vincular `nbc-sales` en NBC Sales si el alcance lo permite. Verificar SHA256 y miembros del archivo indicado en BASELINE.json; extraer exclusivamente esos archivos en `/private/tmp`, registrar manifiesto y usar instalación/build aislados. Configurar exclusivamente las seis variables runtime de I01 para preview (públicas también en build). Consultar documentación oficial vigente de Vercel antes de configurar proyecto, Node y despliegue.

No modificar fuente ni dependencias del snapshot publicado. Cualquier corrección necesaria se entrega como diff y candidato separado, probado pero sin upload hasta revisión de Franco. No aplicar migraciones, crear Git, conectar ramas, cambiar planes/DNS ni tocar otros lanes. Ante un rechazo de permisos, conservar evidencia saneada y avanzar instalación, build y revisión local sin presentar localhost como HTTPS publicado.

Verificar las seis rutas con navegador anónimo desktop/móvil, assets, consola y rechazo de APIs privadas; no iniciar voz ni autenticar capturas. Entregar manifiesto, capturas públicas, guía de 2–3 minutos, pendientes y estados separados de conexión, publicación y revisión en `artifacts/lanes/I01/` y el reporte asignado. No se cambian contratos HTTP ni esquema.

Resultado final: https://nbc-sales-nyqgilywg-nbc-sales.vercel.app, deployment `dpl_GcbgSqSuDQrvhBbWiacPh34CjYzr` en `nbc-sales`, Node 24.x. Proyecto y seis variables preview creados, snapshot sin cambios y build local/cloud aprobados. Excepción de acceso aplicada al deployment y verificada con navegador limpio. `ssoProtection` general se conserva; Caller y datos de operador siguen autenticados. API anónima: cinco rechazos 401, webhook no configurado 503 y status público 200. Doce visitas de rutas, trece checks de navegación y siete checks API aprobados en local y HTTPS. Export de plan y validación/import/export Academy demo también comprobados sin mutaciones HTTP.

Nuevos archivos propios: `scripts/deploy-verify-public.mjs` y `scripts/deploy-verify-flows.mjs`, verificador público de rutas/navegación/API con capturas y salida JSON; no forma parte del snapshot publicado. Documentación y manifiesto en `../lanes/reports/I01.md`, handoff `../lanes/infra.md` y `artifacts/lanes/I01/`. Sin cambios de fuente runtime, lockfile, esquema o contratos API. El 404 de favicon y detalles móviles se registran como mejoras pendientes; no se solicita aprobación de un rediseño inexistente.

Pendiente: revisión del orquestador y de Franco; cuenta privada de Anas como tarea separada; ensayo autenticado de Caller en HTTPS, fuera de la validación anónima realizada. Cualquier código nuevo, push o futura publicación exige autorización del candidato concreto. Push no ejecutado.


## I10 / T1 — comprobación integrada (2026-09-16)

Contrato previo: el typecheck del proyecto debe validar src y tests vigentes, sin incorporar snapshots históricos de artifacts. Excluir únicamente artifacts y node_modules; conservar evidencia. En los fixtures de portadas, usar bytes respaldados por ArrayBuffer para Request/Response, sin cast que oculte el error ni cambiar validación runtime. Aceptación: typecheck global y suite existente, sin reiniciar el servidor ni modificar dependencias/cloud. Esto no corrige el hallazgo separado A2 de validación JPEG.


## Actualización L02 / I10

I10/T1 validado: typecheck global exit0 y npm test 188/188 tras excluir artifacts y corregir tipo binario del fixture. Sin build ni deploy nuevos; logs en artifacts/orchestrator/L02-access/.


## Reparación de configuración production — 2026-09-17

Franco reporta error «Workspace access is being prepared» tras retirar barrera de proveedor. Ese mensaje ocurre antes de enviar contraseña cuando el cliente Supabase no puede crearse. Infra identifica variables auth solo para preview y producción sin ellas; la cuenta Supabase existente autentica y tiene membresía admin activa. Preparar configuración runtime del target correcto y reconstruir la misma fuente desplegada, preservando avances concurrentes y sin resetear contraseña. Aceptación: login completo en dominio habitual, identidad/rol correcto y APIs privadas protegidas, no solamente página /200. Evidencia final en reporte LOGIN-REPAIR-2026-09-17.md.
