# Despliegue — NBC Sales

**Corrección de aceptación — 2026-09-17:** /200 y APIs anónimas401 solo acreditan acceso al sitio y rechazo anónimo, no un login funcional. Variables NEXT_PUBLIC se incorporan al build: deben existir en el target production antes de reconstruir. Configurarlas solo para preview deja el cliente sin Supabase aunque la cuenta real esté activa. Validar login completo al cerrar esta reparación, sin cambios de contraseña.

## Acceso y publicación vigente — reparación 2026-09-17

**URL única de revisión:** https://nbc-sales-nbc-sales.vercel.app. Comprobación externa sin cookies de root tras reparación: GET / → 200, sin redirect; GET /api/workspace/session → 401, sin redirect. El login NBC se conserva. La captura de Franco mostraba protección del proveedor antes de llegar a la aplicación.

La investigación de Infra identifica el alias actual sobre un deployment de producción. Las instrucciones viejas que publicaban staging y reasignaban el alias no son un procedimiento vigente por defecto. Para siguientes entregas usar el proyecto/dominio actuales, comprobar destino real, preparar versión integrada y desplegar en el entorno que conserve accesible ese dominio. No ejecutar scripts de artifacts/lanes o deploy-*-publish con IDs/snapshots antiguos sin adaptarlos al candidato actual. Un READY no acredita acceso.

Pedido de publicar = autorización para este destino, según docs/lanes/REVIEW-PROTOCOL.md. Comprobar en una solicitud sin cookies que no aparezca la barrera SSO de Vercel; comprobar también APIs privadas. Si una preview está protegida, no entregar ese enlace como sustituto del habitual ni quitar auth NBC para arreglarlo. Reporte técnico de la reparación: docs/lanes/reports/ACCESS-REPAIR-2026-09-17.md.

Configuración aplicada y comprobada: `ssoProtection.deploymentType = prod_deployment_urls_and_all_previews`. Se mantiene `dpl_HTi3nMWu8GTHPe7zHPt7JsD7pP8k` (producción READY), sin rebuild/deploy/movimiento de alias. URLs directas de deployments/previews pueden seguir protegidas; la entrega a Franco es el dominio habitual.

Procedimiento de publicación para el lane ejecutor: usar las credenciales VERCEL existentes privadamente, GET proyecto y alias para identificar base vigente; preparar código integrado sin secretos; reutilizar transporte API de los scripts existentes pero con candidato actual y `POST /v13/deployments` del mismo proyecto/equipo con `target: production`, no los IDs/snapshots staging históricos. Esperar READY y comprobar que el alias habitual corresponde a la entrega y pasa /200 + login NBC + APIs401. No asumir CLI instalada ni devolver «no sé cómo publicar»: API/CLI son medios válidos y el lane resuelve la ejecución. Esta guía no ejecuta una nueva publicación.

Los estados de deploy siguientes son históricos salvo nueva comprobación explícita.

> Regla vigente de publicación (2026-09-17): `docs/lanes/REVIEW-PROTOCOL.md` desde la raíz. Un pedido de Franco de publicar/pushear autoriza Vercel en el enlace habitual; no reiterar permisos ni entregar localhost. Las restricciones históricas inferiores que contradigan esto quedan reemplazadas.

> Actualización de alcance Academy/S01/KCAL01: ver la sección de consolidación OR01 del 2026-09-15 al final. Las secciones anteriores conservan el estado histórico; no describen por sí solas toda la plataforma actual.

## Vigente I02-R4 — Start Here y navegación

https://nbc-sales-nbc-sales.vercel.app/, deployment `dpl_CvvZZYvjp8nx84xQqvujyk3mrJER`, READY, staging; inmutable https://nbc-sales-5ljr7c2nt-nbc-sales.vercel.app/. Conserva login general y cuentas admin. Start Here se convierte en Your Roadmap al completar preguntas provisionales; Calendar/Chat independientes, Support en pie de sidebar, crédito disponible en cabecera fija. Cuatro páginas y summary autenticado, sin SQL ni variables nuevas. Snapshot de 109 archivos conserva publicaciones C02-R1 y K01-R3; evidencia/archivo/manifiesto bajo `artifacts/lanes/I02/navigation/`. Reporte [I02-R4](lanes/reports/I02.md). No push ni llamadas/cargos.

## Vigente I02-R3 — login principal

