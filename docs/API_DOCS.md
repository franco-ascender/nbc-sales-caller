# API — NBC Voice AI

> Actualización de alcance Academy/S01/KCAL01: ver la sección de consolidación OR01 del 2026-09-15 al final. Las secciones anteriores conservan el estado histórico; no describen por sí solas toda la plataforma actual.

Actualizado: 2026-09-14. Endpoints implementados localmente; login Supabase, conversación ElevenLabs y persistencia verificados. Contactos y webhooks reales de GHL pendientes.

## Autenticación

Los endpoints de datos reales reciben `Authorization: Bearer <access_token_de_Supabase>`. El servidor valida el token con Supabase Auth, email confirmado y coincidencia con `NBC_OPERATOR_EMAIL`. No se confía en claims decodificados en el navegador. El token de GoHighLevel permanece en el servidor.

El webhook recibe una credencial independiente configurada como `GHL_WEBHOOK_SECRET`, también por Bearer. Se compara mediante hashes de longitud fija con comparación constante. Sin credencial configurada, el endpoint no se habilita.

## Endpoints

| Método | Ruta | Acceso | Resultado |
|---|---|---|---|
| GET | `/api/integrations/status` | Público | Cuatro booleanos de configuración, sin secretos ni datos de cuenta |
| POST | `/api/integrations/ghl/test` | Operador | Verifica un contacto de la subcuenta configurada |
| GET | `/api/integrations/events` | Operador | Últimos 25 eventos de la subcuenta configurada |
| POST | `/api/webhooks/ghl` | Secreto del workflow | Persiste un evento o reconoce un duplicado |

### Estado

Respuesta 200: `{ "ghl": false, "auth": false, "storage": false, "webhook": false }` cuando falta configuración. Un valor `true` solo indica presencia de las variables correspondientes, no credenciales válidas, migración aplicada ni conexión comprobada.

### Verificar contacto

JSON: `{ "contactId": "abc123" }`.

Respuesta 200: `{ "contact": { "id": "abc123", "name": "Test Contact", "checkedAt": "<ISO timestamp>" } }`.

