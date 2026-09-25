# Dashboard e integración de prueba con GoHighLevel

Fecha: 2026-09-12. Estado: parcial. Dashboard demo y API de prueba implementados y validados localmente; Supabase conectado, GoHighLevel y Vercel pendientes. El usuario aprobó Next.js + TypeScript + Supabase y solicita el dashboard lo antes posible para mostrar a Anas y comenzar pruebas.

## Alcance del primer hito

Mercado confirmado: Estados Unidos. Idioma de interfaz y pruebas propuesto: inglés, consistente con el idioma confirmado por el usuario. No exige definir aún vertical ni tipo comercial de cita.

Pantallas propuestas para la primera demostración:

- Overview: actividad, conversiones, evolución y resultados.
- Calls: historial, filtros y detalle con resultado, transcripción y audio cuando existan.
- Leads y appointments: trazabilidad entre contacto, conversación y agenda.
- Integrations: conexión GoHighLevel, última sincronización y estado de la prueba.

Los datos ficticios deben estar marcados como demo. En modo conectado, mostrar únicamente datos reales disponibles y estados vacíos para lo que aún no se integra. No presentar grabaciones, llamadas o citas simuladas como resultados operativos.

## Base técnica aprobada

Next.js + TypeScript para aplicación y endpoints; Supabase para Postgres y login al conectar persistencia. Diseño propio con CSS Modules conforme a AInnovate. Proveedores de voz y telefonía independientes de esta decisión.

