# Master Tracker — TR01, definición inicial (2026-09-17)

Lane Master Dashboard/trackers, modelo Sonnet/medio salvo fase indicada. Este documento es la entrega inicial pedida por `docs/lanes/tasks/OR04-start-2026-09-17.md`: contrato revisable y decisiones abiertas. Integra al portal existente (Overview); no crea otro dashboard global. Ownership: esta familia `master-tracker.md`, futura `docs/features/tracker-*.md` y `src/components/tracker/`.

**Corrección de ownership (2026-09-17, instrucción directa de Franco):** las conexiones de este tracker (Meta, Stripe, iClose/GHL, etc.) se resuelven en este lane junto con Franco, no se delegan por defecto a Infra/I10 como decía la asignación previa de OR04/OR03. Esto reemplaza la frase "Infra integra navegación/auth" para el alcance de conexiones de datos del tracker. Se preserva sin cambio: un solo publicador/push con autorización de Franco, y no se tocan shell/auth comunes de otros módulos sin coordinar. Señalar al orquestador este cambio para que no se dupliquen tareas con I10.

## Referencia recibida: Calyx (Loom + screenshots, 2026-09-17)

Franco compartió screenshots y transcript de Calyx, una plataforma de tracking para ofertas high-ticket. Resumen funcional verificado contra las capturas:

- **Dashboard con vistas por tabs** (Overview, Ecosystem Health, Closer Performance, Setter Performance, Meta Ads Health, Sales Data, Ad Platforms, Funnel %, vistas custom): widgets arrastrables/redimensionables, cada uno con una métrica y su serie temporal (Revenue, Total Calls, Calls Showed, Show Rate, Closes, Closing Rate, AOV).
- **Ecosystem Health**: feed en vivo de eventos (nuevo lead, con nombre/email/estado/hace cuánto), no solo agregados.
- **Closer/Setter Performance**: métricas por persona (Total Calls, Show Rate, Showed Calls, Offers Made, Closing Rate, Closed Calls, Revenue, AOV) — exige atribuir cada llamada a un rep.
- **Meta Ads Health / Ad Platforms**: tabla por campaña (Ad Spend, Total Calls, Cost Per Call, Closing Rate, Show Rate, Total Revenue, ROAS, Sales) y agregados (Ad Spend, Cash Collected, CAC, Cost Per Call Booked, ROAS agregado). Requiere Meta Ads conectado y atribución de cada call a campaña/adset (`First Source`, `First Campaign`, `Last Source`, `Last Campaign`).
- **Constructor de métricas custom**: fórmulas propias (ej. "Cost Per Call = Ad spend + fixed costs / calls booked"), por fuente/atribución/breakdown.
- **Funnel %**: embudo completo Impressions → Clicks → Total Leads → Total Calls → Calls Booked → Showed Calls → Sales, con conteos reales en cada paso.
- **CRM** (Leads/Calls/Dials/Sales): cada contacto con Call Outcome, Stage, First/Last Source, First/Last Campaign; ficha de contacto con customer journey completo (eventos Meta, emails, mensajes) y **Conversions** (pagos + eventos enviados de vuelta a Meta con valor, ej. enviar $10,000 de valor por una venta de $6,000).
- **Deal Analysis**: por llamada, lead scoring (0–100) con desglose por factor (Authority, Desire Clarity, etc.), avatar/segmento asignado, objection analysis con timestamps, transcript, AI chat sobre la llamada. Se nutre de grabación/transcript (nota propia o Fathom/Fireflies) e integra con CRM/formularios (Calendly, Typeform).
- **Avatars**: perfiles agregados por segmento (demographics, psychographic, pain points, language bank) derivados de las llamadas analizadas, con conversion rate del segmento.
- El diferencial que remarca el video: todo se conecta directamente a las plataformas de origen (CRM, ad accounts, calendario, IA), no a exports manuales, y se manda de vuelta a Meta señal de calidad basada en lo que pasó en la llamada (CAPI con valor ajustado), no solo el evento de conversión crudo.

