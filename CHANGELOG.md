# Changelog — NBC Voice AI

## [2026-09-21] — Owner Cell App: Phase 0 completa y Lane A por job detrás del meter

**ADDED:** dos migraciones aditivas (`202609210230_lead_engine_memory.sql`: ledger por fila entregada, dial outcomes con snapshot congelado, snapshots de registros, grafo de entidades, caché verified 31 días, names, cobertura por estado; `202609210240_lead_engine_jobs.sql`: jobs con máquina de estados y transiciones logueadas, ledger de créditos append-only con hold/settle/release/refund, `lead_engine_meter` con cap 60% y techo diario por proveedor, filas de trabajo). Probadas en Postgres 17 real (`tests/lead-engine-memory-postgres.test.mjs`, `tests/lead-engine-jobs-postgres.test.mjs`). **Pendiente de aplicar a producción** con `scripts/lead-engine-apply-migration.mjs` (el clasificador bloquea esa escritura desde Claude).

**ADDED:** brain loader `src/lib/lead-engine-brain.ts` con `route(industry, state)` y `coverage()` sobre `src/data/lead-engine-brain.json` (copia del handoff con `legal_status` por estado); zona horaria por ZIP desde GeoNames (`src/lib/lead-engine-dial-window.ts`) con ventana 08:00 a 20:00; xlsx sin dependencias; jobs (quote, hold, sample gate, ampliación por ciudad, entrega, outcomes) en `src/services/lead-engine-jobs.service.ts` y rutas `api/lead-engine/{jobs,credits,outcomes,coverage}`; pestaña "Owner cells" en Lead Engine; paquete Python `ownercell/` (engine.py refactorizado sin `die()`, freeze/resume, 6 bugs corregidos, 33 tests, `npm run test:py`).

**ADDED (mismo día, tramo 2):** Phase 2 y 3 del plan: migración `202609210250_lead_engine_registers.sql` (ingesta por trozos, reuse por teléfono, nuevos licenciados), 18 adaptadores de registros gratuitos con pestaña Registers, receta C (registro → verify), receta D (registro vs Maps con buckets 1 a 4), quality gates bloqueantes, listas de marcas OSM. Suite 330/330. Migración correctiva `202609210260` (sin lecturas de `auth.users`). Las cuatro migraciones aplicadas a producción; primera ingesta real OR CCB y WA L&I (121.396 dueños nombrados, gratis).

**ADDED (2026-09-24):** Phase 4 y 5: receta B (parcel + skip trace), 13 adaptadores B más, extractor de dueños desde reviews y about pages (patrones + Haiku detrás del meter), camino med spa (roster NPI-1, grafo de directores TN, blocklists), grafo de entidades, score v0 y reporte por bucket; migraciones `0270` (vendor anthropic, índice del grafo, `lead_engine_score_report`) y `0280` (stop-loss 2× en el meter, `lead_engine_job_freshness`); export CSV y rechazo de export vieja; cron nocturno de registros en Vercel; auditoría renglón por renglón en `docs/features/owner-cell-audit.md`.

**CHANGED:** configs del Lead Engine viven en `src/data/` porque `.vercelignore` excluye cualquier directorio llamado `config`. Textos de ventana de llamada corregidos a 8pm. Detalle en `docs/features/owner-cell-jobs.md`.

## [2026-09-17] — Permisos persistentes de Claude para trabajo autorizado

**FIXED:** configuradas reglas `permissions.allow` en `.claude/settings.json` para el comando de publicación NBC, comprobación y pruebas habituales; `acceptEdits` como modo inicial. Los logs sí mostraban rechazo del clasificador auto mode `[Production Deploy]`, distinto del error de credenciales de la CLI. Las instrucciones textuales previas no resolvían ese control. Conservadas políticas administradas/sandbox; sin bypass general. Reglas compartidas y guía explican usar directamente el comando autorizado.

## [2026-09-17] — Comando Vercel utilizable desde todos los lanes

**FIXED:** `scripts/vercel-project.mjs` carga credenciales existentes privadamente y fija `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` y scope. Corregida invocación incompleta de la CLI; no era un bloqueo del sandbox ni requería permisos nuevos. Inspección read-only del deployment de producción actual comprobada. El comando de publicación reproduce la configuración del deploy exitoso, sin ejecutar una publicación duplicada.

**CHANGED:** instrucciones compartidas y START-HERE apuntan al comando único; guía de deployment reducida al procedimiento vigente y versión histórica archivada. No requiere que Franco derive la tarea a Infra. Detalles: `docs/lanes/reports/CLAUDE-DEPLOY-BLOCK-2026-09-17.md`.

