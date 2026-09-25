# NBC Sales

**Estado actual:** [plataforma y prioridades](docs/00-current-state.md). **Revisión más reciente:** [OR02](docs/lanes/reports/OR02-PLATFORM-REVIEW-2026-09-16.md). Portal de revisión: https://nbc-sales-nbc-sales.vercel.app . Los estados y comandos de la entrega inicial que siguen se conservan como historia; consultar primero el estado consolidado.

> Academy/S01/KCAL01 fueron revisados el 2026-09-15: editor y servicios implementados, persistencia real pendiente y correcciones abiertas. Ver [revisión del orquestador](docs/lanes/reports/OR01-ACADEMY-REVIEW-2026-09-15.md). Las instrucciones iniciales de este README son históricas; el portal actual usa sesión compartida y roles.

Plataforma principal de NBC Sales en inglés: Caller, Lead Engine, Academy, Ask Anas e Integrations. Construida con Next.js, TypeScript y Supabase. Mercado: Estados Unidos.

## Ver el dashboard

```bash
npm install
npm run dev
```

Abrir http://127.0.0.1:3000. Home es ahora el master dashboard de NBC Sales; conserva la paleta azul/blanco/amarillo.

| Módulo | Ruta | Disponible ahora |
|---|---|---|
| Caller | `/caller` | Voz de navegador, historial privado, métricas recientes, filtros, export TXT y mute |
| Lead Engine | `/lead-engine` | Planificación local, presupuesto y descarga de plan JSON; sin scraping ni gasto |
| Academy | `/academy` | Plantilla/importación JSON de cursos, módulos y lecciones; preview y export de inventario |
| Ask Anas | `/ask-anas` | Preparación del corpus; aún no responde preguntas ni conversa |
| Integrations | `/integrations` | Configuración y pruebas privadas de GHL existentes |
| Demo anterior | `/demo` | Fixtures de septiembre 2026, filtros, gráficos y export CSV |

La preparación de Academy no migra videos: el inventario vive en memoria y se debe exportar antes de salir. Se necesitan el contenido real, almacenamiento y permisos de alumnos para completar la migración. Lead Engine usa benchmarks identificados del brief y reglas probadas, pero todavía requiere ledger persistente, proveedores verificados y el piloto para ejecutar búsquedas.

## Continuar en cuatro conversaciones

El orquestador mantiene arquitectura, rutas, contratos y validación integrada. Los lanes tienen propietarios de archivos distintos. Abrir [los prompts listos para copiar](docs/lanes/START-HERE.md) y el [mapa de coordinación](docs/lanes/README.md). Handoffs: [Caller](docs/lanes/caller.md), [Infraestructura](docs/lanes/infra.md), [Lead Engine](docs/lanes/lead-engine.md) y [Academy + Ask Anas](docs/lanes/academy.md). Infraestructura comienza con Vercel desde el snapshot congelado de esta versión. Los prompts completos siguen AInnovate e incluyen pruebas, límites y formato de entrega. **Franco revisa y autoriza antes de cualquier push**; ver [protocolo de revisión](docs/lanes/REVIEW-PROTOCOL.md). Los chats sin acceso al proyecto necesitan que se les adjunten los documentos; no sincronizan los archivos automáticamente.

## Probar el Caller ahora

1. Abrir http://127.0.0.1:3000 o directamente http://127.0.0.1:3000/caller.
2. Iniciar sesión con el correo de `NBC_OPERATOR_EMAIL` y la contraseña de `NBC_OPERATOR_INITIAL_PASSWORD` de `.env.local`. No son las credenciales administrativas de Supabase.
3. Pulsar **Start voice test**, permitir el micrófono y hablar en inglés. Usar auriculares si hay eco.
4. Usar **Mute microphone** para silenciar la entrada sin dejar de escuchar. Pulsar **End voice test**. El resultado se consulta automáticamente; **Refresh result** permite retomarlo si el proveedor aún procesa. El historial conserva duración, transcripción y resumen. Permite buscar, filtrar por estado y descargar TXT cuando el resultado tiene transcripción final verificada. Las métricas abarcan como máximo las últimas treinta sesiones.