**Objetivo de Franco:** construir algo "20 veces mejor que Calyx". Infraestructura de conexiones por cliente: cada cliente conecta sus propias cuentas (iClose/GHL, Stripe, Meta, etc.). Es un programa grande, no una entrega de un día; se aborda por fases.

## Fases propuestas (para acordar antes de codear)

1. **Fase 0 — contrato de datos y modelo de conexiones (Sonnet/medio, este documento).** Definir el esquema de "conexión" (proveedor, cliente/workspace, estado: no configurada/verificada/bloqueada — igual vocabulario que I10 para no duplicar — sin guardar credenciales en texto plano ni en este repo) y el contrato de métricas (tabla de inventario abajo, ampliada con lo que exige Calyx: atribución por campaña, revenue, rep, lead score).
2. **Fase 1 — una sola fuente end-to-end.** Elegir un proveedor primero (ver pregunta abajo) e implementar conexión real + una vista concreta (ej. "Ad Spend" o "Cash Collected"), antes de tocar los demás. No construir las nueve tabs de Calyx en paralelo.
3. **Fase 2+ — resto de fuentes y features (CRM/journey, lead scoring, avatars, envío de valor a Meta vía CAPI).** Cada una es upstream de la siguiente (necesitás CRM+Stripe antes de poder calcular ROAS real; necesitás transcript antes de lead scoring).

**Fase de riesgo distinto, según protocolo de modelo:** guardar credenciales de cliente (OAuth tokens/API keys) con aislamiento multi-tenant real es del tipo "aislamiento multiempresa" del protocolo. Para esa fase puntual (no para el diseño del contrato) voy a pedir Opus/alto y volver a Sonnet después. Todavía no estoy en esa fase.

## Pregunta abierta para Franco (bloquea Fase 1)

**Resuelto (2026-09-17):** arrancamos con GHL porque es el único acceso real que tenés hoy. Meta/Stripe quedan como conectores del mismo contrato, sin credenciales, para que conectarlos después sea agregar el env var y llenar el servicio — no rediseñar nada.

## Implementación entregada (Fase 0+1 parcial, GHL real)

Contrato genérico `TrackerSnapshot` (`src/lib/tracker-types.ts`): cualquier proveedor devuelve `{ provider, fetchedAt, range, appointments, pipeline }`; ausencia de dato es `null`, nunca `0`. Mappers puros `mapGhlAppointments`/`mapGhlOpportunities` validan forma, descartan registros de otra location y separan "sin evidencia" de "cero", con 5 pruebas unitarias (`tests/tracker-ghl.test.ts`) sin red.

`src/services/tracker-ghl.service.ts`: conexión real a GHL (`services.leadconnectorhq.com`, header `Version: v3`) reutilizando el mismo credential único de servidor que ya usa `integration.service.ts` (`GHL_PRIVATE_INTEGRATION_TOKEN`/`GHL_LOCATION_ID`) — no se agregó almacenamiento de secretos nuevo. Llama `POST /opportunities/search` (pipeline: abiertas/ganadas, valor ganado en cents) y `GET /calendars/events` (citas por estado) si `GHL_CALENDAR_ID` está configurado; si no, citas quedan `null` en vez de inventar un calendario. **Los nombres de campo (`monetaryValue`, `pipelineStageId` implícito en `status`, `appointmentStatus`) están tomados de la documentación pública de GHL API v2 y no fueron verificados contra una respuesta real de esta cuenta** — antes de confiar en las cifras hay que correrlo una vez contra el location real y confirmar el shape.

`src/services/tracker-meta.service.ts` y `tracker-stripe.service.ts`: mismo contrato (`fetchXSnapshot(range): Promise<TrackerSnapshot>`), hoy devuelven 503 "no configurado" porque no hay credenciales. Este es el punto de "cambiar la API": cuando tengas acceso a Meta/Stripe, se completa `metaConfigured()`/`fetchMetaSnapshot()` igual que se hizo con GHL, sin tocar el resto.