## [2026-09-17] — Login producción verificado y preparación GitHub

**FIXED / VERIFIED:** configuración runtime auth/ElevenLabs incorporada a production y reconstrucción concurrente conservada; el lane de reparación evitó duplicar publicación y verificó login real de la cuenta existente hasta Overview, sesión200 y anónimo401. Sin cambio de contraseña/rol/RLS. Evidencia en LOGIN-REPAIR-2026-09-17.md. La comprobación previa de /200 no acreditaba login completo.

**ADDED / CHANGED:** Git local main inicializado y .gitignore preparado para excluir credenciales, artifacts y estado local; configuraciones compartidas y fixtures sintéticos siguen versionables. Sin stage/commit/remoto. GitHub pendiente del nombre/acceso de la otra cuenta u organización elegida explícitamente por Franco; no crear en fcappanera. Reporte GITHUB-SETUP-2026-09-17.md.

## [2026-09-17] — Simplificar publicación y reparar acceso Vercel

**CHANGED:** REVIEW-PROTOCOL reescrito; START-HERE reducido y prompts iniciales archivados como históricos; reglas IA espejo consolidadas, prompts actuales y entradas actualizados. Pedido explícito de publicar autoriza entrega en el alias habitual, sin permisos redundantes ni localhost como sustituto. Preservar login NBC y verificar acceso sin barrera del proveedor después de publicar.

Request: Franco informa bloqueo Vercel y exceso de trámites. Reparación ejecutada por infraestructura: protección legacy cambiada a Standard Protection; mismo deployment producción, dominio habitual /200/login NBC y APIs privadas401. Sin nuevo deploy ni cambio de alias. Evidencia en docs/lanes/reports/ACCESS-REPAIR-2026-09-17.md. No se reconstruye la aplicación para corregir acceso.

## [2026-09-17] — OR04: arranque de tres productos y lane de soporte

**ADDED / CHANGED:** encargos OR04 C08/L03/TR01/I10; nombres, modelos iniciales, cuatro prompts, ACTIVE-LANES, entradas, decisiones y reglas espejo. Master Dashboard agrupa trackers; Infra pasa a Conexiones e Integración. Accesos informados por Franco se distinguen de verificación remota. Request: «hoy el lead engine quede ya activo», preparar Caller con Twilio/ElevenLabs y explicar chats/modelos/dinámica.

Validación documental de enlaces, tareas y modelos; sin cambios runtime, consumo de proveedores, push o deploy. No se lanzan automáticamente los chats externos.

## [2026-09-16] — Orquestador Astra y prompts operativos por lane

**CHANGED / ADDED:** ACTIVE-LANES y cuatro prompts completos; MODEL-ROUTING v2, override fijo orchestration→Astra en política/selector (cambio delegado a Terra), regresiones, reglas espejo, estado y template. Se indica qué chats continúan, cuáles pausar y handoff sin escritores duplicados. Lanes deben pedir cambios manuales de modelo y retorno al base por fase; root siempre Astra por instrucción explícita.

Request: «el Orquestrador siempre usando Astra» y «crees instrucciones para todos los lanes». Sin cambios de aplicación, cuentas, modelos de chats abiertos, push ni deploy. Validación final en reporte OPT02.

## [2026-09-16] — Distribución de chats por plataforma

**CHANGED:** MODEL-ROUTING y README de lanes registran recomendación de cinco chats: root orquestador, dos lanes Codex y dos Claude. Request: «dos lanes en ChatGPT, dos lanes en Claude, siempre abiertos». No se lanzan tareas ni modifican modelos de chats abiertos. Revisión documental; sin cambios runtime ni pruebas adicionales.

## [2026-09-16] — Selección de modelos por tarea y rol de orquestador

**ADDED / CHANGED:** MODEL-ROUTING, política JSON, selector local y pruebas delegados a Terra, plantilla de costos; defaults proyecto Codex/Claude e inventario delegados a Luna. Reglas espejo, entrada de lanes y estado reflejan root solo coordinador/revisor. Referencias oficiales y distinción crédito Codex / USD API / cuota incluida en MODEL-ROUTING. No se anuncian ahorros medidos ni controles de gasto cloud.

Request: «no quiero que hagas todo vos», «un sistema de optimización de tokens en base a la tarea». Trabajo de producto no reasignado todavía; no cambios de aplicación ni cloud, push o deploy. Evidencia final en docs/lanes/reports/OPT01.md.

## [2026-09-16] — L02 acceso Lead Engine e I10/T1 locales