**https://nbc-sales-nbc-sales.vercel.app/** ahora muestra login antes del dashboard, igual que cualquier página directa, incluida demo. Deployment `dpl_7pUFo2MZ8vm5jLKEM1ifX7nRBuGi`, inmutable https://nbc-sales-knuttd71b-nbc-sales.vercel.app/, READY, target staging. Publicación autorizada como corrección solicitada por Franco. Anas y Elias conservan cuentas admin; Members usa sesión general en memoria, logout vuelve al login y nueva pestaña solicita credenciales. Autorización de APIs intacta. No nuevas variables/SQL/cuentas. Build y prueba de 19 checks con Auth real; evidencia, capturas y manifiesto de 75 archivos en `artifacts/lanes/I02/login/`. C01-R1 e I02-R2 conservados; no Caller C02 ni cambios concurrentes de módulos. Reporte vigente [I02-R3](lanes/reports/I02.md).

## Vigente I02-R2 — 2026-09-14

Portal activo: **https://nbc-sales-nbc-sales.vercel.app/members**, inmutable https://nbc-sales-kopfa2980-nbc-sales.vercel.app/members. Deployment `dpl_GyLb1ocx3PZksRSW2nvE7GTn8RDi`, proyecto `nbc-sales`, READY, `target: staging`. Autorización explícita posterior de Franco: publicar en Vercel y hacer lo necesario para activar. No se exigió otra aprobación. No git push.

Fuente: snapshot C01-R1 ya publicado + archivos Members I02; 67 archivos runtime, manifiesto y archivo reproducible en `artifacts/lanes/I02/activation/`. Conserva C01 sin tomar cambios concurrentes de otros lanes. Build Node 24/Next 16.3.5 aprobado; reutiliza seis variables runtime preview existentes. No se publicaron secretos, SQL, documentos, scripts ni contraseñas.

Migración Members aplicada a Supabase real; ocho tablas con RLS y acceso directo cliente revocado. Anas y Elias activos como admin de Members, login sobre HTTPS probado en escritorio/móvil; 14 comprobaciones navegador y 12 Auth/API/DB, incluidos guardado real y dos reservas concurrentes de créditos. Datos de prueba eliminados. Detalles y límites en [reporte I02](lanes/reports/I02.md).

Excepción de Deployment Protection aplicada solo a este deployment. Alias e inmutable retornan 200 sin cuenta Vercel; APIs Members/Caller anónimas retornan 401, archivos privados 404. Credenciales iniciales se entregan a Franco en archivo local privado 0600, no por email ni en runtime. Caller conserva permisos de operador y el cambio C01 publicado. Créditos manuales activos; compras y consumo automático no configurados.

Los apartados I01 y anteriores siguientes son historial; sus pendientes de Members no describen el estado vigente.

## Estado vigente I01 — 2026-09-14, revisión 1

Baseline publicado y comprobado: **https://nbc-sales-nyqgilywg-nbc-sales.vercel.app**. Proyecto `nbc-sales` en equipo NBC Sales, ID `prj_IpKvXDe4aOUOYXoVY22sEw3f2YFR`; deployment de preview `dpl_GcbgSqSuDQrvhBbWiacPh34CjYzr`, `target: staging`, READY. El alias actual https://nbc-sales-nbc-sales.vercel.app también responde 200 anónimo, pero para revisar esta versión usar la URL inmutable. No hay Git conectado ni auto-deploy. El bloqueo histórico 403 quedó resuelto: POST de creación respondió 200 en esta ejecución.

Fuente: `docs/lanes/BASELINE.json`, archivo SHA256 `bfec999cee4d87329b42e45ed54fcbe1fcea0deefbc0deb24fa28cc131489283`. Los 57 archivos se extrajeron en `/private/tmp/nbc-i01-wopbxul2`, se verificaron antes del upload y no se modificaron. `npm ci --no-audit --no-fund`, build Next 16.3.5 con Node 24.21.0 y TypeScript pasaron localmente. Vercel usa Node 24.x y volvió a instalar/compilar el mismo lockfile en Linux iad1. Evidencia, hashes y límites en `docs/lanes/reports/I01.md` y `artifacts/lanes/I01/`.

Solo seis variables configuradas en **preview**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (públicas, disponibles en build), `SUPABASE_SECRET_KEY`, `NBC_OPERATOR_EMAIL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` (tipo Vercel `sensitive`, consumidores solo servidor). Ninguna variable de administración, contraseña inicial, GHL ni claves OpenAI/Anthropic se envió al runtime. El ID de proyecto se guardó en `.env.local`, preservando las otras entradas.

### Acceso de revisión