`src/services/tracker-connections.ts`: agrega estado (`not_configured`/`configured`) de los tres proveedores sin hacer red, para un futuro panel de "estado de conexiones" — vocabulario compartido con I10 para no duplicar.

`.env.example`: agregadas `META_ACCESS_TOKEN`/`META_AD_ACCOUNT_ID` y `TRACKER_STRIPE_SECRET_KEY` (deliberadamente distinta de `STRIPE_SECRET_KEY`, que es la cuenta de NBC para Credits, no la del cliente).

**No incluido todavía:** `fetchGhlSnapshot` no se llamó contra la API real (no hay credenciales cargadas en este entorno, solo se corrió typecheck/tests puros); multi-cliente (hoy es una sola location, la de Franco) — eso es la fase de "aislamiento multiempresa" que pedirá Opus/alto cuando haya más de un cliente GHL real.

## Tab de plataforma (2026-09-17)

Se agregó "Master Dashboard" a la navegación (`src/components/platform/PlatformShell.tsx`, entrada `{ href: "/tracker", ... }`, ícono `Gauge`), por instrucción directa de Franco: es donde va a vivir todo este trabajo de ahora en más. Ruta `/tracker` → `src/app/(workspace)/tracker/page.tsx` → `src/components/tracker/MasterTracker.tsx`.

Contenido actual (admin-only, mismo patrón que `LeadConnectionSettings.tsx`): estado de las tres conexiones (GHL/Meta/Stripe) vía `GET /api/tracker/connections`, sin secretos ni llamada real a los proveedores — solo si el env var está presente. Ningún widget de métricas todavía; el tab existe para que el trabajo futuro tenga dónde aparecer, no como entrega final de UI.

**Nota de ownership:** `PlatformShell.tsx` es shell compartido; según la asignación original ese archivo lo tocaba Infra. Se modificó acá por instrucción explícita de Franco de crear el tab ya (y de sacar "Mentor Chat" de la navegación, 2026-09-17). Señalar al orquestador/Infra este cambio puntual para que no se pise con otro cambio de shell en curso.

## Corrección de arquitectura (2026-09-17, feedback de Franco)

Error de la entrega anterior: puse el estado de conexiones (GHL/Meta/Stripe "not configured") dentro del tab Tracker. Franco corrigió: **las conexiones van en Integrations** (`src/components/dashboard/Integrations.tsx`, ya tenía la card de GHL; se agregaron cards de Meta Ads y Stripe con el mismo patrón visual). **El tab Tracker tiene que mostrar el tracker en sí** — un layout de dashboard con números, aunque sea con datos DEMO — para poder juntar feedback de diseño antes de que las conexiones estén listas.

`MasterTracker.tsx` ahora es un layout de tarjetas numéricas (Cash Collected, Ad Spend, Total Calls, Calls Booked, Show Rate, Closing Rate) con **datos DEMO explícitamente etiquetados**, mismo patrón que ya usa `CallerAnalytics.tsx` ("DEMO — illustrative activity"). No llama a ninguna API ni depende de conexión real; es una maqueta para iterar el diseño. Cuando una fuente esté verificada, ese tile puntual pasa de demo a real — no se “completa” todo el tablero de una vez.

**Bug real encontrado y corregido:** las variables de `.env.local` no llegan solas al deploy de Vercel — Vercel usa su propio almacén de variables por entorno (Preview/Production), separado del archivo local. Sincronicé a mano `GHL_LOCATION_ID` (que Franco ya cargó) y agregué `GHL_API_BASE_URL`/`GHL_API_VERSION` (no son secretos) al entorno Preview vía `vercel env add`. **Todavía falta `GHL_PRIVATE_INTEGRATION_TOKEN`** — sin eso, la card de GHL en Integrations sigue en "Not connected" aunque el Location ID ya esté cargado.