**FIXED / SECURITY:** nuevo lead-engine-auth en los dos adaptadores bloquea operador suspendido/degradado/sin membresía antes de research. Doce operaciones cubiertas por tests/lead-engine-access. T1: tsconfig excluye artifacts históricos; fixtures academy-covers usan bytes compatibles. Feature, API, seguridad, arquitectura, estado, handoff y lookup actualizados.

**Validación:** 66 pruebas Lead Engine, 188 integradas, typecheck exit0. Transporte controlado; sin prueba remota, SQL, push ni deploy. Request: «q paso? Segui laburando», bajo prioridades funcionales OR03. Reporte y límites: docs/lanes/reports/L02.md. Scraper real todavía depende de proveedor e insumos.

## [2026-09-16] — OR03: efectividad y control de tokens

**CHANGED / ADDED — documentación:** tareas OR03, estado actual, decisiones, coordinación/START-HERE/OR02, feature de orquestación y reglas IA espejo. Franco prioriza Caller real, scraper útil hoy y Master Tracker; reporta $400 en tokens en dos días. Se pausan Academy/estética y se definen entregas incrementales y revisión sin duplicación. Desglose de gasto y referencia del tracker pendientes. No se establece ahorro medido, proveedor nuevo ni presupuesto autorizado.

**Validación:** enlaces relativos de documentos afectados y coincidencia de reglas espejo. Sin cambios runtime, tests de aplicación nuevos, consumo de proveedores, SQL, push ni deploy. Encargos preparados para chats existentes, no ejecutados automáticamente.

## [2026-09-16 11:46 EDT] — OR02: revisión integrada de Infra, Caller y Lead Engine

### Tipo y archivos
- **ADDED**: estado actual único `docs/00-current-state.md`, reporte OR02, tareas por lane y `docs/reference/runtime-contract-index.md`.
- **CHANGED**: esquema/API, arquitectura, seguridad, deployment, decisiones, overview/README, mapa de lanes y reglas IA espejo.
- **ADDED**: evidencia local y reproducciones controladas en `artifacts/orchestrator/platform-review-20260916/`.

### Descripción y validación
Se revisan consolidados I01-I09/C01-C07/L01-r9, conservando atribución a sus lanes y OR01.177 unitarias pasan; typecheck exit2 por T1. Alias GET real L01-r9 READY/staging;234 archivos manifest coinciden con fuente local y7 migraciones con hashes de aplicación históricos. Reproducciones controladas confirman L-AUTH operador suspendido admitido por plans, recovery Caller trabado, onboarding true→null y retry evento409. Otras pérdidas de drafts/audio detectadas por inspección. No runtime modificado, SQL/proveedores/push/deploy ejecutados ni aprobación de Franco inferida. Dependencias de telefonía, scraper comercial, créditos y Academy siguen explícitas.

### Entrada del usuario
Tres reportes consolidados remitidos por Franco: «NBC Sales: infraestructura, membresías y dashboard», «Lead Engine / NBC Sales» y «Caller / NBC Sales». Se aplica el flujo previo acordado de revisión por el orquestador; no se inicia un piloto comercial al recibirlos.

## [2026-09-15 16:34 EDT] — Revisión OR01 y consolidación Academy/S01/KCAL01

### Tipo y archivos
- **ADDED**: reporte OR01 y devolución `docs/lanes/tasks/OR01-review-corrections.md`; evidencia en `artifacts/orchestrator/academy-review-20260915/`.
- **CHANGED**: DB_SCHEMA/API_DOCS, arquitectura, seguridad, deployment, overview, decisiones, README/mapa de lanes, CLAUDE y reglas espejo.

### Consolidación de entregas previas (no código nuevo de OR01)
K01-r6: editor admin, import planillas/JSON, manifiesto v1/v2, outline22 títulos, portadas propias y aula demo; SQL/Storage real pendiente. S01: sesión fija12h entre pestañas, preservadas mejoras posteriores Infra. KCAL01: calendario mensual vacío/carga/error y navegación, sin conexión externa nueva. Esos cambios pertenecen a sus lanes y fechas, con evidencia en reportes originales. Se consolidan esquema propuesto, seis operaciones Academy, seguridad y trazabilidad de snapshots sin afirmar aplicación de DB.

### Resultado de revisión
37 unitarias nuevas pasan. Typecheck actual exit2 por artifacts históricos y tipos de tests de portada. Hallazgos A1 (pérdida JSON pendiente), A2 (JPEG no decodificable admitido, reproducción ejecutada), S1 (logout/login concurrentes), CAL1 (selección calendario ante refresh) y T1 (typecheck). Devolución a propietarios; no cambios runtime. Hash tar y manifiesto canónico KCAL01 verificados;33 archivos del alcance coinciden,17 ajenos cambiaron después. Sin nuevo browser/build/consulta remota, SQL, push, merge, tag o deploy.

