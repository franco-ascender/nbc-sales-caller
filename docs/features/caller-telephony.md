# Caller C08 — contrato del piloto telefónico

Fecha: 2026-09-17. Estado: contrato de implementación; telefonía todavía no habilitada. Encargo vigente: OR04/C08. Se conserva voz web, CRM, listas y separación demo/live. Piloto admin a un único número propio; no campañas ni llamadas a leads por inferencia.

## Recorrido y elección técnica

El admin revisa destino propio, voz existente, duración y presupuesto del piloto. El servidor reserva un intento persistente antes de marcar. Twilio inicia la llamada; al atender, un endpoint firmado de NBC solicita a ElevenLabs el TwiML de conexión. La pantalla permite Stop y recuperar el mismo intento después de refrescar. El resultado distingue conexión telefónica, transcripción y costo pendiente.

Elegimos **Twilio Calls + ElevenLabs register-call**. Permite controlar desde NBC el límite de duración y callbacks de la llamada. No requiere importar el número en ElevenLabs ni cambiar el webhook entrante del número existente. Para este piloto no se implementan transferencias. ElevenLabs documenta ese recorrido y requiere audio de entrada/salida μ-law 8000 Hz. [Guía oficial](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/register-call).

La alternativa nativa `POST /v1/convai/twilio/outbound-call` requiere un número importado y devuelve `conversation_id`/`callSid`; el esquema revisado no expone nuestro callback de estados ni `TimeLimit`. No se implementarán ambos caminos. [API oficial](https://elevenlabs.io/docs/api-reference/integrations/twilio/outbound-call), [OpenAPI consultado](https://api.elevenlabs.io/openapi.json).

## Endpoints externos comprobados

| Operación | Contrato |
|---|---|
| Marcar | `POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Calls.json`, formulario con `From`, `To`, `Url`, `Method=POST`, `StatusCallback`, `StatusCallbackMethod=POST`, eventos `initiated`, `ringing`, `answered`, `completed`, `Timeout`, `TimeLimit`, `Record=false`. Sin AMD, grabaciones ni transferencias. |
| Estado/Stop | GET/POST `.../Calls/{CallSid}.json`; Stop solicita `Status=canceled` antes de conexión o `Status=completed` conectado. Ante carrera, releer estado y terminar la llamada aún activa; nunca redial. |
| Conectar voz | `POST https://api.elevenlabs.io/v1/convai/twilio/register-call`, header `xi-api-key`, JSON `agent_id`, `from_number`, `to_number`, `direction=outbound`, `conversation_initiation_client_data.dynamic_variables.nbc_attempt_id`. Devuelve TwiML, no una respuesta JSON de inicio. |
| Resultado | Webhook ElevenLabs `post_call_transcription`; recuperación con GET `/v1/convai/conversations/{conversation_id}`. Conservar `call_initiation_failure` si el proveedor lo emite, sin depender de él para establecer el estado telefónico. |

Twilio documenta estados, duración, Stop y callbacks que pueden llegar desordenados. `completed` acredita conexión terminada, no conversación con una persona ni conversión comercial. [Call resource](https://www.twilio.com/docs/voice/api/call-resource). El registro de voz y la metadata de conversación se verificaron también en el OpenAPI oficial de ElevenLabs; correlacionar `metadata.phone_call.call_sid` además del ID de intento.

## API NBC y persistencia propuesta

Rutas Caller nuevas: POST/GET `/api/caller/phone/attempts`, GET `/api/caller/phone/attempts/[id]`, POST `.../[id]/stop`, POST `.../[id]/reconcile`; webhooks POST `/api/caller/phone/webhooks/twilio/connect`, `twilio/status` y `elevenlabs`. Son rutas propuestas, todavía inexistentes.

Operaciones de usuario: membresía activa y rol admin comprobados en servidor, aislamiento por propietario, sin aceptar agent/cuenta/costo arbitrarios del cliente. El navegador envía UUID de idempotencia y referencia a piloto aprobado. Configuración privada resuelve números y agente; destinos no salen de la lista permitida del piloto.

La migración candidata `202609180090_caller_phone_attempts.sql` crea `caller_phone_pilots`, `caller_phone_attempts` y `caller_phone_events`. Guarda propietario, piloto, UUID, hash de solicitud, destino normalizado privado, IDs de proveedor únicos, estados, solicitud Stop, reserva de costo, costo real nullable y resultado. Eventos deduplicados y transiciones se confirman en una transacción. Clientes sin permisos de escritura directa; lecturas bajo aislamiento. Sin modificar SQL ya aplicado ni reutilizar `channel=web` como telefonía. La proyección hacia historial/Usage debe conservar origen telefónico y deduplicar por intento; no alterar tarifas comerciales comunes desde Caller. La migración no se aplicó.

## Estados, concurrencia y recuperación

- Despacho: `reserved → dispatching → accepted`, o `rejected` si existe rechazo inequívoco. Timeout, caída del proceso o respuesta incompleta después de reclamar el despacho producen `dispatch_unknown`; no se libera por TTL ni se repite el POST externo automáticamente.
- Teléfono: `queued → ringing → in_progress → completed`, con terminales alternativos `busy`, `no_answer`, `failed`, `canceled`. Permitir saltos por eventos faltantes; ningún evento tardío reabre un terminal. Conflictos entre terminales requieren GET al proveedor.
- Resultado independiente: `pending → available | unavailable`; costo `pending → settled`. Una llamada terminada puede seguir esperando transcripción/costo. Ausencia de datos nunca se transforma en cero ni en venta.
- UUID repetido con mismo propietario/payload devuelve el intento existente; payload distinto devuelve409. Un claim atómico permite un solo emisor y un único intento activo por piloto; nuevos UUID tampoco eluden ese límite.
- Correlación de callback: UUID en URL firmada, cuenta esperada, From/To reservados y binding único de CallSid. Permite recuperar una respuesta de creación perdida sin buscar coincidencias vagas por número/hora. Un SID diferente queda en conflicto y no crea otro intento.
- `register-call` también tiene claim persistente por intento/CallSid. Guardar su TwiML temporalmente en almacenamiento privado antes de responder; un callback repetido reutiliza esa respuesta. Una respuesta perdida/ambigua de registro termina la llamada con Hangup; no vuelve a registrar otra conversación. No registrar secretos de la URL de audio.
- Stop persiste primero `stop_requested_at`; si no hay SID muestra “Stop requested”, no “Stopped”. El callback de conexión devuelve Hangup si existe Stop, falta autorización o cambió DNC. Cuando aparece el SID, ejecutar la cancelación pendiente. Estado final exige confirmación del proveedor; un fallo de Stop permanece visible y recuperable.
- Refrescar/reconcile solo consulta, consolida y reintenta una terminación pendiente; nunca marca. C-RECOVERY: identidad/generación de operación libera el estado ocupado aun si rotó el token, sin aplicar resultados antiguos; probar renovación, cambio de usuario, logout y desmontaje.

## Webhooks y DNC

Twilio: validar `X-Twilio-Signature` con Auth Token, URL HTTPS canónica configurada y todos los campos del formulario; no confiar en Host/forwarded headers del cliente. La firma no aporta caducidad: deduplicar por CallSid/SequenceNumber/tipo y validar intento/cuenta. [Seguridad oficial](https://www.twilio.com/docs/usage/security).

ElevenLabs: validar HMAC del cuerpo crudo y timestamp de `ElevenLabs-Signature`, comparación constante y ventana de aceptación; deduplicar por tipo/conversation_id/event_timestamp y hash. Validar agente, intento reservado y CallSid antes de asociar la transcripción. Eventos válidos sin correlación suficiente se guardan pendientes para conciliación, sin inventar propietario. Responder200 después de persistir; un fallo DB devuelve error recuperable. [Webhooks oficiales](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks).

DNC se verifica en servidor, incluyendo coincidencia del teléfono normalizado en CRM del propietario. Claim/reserva y lectura DNC deben serializarse en DB con las modificaciones DNC pertinentes. Su commit es el punto de autorización; DB y proveedor no forman una transacción distribuida. Revalidar antes de la conexión y cancelar si DNC cambia después del claim. Nunca iniciar el piloto usando una fila demo como permiso.

## Límites y configuración para Infra

Propuesta de piloto: una sola llamada, voz estándar, conversación máxima60s y timbrado20s; duración y valor monetario requieren revisión de Franco antes de habilitar. `TimeLimit` de Twilio debe enviarse desde el inicio, junto al límite compatible del agente telefónico. El agente web actual se conserva; preparar agente/versión telefónica independiente si sus formatos difieren.

Presupuesto en USD aún **desconocido**. Antes de aprobar, obtener tarifa de destino de la cuenta Twilio, unidad/redondeo, streaming, tarifa de Agents y LLM, extras e impuestos aplicables; reservar una cota conservadora. Si algún componente no puede acotarse, bloquear Start y explicar el pendiente. Un timeout HTTP o cerrar la pestaña no limita gasto. El tope de admisión no se presenta como garantía de facturación del proveedor. No liberar reserva ambigua ni habilitar repetición; conciliar costo Twilio y ElevenLabs por separado, sin conversión arbitraria a NBC Credits.

Pendientes de configuración: cuenta/key ElevenLabs Premium correcta y agente telefónico; `TWILIO_ACCOUNT_SID`, credencial REST y `TWILIO_AUTH_TOKEN` para firma; número de origen existente con voz y destino propio verificado si la cuenta es trial; `ELEVENLABS_WEBHOOK_SECRET`; `CALLER_PUBLIC_BASE_URL` estable; piloto con propietario, destino, tarifas y presupuesto aprobados; migración nueva y rutas publicadas por el ejecutor coordinado. Feature flag telefónico apagado hasta completar comprobaciones. Nada de esto se instaló en esta fase.

## Cobertura local por ciudad

La asignación de caller ID se resuelve en servidor desde un inventario NBC de números locales activos, con clave ciudad/estado/rate center; no se acepta un `From` desde cliente. Para una ciudad sin cobertura, el sistema puede cotizar en modo lectura según demanda o campaña, pero nunca compra. La compra requiere límite de números, requisitos regulatorios aptos y aprobación explícita de Anas. El contrato de la política y los tests están en `docs/features/caller-city-number-coverage.md` y `src/lib/caller-city-numbers.ts`.

## Aceptación de implementación

Fixtures: auth/owner/DNC, doble click y concurrencia, replay y firmas falsas, callback antes de respuesta, pérdida de respuestas de creación/registro, eventos fuera de orden, Stop antes/durante conexión, refresh de sesión, costos/transcripción pendientes. Una prueba DB real debe demostrar los claims y reservas concurrentes; mocks no la sustituyen. Después, una llamada al destino propio expresamente aprobado, observar audio bidireccional, duración, Stop, historial y resultado tras recargar. Registrar separadamente cuenta, número/agente, voice test, clonación y telefonía.

Clonación no forma parte del piloto: falta identificar aportante, consentimiento y muestra. No se incorpora HeyGen por inferencia. C-AUDIO entra si se incorpora grabación/upload; la voz existente evita esa dependencia.