**Incidente de producción (2026-09-17, corregido):** al pedido explícito de Franco, se hizo el primer `vercel deploy --prod` real del proyecto. Hasta ese momento, el dominio de producción (`nbc-sales-nbc-sales.vercel.app`) en realidad servía un deploy tipo Preview aliaseado a mano; las variables core (Supabase, ElevenLabs) solo existían en el entorno "Preview" de Vercel, nunca en "Production". El primer `--prod` real rompió el login (variables ausentes). Se corrigió copiando esas variables al entorno Production y redeployando. **Hallazgo para Infra/orquestador:** el entorno Production de este proyecto Vercel estuvo desde el origen sin las variables base — cualquier futuro `--prod` de otro lane puede repetir este incidente si no se verifica antes. También se detectó otro lane deployando a Production en paralelo (agregó `APIFY_API_TOKEN`/`BATCHDATA_API_KEY`/`OUTSCRAPER_API_KEY` casi al mismo tiempo) — múltiples publicadores concurrentes sobre el mismo proyecto, el riesgo que `REVIEW-PROTOCOL.md` buscaba evitar.

## Iteración 2 del layout (2026-09-17, tras feedback directo de Franco)

La primera maqueta (6 tarjetas sueltas) no estuvo a la altura de la referencia Calyx que Franco compartió. Corrección: reconstruí `MasterTracker.tsx` con **tabs** (Overview, Ecosystem Health, Closer Performance, Meta Ads Health, Funnel %) y contenido real por tab, todo con datos DEMO explícitos (`src/lib/tracker-demo.ts`):

- **Overview:** las 6 tarjetas numéricas + un gráfico de área (revenue de 30 días) con un helper puro de geometría SVG (`src/lib/tracker-charts.ts`, con pruebas unitarias).
- **Ecosystem Health:** tabla de feed en vivo (nombre/estado/hace cuánto), como el feed de Calyx.
- **Closer Performance:** tarjetas por rep (Total Calls, Show Rate, Showed Calls, Offers Made, Closing Rate, Closed Calls, Revenue, AOV) — nombres genéricos "Rep A/B", no los nombres reales que aparecían en las capturas de Calyx.
- **Meta Ads Health:** tabla de campañas (Ad Spend, Calls, Closing Rate, Show Rate, Revenue, ROAS, Sales) con fila de totales.
- **Funnel %:** embudo Impressions → Clicks → Leads → Calls → Booked → Showed → Sales, barras proporcionales.

Explícitamente no incluido todavía (habría que fabricar de más sin evidencia real): drag/resize de widgets (Caller ya tiene ese motor en `caller-dashboard.ts`/`CallerCanvas`, pero está acoplado a datos de Caller — portarlo al tracker es trabajo aparte, no bloqueante para revisar el diseño), Deal Analysis con lead scoring/IA (necesita transcript real), CRM con customer journey completo, constructor de métricas custom, envío de valor a Meta (CAPI). Es la base visual para juntar feedback de Franco, no la entrega final.

## Bug real encontrado y corregido: Funnel % (2026-09-17)

Tras el feedback "esto es una mierda" de Franco, en vez de seguir adivinando levanté el servidor local, inicié sesión con Playwright y saqué capturas reales de las 5 tabs para ver exactamente lo mismo que él. Overview/Ecosystem Health/Closer Performance/Meta Ads Health se veían correctamente. **Funnel % estaba roto de verdad**: escala lineal con Impressions=1.2M y Sales=43 (cinco órdenes de magnitud de diferencia) hacía que todas las barras después de la primera colapsaran al mismo piso invisible. Se corrigió con escala logarítmica + piso mínimo de 14% de ancho, cambiando de barras verticales a filas horizontales con conversión % entre pasos — mismo patrón de legibilidad que un funnel de marketing real. Gradiente de color también se corrigió (una mezcla `color-mix` con `--brand-gold` daba un verde oliva feo; ahora es navy→blue limpio).

Nota metodológica para el resto del trabajo: Playwright (`node_modules/playwright`, script `test:e2e`) permite levantar `npm run dev` y sacar screenshots reales autenticando con `NBC_OPERATOR_EMAIL`/`NBC_OPERATOR_INITIAL_PASSWORD` de `.env.local`. Usarlo antes de reportar "listo" a Franco en vez de asumir que el código compilado se ve bien.