### Request / entrada recibida
Reporte consolidado remitido por Franco: «Academy, Ask Anas, sesión y calendario», K01 + S01 + KCAL01; continuidad del flujo acordado de revisión por el orquestador. Los requests de implementación previos constan en ese reporte: «editar programa», «solo los admins», «por 12 horas» y «Aunque el calendario no tenga nada todavía, debería estar igual ahí». No se infiere nueva autorización de publicación.

## [2026-09-14 16:06 EDT] — Prompts AInnovate completos y revisión de Franco antes del push

### Tipo de cambio y archivos
- **CHANGED**: cuatro prompts extensos en `docs/lanes/START-HERE.md`, tareas I01/C01/L01/K01, ownership y template de reportes.
- **ADDED**: `docs/lanes/REVIEW-PROTOCOL.md`, features `lane-orchestration.md` y `platform-delivery.md`.
- **CHANGED**: README, arquitectura, deployment, decisiones, CLAUDE y reglas espejo para reflejar revisión obligatoria antes del push.

### Descripción
Franco solicita instrucciones completas basadas en AInnovate y revisión propia previa a cualquier push. Se documentan lecturas, ejecución, ownership, criterios de aceptación, autorrevisión, reporte reproducible, consolidación documental, revisión técnica y aprobación explícita del candidato. Vercel sigue primero: conexión y baseline inicial autorizados; cambios nuevos se preparan para revisión antes de publicar, sin eludirla mediante CLI/API o auto-deploy. Infra entrega enlace verificado, evidencia y recorrido de presentación. No se ejecutan las tareas de los lanes durante esta actualización.

### Validación
Revisión documental de rutas, coherencia de autorizaciones y cuatro prompts completos; ver feature lane-orchestration para resultado. No cambios runtime ni pruebas runtime nuevas, sin push, deploy o modificaciones cloud en este request.

### Request original
> Quiero que uses el método innovate para dar las instrucciones, que sepan bien qué hacer, que no puedan hacer, cómo me tienen que dar la output a mí y las revisiones.

> Antes de pushear cualquier cosa, yo reviso y ahí pushean.

> Lo más importante es que ya empiecen a hacer la conexión con Vercel

## [2026-09-14 15:50 EDT] — Cuatro lanes externos y entrega Vercel preparada

### Tipo y archivos
- **ADDED**: tareas I01/C01/L01/K01, template de reporte, handoffs Infra/Academy y snapshot runtime con manifest/SHA256 en `artifacts/releases/20260914-154226/` y `docs/lanes/BASELINE.json`.
- **CHANGED**: protocolo/prompts `docs/lanes/`, README, arquitectura, decisiones, deployment, skills y reglas IA compartidas.

### Descripción y validación
Se preparan cuatro chats Codex Local con ownership exclusivo y reportes al orquestador. I01 tiene autorización explícita para publicar primero en Vercel desde una copia congelada; los otros lanes avanzan Caller, ledger Lead Engine y persistencia Academy. No se ejecutaron estas cuatro tareas en esta entrega. Verificación cloud de solo lectura: equipo Vercel reconocido y cero proyectos, Supabase activo. Snapshot revisado sin .env ni exportaciones de datos; conserva la fuente de la entrega previa validada (27 unitarias, 10 E2E, build/TypeScript). Sin cambios de aplicación ni nuevas pruebas runtime; no hay despliegue efectuado.

### Request original
> Armemos cuatro lanes más

> El que esté creando la infraestructura, lo primero que tiene que hacer es conectarlo con Vercel.

> pasame los prompts para darle a cada chat.

## [2026-09-14 15:36 EDT] — Plataforma NBC Sales y tres lanes integrados

### Tipo de cambio
- **ADDED**: master dashboard, rutas por módulo, preparación Academy/Ask Anas y Lead Engine.
- **CHANGED**: Caller integrado con métricas recientes, búsqueda/filtros, exportación TXT verificada y mute; demo anterior movida a `/demo`.
- **ADDED**: coordinación de tres agentes, ownership de archivos y prompts/handoffs para conversaciones externas.