Referencias consultadas: [Next.js](https://nextjs.org/docs/app/getting-started/installation) y [Supabase/Postgres](https://supabase.com/docs/guides/database/overview).

## Implementación inicial acordada con el alcance

Dashboard demo navegable con filtros, gráficos derivados de registros, exportación CSV y detalle de llamada. Pantallas Overview, Calls, Leads, Appointments, Agent e Integrations. Agent describe la configuración de demostración y no activa un proveedor de voz.

API implementada: `GET /api/integrations/status` (solo indicadores de configuración), `POST /api/integrations/ghl/test` (verificar contacto de prueba), `POST /api/webhooks/ghl` (recibir evento autenticado e idempotente) y `GET /api/integrations/events` (historial protegido). Autenticación para datos reales mediante Supabase y correo de operador permitido por configuración. Token de GHL solo en servidor; secreto independiente para el webhook.

Migración aplicada a NBC Caller para la tabla: `integration_events`, acceso de servicio en servidor y RLS sin acceso directo desde navegador. Guardar únicamente identificadores y metadatos del evento para la primera prueba. La prueba de escritura de notas y la agenda real son el siguiente paso después de validar contacto y webhook; no se presentan como implementadas en esta entrega.

## Accesos mínimos para la primera integración

1. Una subcuenta GoHighLevel destinada a testing y su Location ID.
2. Un Private Integration Token de esa subcuenta; configurarlo en el entorno privado del servidor, nunca en el navegador. Los valores secretos se colocarán en `.env.local`, ya excluido del control de versiones, o en el gestor de secretos del hosting.
3. Permiso inicial `contacts.readonly`, suficiente para el test implementado. `contacts.write` se añade al implementar la escritura de resultados.
4. Para la etapa de agenda: `calendars.readonly`, `calendars/events.readonly`, `calendars/events.write`; calendario de prueba con disponibilidad, zona horaria y Calendar ID.
5. Poder editar un workflow en esa subcuenta y utilizar una acción de webhook saliente; verificar disponibilidad de la acción en esa cuenta.
6. Un contacto de prueba con datos controlados por el equipo. No hacen falta listas de leads reales.

Los tokens privados se crean y administran en Private Integrations de Settings, con permisos limitados. Ver [guía oficial de Private Integrations](https://help.gohighlevel.com/support/solutions/articles/155000003054-private-integrations-everything-you-need-to-know) y [scopes oficiales](https://marketplace.gohighlevel.com/docs/Authorization/Scopes/index.html).

## Eventos y autenticación

Propuesta para una sola subcuenta: token privado para llamadas REST y workflow con webhook saliente para notificar al backend. El webhook tendrá una credencial propia, distinta del token de acceso a GHL. El backend deberá validar el emisor y la cuenta y deduplicar eventos antes de generar acciones.

Esto no equivale a suscribirse a webhooks de una aplicación Marketplace mediante el token privado. Para instalación por clientes y eventos de aplicación, diseñar OAuth y el ciclo de instalación/desinstalación. Ver [autorización oficial](https://marketplace.gohighlevel.com/docs/Authorization/authorization_doc/) y [Custom Webhook de workflows](https://help.gohighlevel.com/support/solutions/articles/155000003305/).

Para recibir eventos, el backend necesita una URL HTTPS accesible desde GHL. Preparar una URL de preview o túnel de desarrollo al disponer del servidor; la URL y las instrucciones exactas se entregan después de implementarlo. Vercel es el hosting elegido; creación de proyecto bloqueada por permisos.

## Prueba de aceptación propuesta

1. Verificar credenciales leyendo un contacto de prueba de la subcuenta esperada.
2. Disparar manualmente un workflow sobre ese contacto.
3. Recibir el evento y mostrarlo en el dashboard como evento real de integración.
4. Reenviar el mismo evento y comprobar que no duplica la operación.
5. Escribir una nota de resultado de test en ese contacto y verificarla leyendo desde GHL.
6. Con calendario configurado: consultar disponibilidad, crear una cita de prueba y comprobarla en GHL y dashboard.

Esta prueba comprueba CRM, persistencia y dashboard; las llamadas telefónicas requieren implementar y configurar el proveedor elegido posteriormente.

## Insumos de diseño

Logo y colores son opcionales para empezar. Si no existen todavía, usar NBC Voice AI como nombre provisional y una identidad visual provisional consistente. No retrasar la primera demostración por branding pendiente.

## Pendientes de implementación

- [x] Stack elegido, componentes implementados y contratos documentados.
- [x] Dashboard interactivo con datos demo identificados, búsqueda, filtros, CSV y detalle.
- [x] Código de autenticación y persistencia; [x] configurar Supabase, crear operador y aplicar migración.
- [ ] Credenciales, workflow y calendario de la subcuenta de test.
- [x] Endpoint autenticado y deduplicación en SQL; [ ] URL pública y prueba con eventos reales.
- [ ] Ejecución del test externo y evidencia de resultado real.

## Validación efectuada

Build de producción y TypeScript completados. Tres pruebas unitarias de denominadores, payload/cuenta y CSV; cuatro pruebas E2E de navegación/filtros/exportación/detalle, estado de integración, rechazo de acceso anónimo y vista móvil. Se corrigió un desbordamiento móvil y se verificaron capturas de escritorio/móvil. No se afirma que las credenciales, la compatibilidad de versión GHL o la deduplicación en una base remota estén probadas sin cuentas conectadas.

## Actualización de identidad e infraestructura — 2026-09-12

El usuario aporta dos referencias de NBC / Never Be Closing Sales System y solicita usarlas como lineamientos visuales: azul noche y azul intenso, blanco y amarillo. Se adapta la interfaz existente mediante tokens, navegación y gráficos. Los colores son aproximaciones de las referencias, no códigos oficiales entregados. Los adjuntos son visibles en la conversación pero no están disponibles como archivos locales; la reproducción exacta del logo queda pendiente de disponer del original en el proyecto. No reconstruir sus trazos ni presentarlos como logo oficial.

El usuario informa que solicitó acceso GHL y lo compartirá cuando llegue. Autoriza avanzar con Supabase/Vercel y elige tokens API como vía directa. Preparar variables privadas de administración y una comprobación de acceso de solo lectura; no incluir tokens de administración entre las variables de la aplicación desplegada. No crear proyectos en una organización ambigua ni elegir un plan de pago sin resolver ese dato.

## Preparación de credenciales — 2026-09-12

El usuario solicita campos para Claude/Anthropic y ElevenLabs; se incluye OpenAI conforme a su pedido anterior. Preparar `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` y `OPENAI_API_KEY` sin valores en la plantilla y, si no existen, en `.env.local`. Claude usa la clave de Anthropic. Estos campos aún no son consumidos por la aplicación y no confirman elección final de proveedor ni integración de voz. Retell y Twilio se posponen por indicación del usuario.

Conservar las credenciales existentes. Completar `SUPABASE_PROJECT_REF` desde la URL del proyecto únicamente si está vacío y la URL usa el dominio estándar de Supabase. Los demás IDs pueden consultarse con los tokens de administración. Documentar que `NBC_OPERATOR_EMAIL` corresponde a un usuario confirmado de Supabase Auth dentro del proyecto; disponer de una cuenta en el dashboard de Supabase no crea ese usuario automáticamente.

## Conexión del entorno de prueba — 2026-09-12

El usuario informa que completó `.env.local`. Verificados los tokens de administración: una organización/equipo NBC Sales y proyecto Supabase NBC Caller activo. OpenAI, Anthropic y ElevenLabs responden a consultas de metadatos autenticadas; no se probaron generación ni voz. El proyecto Supabase todavía no tiene tabla de eventos ni usuario con el correo configurado.

Siguiente configuración autorizada: aplicar la migración existente al proyecto identificado; crear el operador indicado con contraseña aleatoria local si no existe, sin enviar correos; crear el proyecto Vercel NBC y un despliegue preview con la protección del proveedor. Subir únicamente fuentes de aplicación y variables runtime permitidas; nunca tokens de administración, claves de IA todavía sin uso ni la contraseña inicial.

Corregir el acceso para permitir login con Supabase antes de recibir GHL: `/api/integrations/events` debe verificar al operador siempre y, si falta Location ID, devolver `events: []` y `configured: false`, sin consultar datos de otras cuentas. Mostrar el estado pendiente de GoHighLevel en la interfaz. Con una subcuenta configurada, mantener el filtro y devolver `configured: true`.

Resultado: migración y operador creados; login y logout en navegador, apertura del workspace sin GHL, rechazo de token inválido, permisos de tabla y unicidad verificados. Build/TypeScript, tres unitarias y cuatro E2E pasaron. Las pruebas E2E de configuración vacía interceptan únicamente el endpoint de estado; las pruebas API comprueban booleanos sin asumir ausencia de credenciales. Vercel devuelve HTTP 403 al crear el proyecto; preview todavía pendiente de permisos.

## Presentación visual — 2026-09-12

El usuario prioriza el diseño y capturas para compartir; la funcionalidad comercial se retoma después. Refinar overview con cabecera NBC, jerarquía de métricas y gráficos, ficha del agente con su recorrido comercial propuesto y detalle de conversaciones. Componentes visuales nativos en React/CSS, sin audio simulado como real. Mantener datos demo, fixtures, filtros y controles de acceso existentes. El wordmark sigue siendo tipográfico provisional: no se dispone del archivo original del logo.

Agregar `AgentShowcase.tsx` y su CSS Module para la presentación del agente. Guardar capturas reales del navegador en `artifacts/presentation/`, en escritorio y móvil, más un ZIP para compartir. No incluir pantallas autenticadas, credenciales o datos privados. No realizar nuevos cambios cloud en esta fase visual.

Entregado: hero NBC en Overview, tipografía/tablas/métricas refinadas, resumen de llamadas, ficha visual Anas con playbook propuesto y detalle de conversación. Siete PNG 2x exportados y ZIP preparado. Revisión visual de overview, agente, diálogo y móvil; comprobación de ancho sin desbordes en escritorio/móvil. Build de producción y TypeScript correctos; cuatro E2E existentes pasaron. Se corrigió un selector de navegación del exportador temporal; no fue un fallo de la aplicación. Sin cambios de backend, credenciales o infraestructura.

## Actualización funcional — 2026-09-14

Navegación ampliada con Caller privado de voz en navegador, separado de fixtures. ElevenLabs ya se consume en esta sección; ver `caller-live-tests.md` para alcance, configuración y verificaciones. Las claves directas OpenAI/Anthropic siguen reservadas. GHL y telefonía pendientes.