## Distinciones obligatorias (del encargo, no negociables sin nueva evidencia)

- **Conversación de navegador** (`call_sessions.channel = 'web'`) ≠ **llamada telefónica** (`channel = 'phone'`, aún no implementada en producción). No sumar ambas como "llamadas".
- **Intento** (`call_sessions` creada, cualquier `status`) ≠ **llamada conectada** (`status = 'completed'` con `duration_seconds` conocido). Un `failed`/`expired` no es una conversión.
- **Consumo de IA** (tokens/segundos ElevenLabs vía `src/lib/usage.ts`, `costScope: 'llm_only' | 'unknown'`) ≠ **gasto publicitario** (Google/Meta Ads: sin conector ni tabla hoy).
- **Falta de dato ≠ cero.** Un cliente sin integración de Ads no tiene "gasto $0"; tiene "sin dato", y así debe mostrarse.
- No se infiere ROAS, ingresos ni atribución sin fuente y definición confirmadas explícitamente.

## Inventario de datos reales existentes (código y esquema actuales)

| Cifra candidata | Fuente real hoy | Definición/fórmula | Cliente/alcance | Período/TZ | Moneda/unidad | Actualización | Faltantes |
|---|---|---|---|---|---|---|---|
| Conversaciones de navegador | `call_sessions` (`channel='web'`), `CallerAnalytics.tsx` | Conteo de sesiones `web` en rango de días, filtradas por calendario local del navegador | Por `operator_id` (usuario Caller), no por cliente/workspace agregado | 7/14/30 días, calendario local del cliente (no UTC fijo) | Conteo entero | Al cargar el panel; sin caché ni cron | Duraciones nulas se excluyen; no hay corte por zona horaria de negocio, solo la del navegador |
| Intentos de llamada | `call_sessions` todos los `status` | Conteo por estado (`preparing/ready/active/processing/completed/failed/expired`) | Igual que arriba | Igual | Conteo | Igual | Sin distinción de motivo de fallo agregada en UI hoy |
| Llamadas telefónicas conectadas | `call_sessions` (`channel='phone'`) | — | — | — | — | — | **No hay canal `phone` en producción**; el campo existe en el esquema pero "solo web implementado" (`docs/DB_SCHEMA.md`). Cifra no disponible, no es cero |
| Duración de conversación | `call_sessions.duration_seconds` | Suma/promedio de duraciones no nulas | Por operador | Igual | Segundos | Igual | Duración nula ("unknown") excluida, no tratada como 0 |
| Consumo IA (tokens/costo) | `src/lib/usage.ts` (`voiceUsage`), `AdminUsage.tsx`, `account-usage.ts` | Tokens input/output/cached + `costMicrousd` desde `llm_price` de ElevenLabs, `costScope` explícito `llm_only` o `unknown` | Por miembro (`UsageMember`), agregable por rol/admin | No definido explícitamente (fecha de evento, TZ no documentada) | Microdólares USD → USD | Por evento de llamada procesado | Costo fuera del alcance LLM (ej. telefonía Twilio) no está incluido; `costScope` ya marca esto como `unknown`, no debe mostrarse como total si es parcial |
| Créditos NBC (wallet/ledger) | `credit-payments.ts`, `CreditTopups.tsx`, `/credits` | Saldo disponible/reservado, órdenes de compra | Por cuenta | — | Créditos (unidad interna) + USD en checkout | Por transacción | Tarifas/ciclo comercial reales pendientes (`docs/00-current-state.md`) |
| Gasto publicitario (Ads) | **No existe fuente en el código** | — | — | — | — | — | Sin conector GHL/Google/Meta Ads. No inventar cifra ni "$0" |
| Citas agendadas | Calendar (`docs/features/calendar-view.md`) — grilla mensual, feed NBC | Pendiente de revisar como fuente de tracker; no evaluado en este corte | — | — | — | — | Google externo pendiente; no confirmado como fuente de "citas" para tracker |
| Ingresos / ROAS | **No existe fuente** | — | — | — | — | — | Requiere definición y datos confirmados antes de proponer fórmula |
| Leads descubiertos/verificados (Lead Engine) | `src/lib/lead-engine-quality.ts`, `lead-engine-plan.ts` | Negocio descubierto vs. teléfono publicado vs. celular de dueño corroborado son estados distintos, no intercambiables | Por plan/lane, motor puro sin persistencia de ledger global aún | — | Conteo + cents (presupuesto) | Por corrida de plan | Ledger global de búsquedas/entregas no implementado (`docs/lead-engine.md`); proveedor de scraping aún en definición (L03) |