### Archivos afectados
- `src/app/page.tsx`, `layout.tsx`, `(workspace)/layout.tsx`, páginas Caller/Lead Engine/Academy/Ask Anas/Integrations, wrapper Integrations y `Workspace.module.css`, `demo/page.tsx`.
- `src/components/platform/`: PlatformShell, PlatformHome, AcademyWorkspace, AskAnasWorkspace, tipos y CSS Module.
- `src/components/lead-engine/`: LeadEngine y CSS Module; `src/lib/lead-engine-plan.ts`, `lead-engine-quality.ts`.
- `src/components/dashboard/Caller.tsx`, `Caller.module.css`, `src/lib/caller-insights.ts`; `src/lib/academy-types.ts`, `academy-manifest.ts`.
- Tests Academy, Caller insights/workspace y Lead Engine; tests platform y ajustes de rutas de tests existentes.
- `docs/lanes/`, `docs/sources/`, nuevas features master-platform/lead-engine, documentación global, README y lookup de reglas IA.
- `artifacts/platform/`: capturas locales públicas de módulos; `artifacts/caller/master-workspace-result.png`: resultado privado comprobado.

### Descripción
El usuario cambia el alcance a una plataforma central NBC Sales con Caller, herramientas, curso Skool y Ask Anas, y autoriza producción paralela. Tres agentes con propiedad exclusiva de archivos implementaron lanes Caller, plataforma y Lead Engine; el orquestador integró rutas, documentación, pruebas y revisión. Stack/paleta existentes conservados, sin dependencias nuevas. Los dos adjuntos se copiaron íntegros como fuentes; sus imperativos para Claude, costos y afirmaciones no se ejecutaron ni se adoptaron como hechos verificados.

Academy prepara manifiestos locales con validación de versión/jerarquía/IDs/límites y referencias HTTPS sin fetch/iframe; no migra videos ni persiste cursos. Ask Anas está pendiente de corpus. Lead Engine solo planifica y descarga drafts; motor puro incluye filtros/ledger/verificación fail-closed y presupuesto en cents, sin ledger persistente/proveedor conectado ni scraping real. Las listas no se transfieren al Caller/SMS. Caller conserva backend existente y agrega operación/análisis del historial de hasta treinta sesiones.

### Validación y cambios externos
Build/TypeScript, 27 unitarias y 10 E2E aprobados. Verificación visual desktop/móvil y navegación directa sin errores de navegador/overflow. Auth Supabase real recuperó transcripción previa y export disponible; no se iniciaron nuevas llamadas. Se corrigieron selectores ambiguos de tests y label accesible de filtro durante integración. Sin cambios de tablas, credenciales, proveedor remoto, gastos de scraping ni deploy. Mute usa el SDK real y queda por ensayar con micrófono humano.

### Request original
> la idea ahora es crear un master dashboard para NBC Sales

> Quiero abrir otras conversaciones con ChatGPT y que vos funciones como orquestador

> Otro que esté trabajando en un scraper que me pasó hoy, que tengo un par de documentos que te voy a juntar en este mensaje con lo que quiere crear.

## [2026-09-14 11:24 EDT] — Caller de voz funcional en navegador

### Tipo de cambio
- **ADDED**: workspace privado Caller con micrófono, transcripción en vivo, historial, duración y resumen persistentes.
- **ADDED**: agente interno ElevenLabs, reserva idempotente de sesiones y sincronización verificada del proveedor.
- **CHANGED**: autorización retorna UUID para filtrar propietario, navegación distingue pruebas reales de demo, documentación y lookup actualizados.

### Archivos afectados
- `src/components/dashboard/Caller.tsx`, `Caller.module.css`, `Dashboard.tsx`, `Dashboard.types.ts`.
- `src/services/caller.service.ts`, `elevenlabs.service.ts`, `integration.service.ts`.
- `src/lib/caller-types.ts`, `caller-validation.ts`; rutas `src/app/api/caller/sessions/route.ts` y `sessions/[id]/sync/route.ts`.
- `supabase/migrations/202609140001_call_sessions.sql`, `config/nbc-test-agent.json`, `scripts/setup-caller.mjs`.
- `tests/caller-validation.test.ts`, `tests/caller.spec.ts`, `package.json`, `package-lock.json` (`@elevenlabs/client` 1.25.0).
- `.env.example`, `.env.local` ignorado (solo nuevo ID del agente), `.vercelignore`, `README.md`, `docs/` y reglas compartidas de IA.
- `artifacts/caller/`: capturas privadas de conexión, resultado y móvil, excluidas de despliegue.

### Cambios externos
Aplicada migración call_sessions en Supabase NBC Caller mediante Management API SQL. Creado un agente privado ElevenLabs con voz premade Roger, inglés, LLM gestionado, sin herramientas ni grabación de audio, máximo cinco minutos, concurrencia uno y veinte conversaciones diarias. Guardado su ID exclusivamente en configuración local. No se adquirieron números, clonaron voces, llamaron teléfonos ni modificaron GHL/Vercel. ElevenLabs es una elección provisional comunicada, no una aprobación del proveedor comercial final.