Realiza `GET /contacts/:contactId` contra el host oficial permitido, usa `GHL_API_VERSION`, Bearer privado y timeout de 10 segundos. Rechaza redirecciones y comprueba ID del contacto y `locationId` de la respuesta. No escribe en el CRM ni llama al contacto. [Contrato oficial consultado](https://marketplace.gohighlevel.com/docs/ghl/contacts/get-contact/index.html).

### Historial

Respuesta 200: `{ "events": [...] }`; cada fila contiene `id`, `event_id`, `event_type`, `contact_id`, `received_at`. Orden descendente por recepción y filtro de subcuenta en el servidor. Una lista vacía es un resultado válido.

La respuesta incluye `configured: true` cuando existe subcuenta. Sin `GHL_LOCATION_ID`, después de verificar al operador, devuelve `{ "events": [], "configured": false }` sin consultar la base. Esto permite iniciar sesión antes de conectar GoHighLevel y conserva el rechazo de usuarios no autorizados.

### Webhook de workflow

JSON:

```json
{
  "eventId": "test-001",
  "locationId": "configured-location",
  "contactId": "test-contact",
  "type": "integration.test"
}
```

Contrato propio del workflow; no pretende ser el payload nativo de Marketplace. `type` admite `contact.created`, `contact.updated`, `integration.test`. `locationId` debe coincidir con la cuenta configurada. `eventId` y `contactId` admiten `[a-zA-Z0-9_-]`, de 1 a 100 caracteres. El ID del evento debe permanecer estable al reintentar.

- 201: `{ "received": true, "duplicate": false }`, inserción persistida.
- 200: `{ "received": true, "duplicate": true }`, ya existe la pareja subcuenta/evento.
- 503 ante fallo de persistencia; reintentar conservando el mismo ID.

No hay cola, reintento autónomo, escritura en CRM ni ejecución de llamadas. El orden de recepción no se interpreta como orden causal de cambios del contacto. Un duplicado no modifica el registro previo.

## Validación y errores

POST exige `application/json`; lectura limitada a 8 KiB. Errores con `{ "error": "mensaje seguro" }`. Códigos: 400 payload inválido, 401 sin autenticación o secreto incorrecto, 403 operador/cuenta no permitidos, 404 contacto no encontrado, 413 cuerpo excesivo, 415 tipo de contenido, 502 fallo externo, 503 configuración/almacenamiento no disponible, 500 error no previsto.

Los endpoints de estado y datos de operador usan `Cache-Control: no-store`. No devuelven respuestas crudas del proveedor ni secretos. No hay rate limiting de aplicación todavía; antes de exposición pública, acordar límites y protección del entorno.

## Caller — 2026-09-14

Todas las rutas requieren operador confirmado y permitido; usan su UUID para filtrar filas y `Cache-Control: no-store`.

| Método y ruta | Entrada | Respuesta |
|---|---|---|
| GET `/api/caller/sessions` | Bearer del operador | 200 `{ sessions: [...], configured: boolean }`, últimas treinta propias |
| POST `/api/caller/sessions` | JSON `{ sessionId: "<UUID v4>" }` | 201 `{ sessionId, signedUrl, conversationId, maxDurationSeconds: 300 }` |
| POST `/api/caller/sessions/:id/sync` | UUID v4 en ruta; sin cuerpo obligatorio | 200 `{ session }`, resultado consultado y persistido |

La URL firmada es credencial temporal de un solo uso para una conversación concreta; no registrarla, persistirla ni compartirla. El servidor fija `provider_call_id` antes de devolverla. Un reintento del mismo inicio devuelve 409; no devuelve una nueva autorización. También 409 si existe otra reserva activa, y 429 después de veinte reservas del operador en 24 horas. La concurrencia está reforzada por índice único SQL y límites del agente.

La sincronización no acepta ID del proveedor, transcripción ni duración del cliente. Comprueba que la respuesta corresponde al agente y conversación guardados. Una sesión ajena o inexistente devuelve 404. `completed`/`failed` se sirven desde SQL; `processing` indica que el proveedor todavía no terminó. Respuestas y normalización definidas en `caller-types.ts` y `caller-validation.ts`; no se devuelve `operator_id` ni `provider_agent_id`.

Errores seguros: 400 identificador, 401 autenticación, 403 operador, 404 sesión/conversación, 409 inicio duplicado o simultáneo, 429 cuota, 502 proveedor/respuesta no verificable, 503 configuración o almacenamiento. El límite de cuerpo de 8 KiB y content type JSON aplica al POST de creación; sync no necesita cuerpo. Los límites actuales controlan inicios de voz, no constituyen rate limiting general de todas las rutas.

Referencias primarias verificadas: [autorización firmada](https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-signed-url), [resultado de conversación](https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get) y [SDK JavaScript](https://elevenlabs.io/docs/eleven-agents/libraries/java-script).

## Rutas de plataforma (páginas)

`/` Home, `/caller` Caller privado, `/lead-engine` planificador local, `/academy` importador de inventario local, `/ask-anas` preparación de corpus, `/integrations` conexiones y `/demo` presentación anterior. Son páginas, no APIs nuevas. Caller e Integrations mantienen la autorización existente. Academy y Lead Engine no envían datos al servidor ni disparan scraping/LLM. Persistencia, workers e importación de videos quedan para los próximos contratos.

## Academy — contratos K01-r6 consolidados el 2026-09-15

Las descripciones iniciales de esta documentación son históricas. Academy ahora tiene endpoints; las rutas abajo requieren Bearer Supabase, identidad/membresía activa comprobada con `requireWorkspaceUser` y rol admin con `requireAcademyAdmin`. Owner se deriva de la identidad validada; no se admite owner_id del cliente. Lecturas de inventarios y revisiones filtran owner. Fuente: rutas actuales y `academy.service.ts`; revisión OR01 con correcciones, persistencia real pendiente.

| Método y ruta | Request | Response |
|---|---|---|
| GET `/api/academy/inventories` | offset entero opcional, default0 | 200 `{inventories: AcademySummary[], nextOffset: number|null}`; páginas20 ordenadas created_at/id DESC |
| GET `/api/academy/inventories/:id` | id UUIDv4; revision entera>=1 opcional | 200 `{inventory: AcademyDocument}`; actual o revisión propia |
| GET `/api/academy/inventories/:id/revisions` | id UUIDv4, offset opcional | 200 `{revisions: [{revision,name,createdAt}], nextOffset}`; páginas20, revisión DESC |
| PUT `/api/academy/inventories/:id` | JSON `{expectedRevision,name,manifest,origin}` | 201 nueva/200 actualización `{inventory: AcademyDocument}` |
| POST `/api/academy/covers` | Content-Type image/jpeg; cuerpo binario <=2MiB | 201 `{coverId}` UUID generado en servidor |
| GET `/api/academy/covers/:id` | id UUIDv4 | 200 bytes JPEG privados del owner; 404 ajeno/inexistente |

AcademySummary: `{id,name,revision,createdAt,updatedAt}`. AcademyDocument añade `{manifest,origin}`; origin `{label,url?}` con label1–160 y referencia HTTPS opcional <=2048, sin credenciales. name1–160; expectedRevision0 crea y entero>=1 actualiza por CAS. Manifiesto v1/v2 validado con IDs/jerarquía/límites antes del RPC. No guarda File/base64/dataURL ni hace fetch de referencias. Cuerpo JSON limitado a1MiB+16KiB, manifiesto1MiB.

JSON privado: Cache-Control no-store. Portadas: private,no-store, nosniff y CSP sandbox. Storage requiere bucket privado, rutas owner/coverId y upsertfalse. Validación de tamaño/firma/dimensiones implementada; **OR01 encontró aceptación de JPEG truncado no decodificable**, corrección A2 pendiente. No afirmar validación de imagen completa hasta resolverla.

Errores JSON `{error: mensajeSeguro,code}`: 400 invalid_request/invalid_cover; 401/403 operator_access para auth/rol; 404 not_found; 409 revision_conflict; 413 payload_too_large/cover_too_large; 415 unsupported_media_type; 503 storage_pending/storage_unavailable; 500 request_failed. Inventario ajeno no se revela. Fallo/conflicto debe preservar borrador; OR01 hallazgo A1 requiere corregir interacción JSON/editor visual. Falta de tabla/RPC/bucket se informa como dependencia, no como guardado exitoso.

Sesión S01 reutiliza GET `/api/workspace/session` con Bearer y membresía activa; Calendar KCAL01 reutiliza GET `/api/calendar` con `{events,timezone,externalStatus,checkedAt}`. No agregan endpoints en estas entregas. La ventana de12h del navegador no modifica contratos JWT. El calendario solo muestra sesiones próximas disponibles; no garantiza histórico/meses completos. Otros endpoints de plataforma nuevos requieren sus propias revisiones de lane.

## Contratos de plataforma consolidados — OR02 (2026-09-16)

El [índice runtime](reference/runtime-contract-index.md) enumera rutas/métodos y enlaza a cada implementación; las secciones iniciales Caller/planificador local son históricas. Contratos detallados se conservan en features de Caller sales/operations/workbench/dashboard, Lead Engine, Members y account-usage, más reportes finales C07/L01/I09.

- Caller: sesiones paginadas y reconcile; leads/import/details/activity, listas/pipeline, views Analytics/CRM, demo y voices/capabilities/clone. UUID de identidad verificada filtra datos; voces/demo admin. No endpoint de llamadas telefónicas salientes operativo.
- Lead Engine: planes y dry-run, carpetas/listas/datasets/jobs y cotizaciones/aprobación; conexiones admin en Settings. Autorización actual requireOperator no consulta membresía NBC: **L-AUTH abierto** para operador suspendido/degradado. No confundir guard del portal con protección efectiva de cada API.
- Members: sesión y resumen, lectura/mutaciones de onboarding/calendario/asignaciones/chat/tickets/créditos. Roles/relaciones verificados; I-ONBOARD e I-EVENT requieren corrección de concurrencia/idempotencia.
- Settings/Usage/Credits: perfil, consumo admin, paquetes/checkout/webhook. Preparación Stripe no acredita cobros reales; paquetes/debitos comerciales no habilitados por esta revisión.

OR02: GET anónimo workspace/session y lead-engine/plans401; reproducción controlada con token de operador suspendido: workspace403/lead plans200. No se consultaron contactos reales ni ejecutaron mutaciones remotas. Es un hallazgo reproducible de guard, no autorización para el uso de esas rutas.


## Actualización L02 / I10

L02 local, 2026-09-16: operaciones de planes y research Lead Engine exigen operador configurado + membresía existente admin/active mediante requireLeadOperator. Sin membresía/rol/status válido:403; fallo de consulta:503. Diagnóstico de conexiones conserva requireWorkspaceAdmin. Sin nuevos endpoints ni cambios de payload. Evidencia en docs/lanes/reports/L02.md; no publicado.