## Carga manual/CSV vs. conectores (comparación pedida por el encargo)

No se decide por inferencia; se deja como opción abierta a resolver con la referencia de Anas:

- **Carga manual/CSV**: disponible sin nueva integración; requiere definir plantilla por cifra (fuente, cliente, período, moneda) y quién la sube. Riesgo: datos stale, sin validación de consistencia entre clientes.
- **Conectores (GHL/Ads/Google)**: ninguno conectado hoy. Requiere credenciales, OAuth o API key por cliente, aislamiento multi-tenant y contrato de actualización (`docs/lanes/tasks/OR04-start-2026-09-17.md` exige confirmar destino antes de OAuth). Mayor exactitud, mayor costo de implementación y de mantenimiento de acceso por cliente.

## Próximo paso

1. Franco elige el proveedor de la primera conexión (Meta / Stripe / iClose-GHL).
2. Este lane documenta el esquema de conexión (tabla `tracker_connections` o equivalente: proveedor, workspace, estado, sin secretos en claro) como propuesta SQL, para revisión antes de aplicar migración.
3. Con la elección, arranca Fase 1: conexión real de un solo proveedor + una vista concreta, pidiendo Opus/alto específicamente para la parte de credenciales/aislamiento y volviendo a Sonnet para la vista.
4. En paralelo, sin bloquear lo anterior: revisar Calendar como fuente candidata de "citas" y el ledger global de Lead Engine, ya relevados en el inventario debajo.

Reporte de esta entrega: `docs/lanes/reports/TR01.md`.

## Revisión visual — 2026-09-21: centro operativo NBC

Franco aportó como referencia concreta la pantalla Overview de Callix/Calyx (`https://www.callix.io/analyze`) y una captura de su dashboard. No se pretende copiarla literalmente: la referencia define claridad de jerarquía, navegación de vistas, periodo visible, widgets y un gráfico principal amplio. La dirección NBC debe resolver una necesidad más completa: reunir gasto, pipeline, llamadas, facturación, rendimiento comercial y objeciones sin obligar al dueño a cruzar múltiples aplicaciones.

### Primer recorrido visual

`/tracker` abre en **Overview**, una vista de operación compuesta por:

1. Encabezado con periodo visible, etiqueta inequívoca de Preview data y acceso a personalización.
2. Señal de negocio: cash collected, pipeline, llamadas y citas como lectura rápida; ninguna cifra demo se presenta como una fuente conectada.
3. Gráfico principal de cash collected con inspección de punto y contexto del periodo.
4. Bloques para adquisición, salud comercial y calidad de ventas. Las objeciones se muestran como una superficie de producto preparada, con estado pendiente mientras no existan transcripciones autorizadas.
5. Cobertura de fuentes para explicar qué parte será real cuando GHL, Meta y Stripe estén verificadas; faltante no equivale a cero.

La interfaz usa tokens NBC existentes, no assets remotos ni capturas incorporadas. Mantiene claro/oscuro y móvil. No crea otro shell o dashboard global.

### Personalización honesta