### Validación
Build/TypeScript, seis pruebas unitarias y cinco E2E pasaron. Primera conexión real con saludo y audio guardada (2 s); segunda con entrada sintética, transcripción y respuesta hablada (27 s, tres turnos y resumen). No es evaluación humana de naturalidad o calidad comercial. Replay devuelve 409; sesión inexistente 404. RLS, permisos y unicidad activa verificados remotamente. Nuevo login recupera resultado; móvil sin desbordamiento; sign-out limpia workspace. Resultados terminales protegidos contra respuestas tardías. Tokens nunca registrados. Supabase aún no tiene eliminación automática de transcripciones y la sincronización depende de la UI o refresco manual.

### Request original
> bueno, ahora si, A hacer funcionar el Caller

## [2026-09-12 23:24 EDT] — Dashboard visual y capturas para presentación

### Tipo de cambio
- **CHANGED**: cabecera Overview con identidad NBC, jerarquía tipográfica, métricas, tablas y detalle de conversación.
- **ADDED**: presentación visual del agente Anas y siete capturas PNG con ZIP.

### Archivos afectados
- `src/components/dashboard/Dashboard.tsx`, `Dashboard.module.css`: hero NBC, onda decorativa, resumen de llamadas y refinamientos visuales.
- `src/components/dashboard/AgentShowcase.tsx`, `AgentShowcase.module.css`: ficha de voz conceptual y playbook propuesto.
- `artifacts/presentation/`: siete capturas del navegador y `nbc-dashboard-preview.zip`.
- `.vercelignore`: exclusión de artefactos de presentación.
- `README.md`, `docs/02-architecture.md`, `docs/05-product-decisions.md`, `docs/features/dashboard-ghl-test.md`: prioridad visual, estructura y resultado.

### Validación
Build/TypeScript y cuatro E2E pasaron. Revisión visual de capturas de overview, agente, conversación y móvil; anchuras desktop/mobile sin desbordamiento. Archivo ZIP comprobado con siete PNG. Los datos siguen siendo demo, las ondas son decorativas y no hay audio ni llamadas reales. No se modificaron servicios cloud ni credenciales. Se entregó guía Vercel basada en permisos oficiales de creación y Scope del token.

### Request original
> decime como actualizar eso de vercel

> segui trbajando a nivel visual en el dashboard asi les puedo mandar screeen

> despues empzamos a haceerlo funcional

## [2026-09-12 23:15 EDT] — Supabase conectado y verificación de credenciales

### Tipo de cambio
- **ADDED**: tabla de eventos y operador confirmado en Supabase NBC Caller.
- **FIXED**: login del workspace antes de configurar GoHighLevel.
- **CHANGED**: pruebas E2E compatibles con credenciales locales configuradas y estado de infraestructura.

### Archivos afectados
- `.env.local` (ignorado): IDs verificados y contraseña inicial del operador, permisos locales 0600; valores existentes conservados.
- `src/app/api/integrations/events/route.ts`, `src/components/dashboard/Integrations.tsx`: workspace autenticado vacío y estado GHL pendiente.
- `tests/dashboard.spec.ts`: aislamiento del caso sin configuración y validación de respuesta sin secretos.
- `README.md`, `docs/01-project-overview.md`, `02-architecture.md`, `03-security.md`, `04-deployment.md`, `DB_SCHEMA.md`, `API_DOCS.md`, `features/dashboard-ghl-test.md`: resultado y límites.

### Cambios externos
Aplicada sin modificar su contenido la migración `202609120001_integration_events.sql` a NBC Caller mediante Management API SQL. Creado el operador configurado, confirmado y con contraseña aleatoria guardada solo localmente; sin enviar emails. Completados los IDs del proyecto/organización Supabase y equipo Vercel. Vercel rechazó crear el proyecto con HTTP 403 por falta de permisos; sin proyecto ni despliegue remoto.

### Validación
OpenAI, Anthropic y ElevenLabs respondieron HTTP 200 a consultas de metadatos autenticadas, sin generación. Login Supabase real, workspace sin GHL y logout verificados en Chrome. Lectura de servicio permitida; anon/authenticated rechazados en la tabla; token inválido rechazado por la API. Unicidad y RLS verificadas con transacción revertida. Build/TypeScript, tres pruebas unitarias y cuatro E2E pasaron. No se afirma integración GHL o voz, ni validación de facturación/créditos de IA.

### Request original
> listo todo en el .env