El agente privado ElevenLabs ya está creado y su ID está en `.env.local`. Usa la voz estándar Roger y un guion de prueba de calificación; aún no usa la voz ni la metodología entrenada de Anas. Límite de cinco minutos, una conversación concurrente y veinte inicios en 24 horas. No se graba audio. La transcripción se guarda en Supabase; todavía no hay borrado automático en esa base.

Variables runtime adicionales: `ELEVENLABS_API_KEY` y `ELEVENLABS_AGENT_ID`, ambas privadas. OpenAI y Anthropic no se consumen directamente: el LLM de esta prueba se ejecuta mediante ElevenLabs. Para configurar otro entorno, revisar `config/nbc-test-agent.json` y ejecutar `node scripts/setup-caller.mjs` desde la raíz; aplica la migración si falta y crea el agente solo si no hay ID configurado. Requiere los tokens de administración locales, no adquiere números ni inicia conversaciones. La aplicación requiere localhost o HTTPS para acceder al micrófono.

Prueba real del 2026-09-14: audio sintético transmitido desde Chrome, transcripción del usuario y respuesta hablada del agente; resultado de 27 segundos, tres intervenciones y resumen persistido. Esto verifica el recorrido técnico; la naturalidad, latencia percibida y calidad comercial requieren evaluación humana.

## Qué hace la integración actual

- Comprueba si las variables de conexión están configuradas; esto no significa conexión verificada.
- Inicia sesión con un operador de Supabase autorizado por email.
- Lee un contacto real de GoHighLevel y verifica su subcuenta.
- Recibe eventos autenticados de un workflow y los almacena sin duplicar el mismo identificador por subcuenta.
- Muestra los últimos 25 eventos al operador.

Caller permite conversaciones de voz reales desde el navegador. Todavía no llama a números de teléfono, envía mensajes, crea citas reales ni escribe notas en el CRM. Overview, Calls, Leads, Appointments y Agent conservan datos demo.

## 1. Configuración local

La plantilla está en `.env.example`. Se creó también `.env.local` con valores vacíos, excluido del control de versiones. Completar los valores localmente; nunca enviar claves privadas por el chat ni ponerlas en variables `NEXT_PUBLIC_*`.

Tras cambiar variables, reiniciar `npm run dev`. En despliegues, las variables públicas se incorporan durante el build y requieren reconstruir la aplicación.

## 2. Supabase

El proyecto de testing NBC Caller está conectado. Variables utilizadas:

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: clave pública publishable; también se acepta una anon key existente.
- `SUPABASE_SECRET_KEY`: clave secreta de servidor; también se acepta la service-role key existente.
- `NBC_OPERATOR_EMAIL`: correo exacto del operador autorizado.

El operador configurado ya fue creado con email confirmado. Su contraseña inicial está en `NBC_OPERATOR_INITIAL_PASSWORD`, solo dentro de `.env.local`; se usa para iniciar sesión en Integrations → Test workspace. No subir esa contraseña al hosting. La migración `supabase/migrations/202609120001_integration_events.sql` fue aplicada a NBC Caller mediante Management API SQL el 2026-09-12.

`NBC_OPERATOR_EMAIL` es el correo con el que se accederá al panel de pruebas. En el proyecto Supabase, abrir **Authentication → Users → Add user → Create new user**, ingresar ese correo y una contraseña y marcar **Auto Confirm User** para este usuario de prueba. Copiar solamente el correo en esa variable; la contraseña se usa al iniciar sesión. La cuenta con la que se administra Supabase es independiente de los usuarios de Auth del proyecto.