Las URLs devolvían 302 a Vercel antes de configurar acceso. Se aplicó una **Deployment Protection Exception al deployment del baseline** mediante `PATCH /aliases/{deploymentId}/protection-bypass`, payload `{"override":{"scope":"alias-protection-override","action":"create"}}`. La URL inmutable y su alias actual devuelven 200 sin login/cookies Vercel. `ssoProtection: all_except_custom_domains` permanece en el proyecto; no se desactivó auth de la aplicación, no se generaron enlaces con tokens ni se enviaron invitaciones. La excepción sigue a este deployment; verificar protección de cualquier futuro candidato antes de compartirlo. Se puede revocar con la misma llamada y `action: revoke` (no ejecutado).

Anas puede revisar Home, login Caller, planificador local, inventario Academy en memoria, estado pendiente Ask Anas e Integrations. No obtiene acceso a conversaciones privadas: requiere una cuenta de aplicación autorizada, todavía no provisionada para Anas. No compartir la cuenta de Franco. I01 verifica rechazo anónimo de APIs, no una nueva conversación ni el flujo autenticado en HTTPS.

### Validación y reproducción

`node scripts/deploy-verify-public.mjs https://nbc-sales-nyqgilywg-nbc-sales.vercel.app artifacts/lanes/I01/recheck /private/tmp/nbc-i01-wopbxul2` usa Chrome instalado y Playwright del staging: 12 visitas directas (1440×1000 / 390×844), 13 checks de navegación y 7 checks API. Usa contextos limpios sin credenciales, y los POST llevan `{}` anónimo; no inicia llamadas. Capturas finales: `artifacts/lanes/I01/public-rerun/`. Único error de consola observado: `/favicon.ico` 404; sin excepciones JavaScript ni overflow horizontal. El script registra incidencias de consola en JSON aunque pasen las aserciones de navegación/API.

Lead Engine: presupuesto insuficiente muestra advertencia y permite descargar el borrador; esto no autoriza ni ejecuta gasto. El presupuesto válido permite exportar JSON. Academy trabaja con template demo e importación/exportación en memoria; los detalles de la comprobación están en `public-flows-final.json`. Son funciones locales, no campañas ni migraciones reales. El status público devuelve `ghl:false, auth:true, storage:true, webhook:false`; los booleanos indican configuración.

### Incidencias y publicación

El primer POST sin `target` explícito fue inferido por Vercel como `production`, pese al default preview descrito en la referencia. Se canceló inmediatamente (`dpl_BAY7tByGdBQktUt1cTL1PdNg6jCQ`, CANCELED), sin promoverlo; luego se creó el preview con `target: staging`. Para futuras ejecuciones no omitir el target. No hay producción READY ni variables production. No se publicaron archivos nuevos de lanes ni el script de verificación. Push: **NO EJECUTADO**. Mejoras del shell: no implementadas en I01; pendientes de asignación/revisión.