## [2026-09-12 17:37 EDT] — Preparación de claves de IA y guía de accesos

### Tipo de cambio
- **ADDED**: campos privados para OpenAI, Anthropic/Claude y ElevenLabs.
- **CHANGED**: aclaración del operador Supabase Auth y guía de tokens/identificadores.

### Archivos afectados
- `.env.example`, `.env.local` (ignorado): campos de IA y comentario del operador; referencia del proyecto derivada de la URL solamente en configuración local.
- `README.md`, `docs/04-deployment.md`, `docs/05-product-decisions.md`, `docs/features/dashboard-ghl-test.md`: configuración, alcance y decisiones.

### Descripción y validación
Se preservaron todos los valores existentes y se comprobó que no hay variables duplicadas. Claude usa ANTHROPIC_API_KEY; no necesita una segunda clave. Los nuevos campos no son consumidos por la aplicación. Retell y Twilio quedan para más adelante. No se realizaron llamadas externas con credenciales, migraciones ni despliegues. Validación local de estructura y preservación de valores; sin cambios de código que requieran repetir pruebas de aplicación.

### Request original
> en supabase todo ready, me falta nada mas lo de operator email que no se que es

> retell y twilio lo agregamos cuando haga falta

> Agrega al .env las apis de claude y antrhopic y elevenlabs que necesites asi ya las arego

> El vercel token, supabase organization id, supabase access token supabase project ref y etc no se donde buscarlos asi que necesito que me guies

## [2026-09-12 17:16 EDT] — Identidad NBC y acceso cloud por API

### Tipo de cambio
- **CHANGED**: identidad visual conforme a las referencias del usuario: azul noche, blanco y amarillo.
- **ADDED**: campos locales de administración, comprobación cloud de solo lectura y exclusiones de despliegue.

### Archivos afectados
- `src/styles/variables.css`, `src/components/dashboard/Dashboard.module.css`, `Integrations.module.css`, `Dashboard.tsx`: paleta, navegación, botones, gráficos y encabezado tipográfico provisional.
- `.env.example`, `.env.local` (ignorado): nombres de tokens y selectores, conservando valores previos.
- `scripts/check-cloud-access.mjs`: consulta segura de metadatos Supabase/Vercel; no crea recursos.
- `.vercelignore`: exclusión de secretos y material interno del upload.
- `README.md`, `docs/02-architecture.md`, `03-security.md`, `04-deployment.md`, `05-product-decisions.md`, `SKILLS.md`, `features/dashboard-ghl-test.md`, archivos de reglas: decisiones, operación y lookup.

### Descripción y validación
Aplicada la paleta de referencia; no se vectorizó ni incrustó el logo exacto porque los adjuntos no están disponibles como archivos locales. Build y TypeScript correctos; cuatro E2E pasaron, incluyendo móvil. Captura de escritorio revisada. El script cloud detectó ambos tokens pendientes y no realizó llamadas externas. La sugerencia de plugin no fue confirmada; el usuario prefirió API tokens. Supabase, Vercel y GHL siguen sin conexión verificada.

### Request original
> este es el logo de NBC oara los lineamientos visuales

> Ya pedi acceso a GHL, cuando me conteste te aviso. Tod lo demas lo podemos ir conectado, supabase, vercel, etc

> no es mas facil darte los API tokens y todo eso?

## [2026-09-12 17:01 EDT] — Dashboard demo e integración de prueba

### Tipo de cambio
- **ADDED**: aplicación Next.js/TypeScript, dashboard en inglés y endpoints de prueba GoHighLevel/Supabase.
- **CHANGED**: stack aprobado, Estados Unidos/inglés confirmados y dashboard priorizado antes del vertical.
- **FIXED**: desbordamiento horizontal en vista móvil detectado por E2E.

### Archivos afectados
- `src/app/`: página, layout, error y cuatro route handlers de integración.
- `src/components/dashboard/`: dashboard, integración, CSS Modules y tipos.
- `src/lib/`, `src/services/`, `src/styles/`: fixtures, métricas, validación, servicios privados y sistema visual.
- `supabase/migrations/202609120001_integration_events.sql`: tabla y restricción de idempotencia; no aplicada remotamente.
- `tests/`, `playwright.config.ts`: tres pruebas unitarias y cuatro E2E.
- `package.json`, `package-lock.json`, `tsconfig.json`, `next-env.d.ts`, `next.config.ts`: app y dependencias.
- `.env.example`, `.gitignore`, `README.md`: configuración y receta de test; `.env.local` creado con valores vacíos y excluido.
- `docs/01-project-overview.md`, `02-architecture.md`, `03-security.md`, `04-deployment.md`, `05-product-decisions.md`, `API_DOCS.md`, `DB_SCHEMA.md`, `features/isa-speed-to-lead.md`, `features/dashboard-ghl-test.md`: alcance y estado reales.
- `CLAUDE.md`, `.github/copilot-instructions.md`, `.windsurfrules`, `.cursorrules`, `.clinerules`: reglas y lookup sincronizados.