La clave de `SUPABASE_SECRET_KEY` se obtiene en **Settings → API Keys → Secret keys** del proyecto. Ver [claves oficiales de Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

La tabla tiene RLS y ningún permiso para acceso directo de navegador. El servidor consulta los eventos después de verificar al operador. Esta primera versión admite un operador y una subcuenta configurados; los roles comerciales multiempresa son un desarrollo posterior.

## 3. GoHighLevel

Preparar una subcuenta de testing y completar:

- `GHL_LOCATION_ID`: identificador de esa subcuenta.
- `GHL_PRIVATE_INTEGRATION_TOKEN`: token privado creado en esa subcuenta.
- `GHL_API_BASE_URL`: conservar el host oficial de la plantilla.
- `GHL_API_VERSION`: la plantilla usa `v3`, según las páginas actuales de los endpoints consultados; validar compatibilidad en el primer test real.

Para la prueba de lectura implementada alcanza `contacts.readonly`. La futura escritura de notas necesitará `contacts.write`; la futura agenda necesitará `calendars.readonly`, `calendars/events.readonly` y `calendars/events.write`, además de Calendar ID y disponibilidad. No hace falta conceder esos permisos para la lectura inicial.

Ir a Integrations → Test workspace, iniciar sesión con el operador y pegar el ID de un contacto de prueba. Verify contact realiza una lectura real y comprueba que la cuenta devuelta coincida con `GHL_LOCATION_ID`.

Referencia: [Private Integrations](https://help.gohighlevel.com/support/solutions/articles/155000003054-private-integrations-everything-you-need-to-know), [scopes](https://marketplace.gohighlevel.com/docs/Authorization/Scopes/index.html), [Get Contact](https://marketplace.gohighlevel.com/docs/ghl/contacts/get-contact/index.html).

## 4. Workflow de prueba

Para que GHL pueda enviar eventos, el servidor necesita una URL HTTPS accesible desde Internet. Localhost por sí solo no es accesible desde GHL. La publicación o el túnel se prepararán al conectar la cuenta; no hay URL pública creada.

1. Generar una credencial independiente, por ejemplo con `openssl rand -hex 32`, y guardarla en `GHL_WEBHOOK_SECRET`.
2. En un workflow de la subcuenta, agregar una acción Custom Webhook con `POST` a `https://<servidor>/api/webhooks/ghl`.
3. Usar `Content-Type: application/json` y autenticación Bearer con ese secreto. No usar el token privado de GHL como secreto de este webhook.
4. Enviar el contrato siguiente. Mapear los valores reales con el selector de variables de GHL; no pegar los placeholders literalmente.

```json
{
  "eventId": "test-001",
  "locationId": "YOUR_LOCATION_ID",
  "contactId": "YOUR_TEST_CONTACT_ID",
  "type": "integration.test"
}
```

`test-001` sirve para una prueba manual. Repetirlo debe devolver `duplicate: true`. Cambiarlo para un nuevo evento independiente. Para automatización continua, acordar un ID único y estable por evento que se conserve al reintentar; no usar un ID fijo para todos los contactos ni generar uno nuevo en cada reintento. Los identificadores admiten letras ASCII, números, guion y guion bajo, hasta 100 caracteres.

El webhook solo registra el evento; no dispara llamadas. Si el almacenamiento falla devuelve 503 para que el emisor pueda reintentar con el mismo ID. La tabla evita duplicados mediante una restricción única, incluso con solicitudes simultáneas. La respuesta 201 confirma persistencia; 200 indica duplicado ya registrado.

Referencia: [Custom Webhook](https://help.gohighlevel.com/support/solutions/articles/155000003305/). Verificar que la acción esté habilitada en la subcuenta. La futura instalación del producto en múltiples clientes usará un diseño OAuth; este token privado no suscribe webhooks del Marketplace.

## Validación local

```bash
npm run typecheck
npm test
npm run build
# Con el servidor local iniciado y Google Chrome instalado:
npm run test:e2e
```

Pruebas: denominadores de métricas, validación del cliente/evento, CSV, navegación, filtros, exportación, controles de acceso sin credenciales y vista móvil. El login Supabase, los permisos de almacenamiento y la deduplicación se verificaron contra NBC Caller. GoHighLevel y despliegue remoto siguen pendientes.

## Documentación

Antes de cambiar código, leer `metodo_ainnovate.md`, `docs/01-project-overview.md`, `docs/02-architecture.md` y el documento de la feature correspondiente. Estado y limitaciones: `docs/features/dashboard-ghl-test.md`.

## Conectar infraestructura por API

El usuario eligió tokens API como vía de conexión a Supabase y Vercel. Completar **localmente** `SUPABASE_ACCESS_TOKEN` y `VERCEL_TOKEN` en `.env.local`. Son tokens de administración, distintos de las claves que consume la aplicación.

- [Supabase: personal access tokens](https://supabase.com/docs/guides/platform/personal-access-tokens), creados desde [Account → Access Tokens](https://supabase.com/dashboard/account/tokens).
- [Vercel: access tokens y scope de equipo](https://vercel.com/kb/guide/how-do-i-use-a-vercel-api-access-token).

En Supabase, generar un token desde el enlace de Account → Access Tokens, darle un nombre identificable (por ejemplo, NBC Voice AI) y guardar su valor en `SUPABASE_ACCESS_TOKEN`. Si la cuenta ofrece tokens con permisos limitados, seleccionar el proyecto NBC y los permisos necesarios para las operaciones a realizar. La consulta de configuración y la aplicación de migraciones requieren permisos distintos; verificar los permisos antes de cada operación.

En Vercel, abrir [Account → Tokens](https://vercel.com/account/tokens) desde la cuenta personal, crear un token con nombre NBC Voice AI y seleccionar en Scope el equipo donde se alojará NBC. Guardar el valor en `VERCEL_TOKEN`.

Después, `node scripts/check-cloud-access.mjs` consulta organizaciones/equipos y proyectos mediante GET. La salida incluye solo metadatos seleccionados; nunca claves o cuerpos de error del proveedor. Si falta un token, informa el pendiente sin llamar a ese proveedor. Si hay más de 100 resultados Vercel, informa `hasMore` y se debe paginar antes de concluir que un proyecto no existe.

`SUPABASE_ORGANIZATION_ID`, `SUPABASE_PROJECT_REF`, `VERCEL_TEAM_ID` y `VERCEL_PROJECT_ID` son selectores opcionales que se completarán al identificar el destino de NBC. No se modifican recursos de otros proyectos. Los tokens de administración no deben cargarse como variables de la aplicación en Vercel; `.vercelignore` excluye archivos de entorno y documentación interna del upload.

En la configuración local se completó `SUPABASE_PROJECT_REF` a partir de la URL existente del proyecto. Los otros IDs pueden dejarse vacíos hasta consultar los destinos accesibles con los tokens. Si el proyecto Vercel todavía no existe, su ID se obtendrá al crearlo.

Estado actual: tokens verificados, Supabase conectado y sus IDs completados. Vercel permite listar el equipo NBC Sales, pero rechaza crear el proyecto con HTTP 403 (`forbidden`: falta de permiso para crear proyectos). No hay proyecto ni despliegue Vercel creado. GHL sigue pendiente del acceso solicitado por el usuario.

## Claves de IA y voz preparadas

`.env.local` y `.env.example` incluyen `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (Claude) y `ELEVENLABS_API_KEY`. ElevenLabs se consume en el Caller de navegador desde el 2026-09-14. OpenAI y Anthropic siguen reservados; esta prueba usa el LLM gestionado por ElevenLabs. Cargar claves no configura telefonía. Retell y Twilio se agregarán cuando hagan falta, según indicación del usuario.

## Identidad NBC

Paleta adaptada a las referencias aportadas: azul noche, azul, blanco y amarillo; navegación oscura, botones amarillos y superficies claras. Los valores son aproximaciones visuales. El encabezado es tipográfico provisional; el logo original de los adjuntos aún no está disponible como archivo local.

## Capturas para presentar

En `artifacts/presentation/`: overview, perfil del agente, llamadas, detalle de conversación, citas y vistas móviles de overview/agente. PNG de navegador a escala 2x, con datos demo identificados. `nbc-dashboard-preview.zip` agrupa las siete imágenes. La ficha de voz es una presentación conceptual sin reproducción ni proveedor conectado.

Para resolver el bloqueo Vercel: en NBC Sales → Settings → Members, verificar rol Owner/Member o Developer con permiso extendido Create Project. Después crear un token desde Account → Tokens con Scope NBC Sales y actualizar VERCEL_TOKEN localmente. Un token nuevo no amplía por sí mismo el rol del usuario. Referencias: [crear proyectos](https://vercel.com/docs/projects/managing-projects) y [tokens](https://vercel.com/kb/guide/how-do-i-use-a-vercel-api-access-token).

## Validación del master dashboard

2026-09-14: build/TypeScript, 27 unitarias y 10 E2E aprobados. Navegación por URL, móvil, importación Academy inválida que conserva inventario, export de planes sin datos/contactos, presupuesto, filtro Caller y descarga TXT verificada. Login Supabase real y recuperación de transcripción previa comprobados. Sin nuevos cargos de voz, scraping, migraciones ni despliegue en este hito.