El usuario puede abrir **Customize dashboard**, mostrar u ocultar bloques y cambiar su orden. La preferencia de presentación se conserva únicamente en el navegador actual con clave separada `nbc-tracker-layout-v1`; no sincroniza entre dispositivos ni afirma haber guardado datos de negocio. Reset recupera el orden inicial. Tabs y exploración del gráfico son interacciones locales sobre Preview data.

### Datos y límites

Los fixtures siguen siendo explícitamente demo. Las secciones usan el contrato genérico ya existente y no llaman a GHL, Meta o Stripe desde el cliente. Un conector verificado sustituirá únicamente el bloque que cubre, conservando `null`/pendiente donde no haya evidencia. No se agregan claims de ingresos, ROAS, objeciones, campañas o reps reales.

### Criterios de aceptación

- El Overview deja claro qué datos son preview y qué fuentes siguen pendientes.
- El problema de centralización es legible sin confundir gasto, llamadas, facturación, pipeline y objeciones.
- Tabs, inspección de gráfico y personalización son operables con teclado y móvil.
- Ocultar/reordenar/restablecer bloques no destruye el layout ni modifica datos de negocio.
- Ninguna conexión, variable, SQL, auth, proveedor o publicación se activa solo por este rediseño.

## Estructura completa antes de conectar fuentes — 2026-09-21

El siguiente corte no limita Tracker a Overview. Antes de conectar cuentas, `/tracker` debe dejar listo el recorrido entero que recibirá datos reales mañana, de modo que cada proveedor complete una superficie concreta sin volver a decidir la arquitectura visual.

### Vistas de producto

| Vista | Pregunta que resuelve | Contenido estructural hoy | Fuente que la vuelve real |
|---|---|---|---|
| Overview | ¿Qué cambió y dónde debo mirar primero? | caja, pulso, adquisición, desempeño, señales y cobertura | combinación de fuentes verificadas |
| Revenue & pipeline | ¿Qué entró, qué está abierto y dónde se mueve? | etapas, pipeline, actividad de revenue y forecast explícitamente pendiente | GHL + Stripe |
| Sales quality | ¿Qué parte de la conversación explica el resultado? | scorecard de reps, trayecto booked→showed→offer→won y superficie de coaching/transcripts pendiente | Caller + GHL |
| Acquisition | ¿Qué inversión llegó a conversaciones y resultados? | campañas, eficiencia, atribución preparada y estado de fuente | Meta + GHL/Stripe |
| Funnel | ¿En qué paso se pierde el avance? | conversión por etapa, variación entre pasos y acción de investigación | Meta + GHL + Caller |
| Accounts & journeys | ¿Qué ocurre con una cuenta desde interés hasta resultado? | lista, etapas y timeline ilustrativo sin identidades reales | CRM/GHL + atribución autorizada |
| Data sources | ¿Qué falta para confiar en cada bloque? | contrato visible por fuente, campos esperados, estado y ruta hacia Integrations | conexión verificada por proveedor |

### Interacciones y límites

- El período es seleccionable sólo para recorrer el prototipo; mientras siga en Preview no recalcula ni afirma datos nuevos.
- Las vistas pueden personalizarse localmente en orden/visibilidad. Se mantienen las preferencias de navegador ya documentadas; no se crea persistencia de negocio ni permisos adicionales.
- Tablas, pipeline, recorridos y coaching muestran datos de demostración inequívocos y sin nombres de clientes, contactos o representantes reales.
- Las acciones que requieren configuración llevan a Integrations o quedan señaladas como “available after source verification”; no abren OAuth, no solicitan secretos ni llaman proveedores desde el cliente.

### Criterios de aceptación de este corte

- Las siete vistas son navegables, utilizables en móvil y cada una responde a una pregunta operativa distinta.
- Pipeline, campañas, funnel, journeys y calidad comercial tienen una estructura concreta en lugar de placeholders genéricos.
- Toda cifra, fila, etapa y recorrido de preview se identifica como demostración o como fuente pendiente.
- La transición de mañana se reduce a alimentar contratos de proveedor y sustituir widgets individuales; no requiere cambiar el mapa de navegación ni inventar nuevas pantallas.