### Descripción detallada
Dashboard navegable con 64 llamadas ficticias, métricas derivadas, gráficos, filtros, búsqueda, exportación CSV, detalle, contactos, citas y perfil demo del agente. Integrations diferencia configuración de conexión verificada y permite login de operador, lectura de contacto GHL y consulta de eventos. Webhook autenticado con validación de cuenta e idempotencia por restricción SQL. Sin proveedor de voz, llamadas reales, notas CRM ni reservas reales. Credenciales, migración remota y URL pública pendientes.

### Validación
TypeScript, build de producción, 3 pruebas unitarias y 4 E2E pasaron. Capturas de escritorio/móvil revisadas. Los primeros intentos de navegador y servidor fueron bloqueados por sandbox y se repitieron con autorización. No se verificó una conexión real a GoHighLevel o Supabase por falta de cuentas configuradas.

### Request original (extractos textuales)
> Lo que sí te puedo decir es que vas en Estados Unidos, en inglés, y no sé qué tipo de cita. Pero vamos a construir ya.

> Quiero ya tener el dashboard lo antes posible para mostrarle a él y poder hacer un test integration a Go High Level para empezar los primeros tests y todo eso.

> Usar Next.js + TypeScript + Supabase

## [2026-09-12 16:26 EDT] — Base documental y definición inicial

### Tipo de cambio
- **ADDED**: documentación inicial de AInnovate, reglas para IA y borrador funcional del Producto 1.

### Archivos afectados
- `docs/01-project-overview.md`: contexto, prioridades, alcance y estado.
- `docs/02-architecture.md`: estructura real, decisiones confirmadas y arquitectura conceptual propuesta.
- `docs/03-security.md`: requisitos de datos, acceso y despliegue médico pendientes de implementar/verificar.
- `docs/04-deployment.md`: estado sin despliegues.
- `docs/05-product-decisions.md`: decisiones y preguntas de descubrimiento.
- `docs/DB_SCHEMA.md`: registro base, sin tablas implementadas.
- `docs/API_DOCS.md`: registro base, sin endpoints implementados.
- `docs/SKILLS.md`: capacidades visibles; sin instalaciones nuevas.
- `docs/features/isa-speed-to-lead.md`: funciones del brief, recorrido y evaluación propuestos.
- `CLAUDE.md`, `.windsurfrules`, `.cursorrules`, `.clinerules`, `.github/copilot-instructions.md`: reglas del proyecto y tabla de lookup.
- `.aider.conf.yml`: referencia de lectura a las mismas reglas en `CLAUDE.md`.
- `.gitignore`, `.env.example`: exclusión de configuración privada y plantilla sin credenciales.
- `CHANGELOG.md`: historial inicial.

### Descripción detallada
Se leyeron el método y el handoff. Se inició la parte documental de la fase 1, preservando las fuentes originales. Se registraron GoHighLevel y dashboard propio como requisitos explícitos del usuario, manteniendo el stack pendiente de elección conjunta. Los datos de proveedores del brief se identificaron como referencias sin verificar. El borrador de recorrido, métricas y arquitectura es una propuesta, no una implementación ni un alcance final aprobado.

La inicialización técnica de la fase 1 queda pendiente del stack. No se instalaron dependencias, conectaron servicios, crearon esquemas ni realizaron llamadas o despliegues. La configuración de Aider remite a las reglas compartidas en lugar de copiar instrucciones en una clave de configuración del ejemplo; no se ha probado ningún IDE.

### Validación
Se comprobó la existencia de los archivos previstos, los enlaces relativos de documentación y la coincidencia de las reglas compartidas. Sin pruebas de aplicación: no existe código ejecutable.

### Request original (extractos textuales)
> Bueno, primero, para empezar, lee el método Innovate para que tengas las instrucciones del proyecto. Siguiente, lee el otro documento que tienes en la carpeta.

> Todo esto se tiene que poder conectar con GoHighLevel porque la mayoría de sus clientes usan GoHighLevel. También tenemos que poder tener un propio dashboard donde puedan haber reportes y breakdown de cómo está funcionando todo.

> Eso lo vamos a ir definiendo vos y yo, pero sí para que veas las funciones que quieran asumir.