Fuentes oficiales consultadas: [creación de proyectos](https://vercel.com/docs/rest-api/projects/create-a-new-project), [variables](https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables), [deployments](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment), [Node](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [excepciones de protección](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/deployment-protection-exceptions) y [OpenAPI oficial](https://openapi.vercel.sh). Sin planes, DNS, dominios propios ni add-ons contratados; consumo de build/hosting generado por el despliegue autorizado, facturación no consultada.

## Historial anterior a I01

Los estados sin despliegue/403 que siguen son históricos y no reemplazan el estado vigente de arriba.

Estado: servidor local de desarrollo disponible en http://127.0.0.1:3000. Supabase NBC Caller conectado; sin despliegue público. Vercel bloqueado por falta de permiso para crear proyectos.

## Desarrollo

`npm install` y `npm run dev`. Para repetir exactamente las dependencias del lockfile, usar `npm ci`. Node utilizado: 26.0.0; mantener una versión compatible con la versión instalada de Next.js.

`.env.local` está excluido de Git. El modo demo arranca sin credenciales. Ver `README.md` para conectar Supabase y GHL. Reiniciar después de cambiar configuración; reconstruir para cambiar variables públicas en un entorno publicado.

## Build y pruebas

- `npm run typecheck`
- `npm test`
- `npm run build`
- Con servidor local activo y Google Chrome instalado: `npm run test:e2e`

En el entorno restringido de esta sesión, las descargas, el servidor local y Chrome requirieron permisos de ejecución externos al sandbox. No hubo publicación ni llamadas a números telefónicos. Las pruebas de voz por navegador se incorporaron el 2026-09-14.

## Próxima conexión pública

Vercel es el destino indicado por el usuario; equipo NBC Sales identificado y Supabase de testing conectado; falta permiso para crear el proyecto Vercel. Antes de habilitar webhooks reales, configurar secretos, operador, migración, URL HTTPS y protección/límites del entorno. Verificar con un contacto controlado y un evento repetido. Los dominios, CI/CD y OAuth de clientes están pendientes.

Un túnel de desarrollo o una URL de preview permitirán que GHL alcance el endpoint; ninguno se creó en esta entrega. Para compartir con Anas puede demostrarse localmente mientras se prepara el enlace público.

## Vía de acceso elegida

Tokens API de administración en `.env.local`, según preferencia del usuario. `scripts/check-cloud-access.mjs` permite consultar destinos mediante GET. `.vercelignore` excluye secretos locales, fuentes internas, pruebas y scripts de administración. Tokens de administración verificados. Se aplicó la migración a NBC Caller y se creó el operador indicado. La creación de proyecto Vercel devuelve HTTP 403 por permisos; no se desplegó la aplicación. No hay plugin instalado como resultado de esta tarea.

Se incorporaron campos privados para OpenAI, Anthropic/Claude y ElevenLabs. Desde el 2026-09-14 ElevenLabs se consume en Caller; OpenAI y Anthropic siguen reservados. El identificador del proyecto Supabase se derivó de la URL local existente, conservando las credenciales cargadas. La presencia de URL y clave pública no verifica la conexión. README incluye instrucciones para el operador Auth, clave de servidor y tokens de administración; los otros IDs se consultarán al disponer de acceso.

## Verificación de infraestructura — 2026-09-12

Supabase NBC Caller activo en us-east-2, dentro de NBC Sales. Login real y lectura de servicio correctos; anon y authenticated no pueden leer directamente integration_events. Unicidad y RLS verificadas con transacción sintética revertida. Las claves OpenAI, Anthropic y ElevenLabs aceptan consultas de metadatos; generación y voz no probadas.

Build y TypeScript, tres pruebas unitarias, cuatro E2E y flujo de navegador con operador real pasaron. La contraseña inicial queda exclusivamente en NBC_OPERATOR_INITIAL_PASSWORD local. No se enviaron emails ni se realizaron llamadas.

Vercel reconoce el equipo NBC Sales y lista cero proyectos; rechaza POST /v11/projects con HTTP 403 y el mensaje “You don't have permission to create the project.”. Falta resolver rol o alcance del token. No hay proyecto, variables remotas ni URL de preview. El siguiente paso será crear nbc-voice-ai con cuatro variables Supabase/runtime y desplegar preview conservando la protección del proveedor.

## Caller local — 2026-09-14

Aplicada `202609140001_call_sessions.sql` y creado el agente privado con `scripts/setup-caller.mjs`, configuración versionable en `config/nbc-test-agent.json`. `.env.local` conserva los valores previos y agrega `ELEVENLABS_AGENT_ID`. El runtime de Caller necesita las cuatro variables Supabase/operador y `ELEVENLABS_API_KEY` + `ELEVENLABS_AGENT_ID`; no necesita claves directas OpenAI/Anthropic. Excluir tokens de administración y contraseña inicial. `.vercelignore` también excluye `config/`.

Conversación real en Chrome con entrada sintética y respuesta de audio verificada; guardados duración, tres turnos y resumen. Localhost o HTTPS requerido para el micrófono. Vercel mantiene el bloqueo ya documentado: esta entrega no crea proyecto ni URL pública. GHL, telefonía y clon de voz siguen pendientes.

## Master platform — 2026-09-14

La raíz local ahora muestra NBC Sales y `/demo` conserva la presentación previa. Módulos `/caller`, `/lead-engine`, `/academy`, `/ask-anas`, `/integrations`. Sin nuevas variables ni dependencias para la estructura/planners locales. No se aplicaron migraciones ni cambios cloud en este hito. Vercel sigue sin proyecto publicado por el bloqueo anterior; localhost disponible. Capturas públicas de módulos en `artifacts/platform/`, resultados privados Caller en `artifacts/caller/`, ambos excluidos de Vercel.

## Estado verificado y encargo I01 — 2026-09-14

La consulta de solo lectura `node scripts/check-cloud-access.mjs` reconoce el equipo NBC Sales en Vercel y devuelve cero proyectos; Supabase continúa activo. No se reintentó crear el proyecto en esta consulta: el 403 de creación registrado anteriormente es histórico, no un nuevo resultado. Todavía no existe URL publicada verificada.

El usuario autoriza ahora desplegar para revisión de Anas. La tarea `docs/lanes/tasks/I01-vercel.md` contiene el procedimiento y criterios: verificar acceso, crear/reutilizar proyecto, instalar/build en staging aislado, configurar solo variables runtime, publicar y comprobar acceso de revisión y APIs privadas. El archivo `docs/lanes/BASELINE.json` identifica snapshot y SHA256 de la versión previa validada. No desplegar el workspace mutable mientras trabajan otros lanes. Estado actual: tarea preparada, no ejecutada.

## Revisión antes del push — instrucción posterior de Franco

Los prompts se amplían conforme a AInnovate; tareas y ownership se mantienen. Antes de cualquier push, Franco revisa y autoriza el paquete concreto. La revisión técnica del orquestador no sustituye su aprobación. Conectar Vercel y publicar el baseline inicial congelado para revisión conserva la autorización previa; código nuevo/correcciones del candidato deben presentarse y revisarse antes de publicarse. No usar CLI/API, merge, promoción o auto-deploy para eludir esa revisión. Detalle vigente: `docs/lanes/REVIEW-PROTOCOL.md` (ruta desde raíz).

Cada lane entrega evidencia, criterios de aceptación, pasos para revisión y deltas documentales; orquestador consolida CHANGELOG/esquema/API/arquitectura/lookup. Infraestructura mantiene su feature `docs/features/platform-delivery.md` y puede preparar mejoras pequeñas del shell como candidato separado después de la conexión, sujeto a revisión; no bloquea el enlace inicial por un rediseño amplio.

## Consolidación de publicaciones K01/S01/KCAL01 — 2026-09-15

El estado inicial sin proyecto Vercel es histórico. Los reportes recibidos registran publicación y comprobaciones HTTPS en el enlace habitual **https://nbc-sales-nbc-sales.vercel.app**, conservado para Franco y Anas. OR01 no consultó el alias actual ni publicó. Las autorizaciones posteriores reportadas por los lanes para publicar no equivalen a una aprobación de push inferida aquí.

| Candidato histórico | Deployment registrado | Verificación reportada |
|---|---|---|
| S01-r1 | dpl_65U6x6EsvJ5gXeyobJ2vd6KkrAsE |2026-09-15T13:56:11.459Z |
| K01-r6 | dpl_C1GiSTZ9S4Jfh5WbXHWHckCJf6Hn |2026-09-15T16:13:41.032Z |
| KCAL01-r1 integrado | dpl_7ze1Pm3bx5ci5QZtwNg5SCTtuEGs |2026-09-15T19:58:36.537Z |

KCAL01 snapshot219 archivos: tar `artifacts/lanes/KCAL01/nbc-sales-KCAL01-R1.tar.gz`, SHA256 d53f916dc53c99d72c36588474e014723e2b3769b64095506e552f540fcf8202; manifiesto canónico JSON.stringify SHA256 cddb9514b75c87b8f2fe34f3afd72615f96322edff9a8d91c5b054e7f33a63d5. OR01 verificó ambos hashes y33 archivos runtime del alcance coinciden localmente. Otros17 archivos de esa base cambiaron después: no publicar toda la carpeta como si fuera ese snapshot. No recrear baseline inicial I01 para sustituir una plataforma posterior.

Los lanes documentaron regresiones por mover el mismo alias desde bases diferentes. Mantener un ejecutor coordinado de publicación y verificar que el alias no cambió antes de promover el candidato aprobado; ante base distinta, integrar y repetir checks afectados. No sobrescribir cambios concurrentes. Push sigue condicionado a revisión y autorización explícita de Franco.

Builds/HTTPS anteriores se atribuyen a sus candidatos. La nueva comprobación global de OR01 falla por alcance de tsconfig y tipos de tests; no equivale a que los builds históricos no hayan pasado. Correcciones y dependencias: `lanes/reports/OR01-ACADEMY-REVIEW-2026-09-15.md`. Sin despliegue, merge, tag ni SQL en OR01.

## Alias y fuente comprobados — OR02, 2026-09-16

GET a las15:38:19UTC confirma mismo alias `https://nbc-sales-nbc-sales.vercel.app`, deployment L01-r9 `dpl_yCUAVQPNyp4nySasyLosVRSUBpCC`, READY/staging.234 archivos manifest coinciden localmente, archivehash válido; canónicoJSON SHA256 `5ea870e31eb3cbe0009064526f24d57a63a7e02595a56777b33704100ba7c131`. `/`, `/caller`, `/lead-engine` HTTP200; APIs workspace/session y lead-engine/plans401 anónimo. No se comprobó nuevamente navegador/login real ni se repitió build en OR02.

177 unitarias pasan; typecheck global falla por T1 pendiente. Esta revisión no promueve producción ni autoriza nuevo push/deploy. Antes de siguiente publicación, resolver correcciones, obtener candidato revisable, verificar alias/base vigente y usar un ejecutor coordinado. Evidencia: `artifacts/orchestrator/platform-review-20260916/read-only-state.json` desde raíz y reporte OR02.
