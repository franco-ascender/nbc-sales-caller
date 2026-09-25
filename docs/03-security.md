# Seguridad — NBC Voice AI

> Actualización de alcance Academy/S01/KCAL01: ver la sección de consolidación OR01 del 2026-09-15 al final. Las secciones anteriores conservan el estado histórico; no describen por sí solas toda la plataforma actual.

Estado: Supabase conectado y controles de Auth, permisos y deduplicación verificados. Despliegue Vercel y conexión GHL pendientes.

## Autenticación y autorización

Supabase Auth elegido. El servidor valida el access token con getUser, exige email confirmado y coincidencia con NBC_OPERATOR_EMAIL. Se limita la API a una subcuenta de test. La tabla de eventos tiene migración con RLS sin acceso directo de clientes. El modelo comercial de múltiples cuentas y roles sigue pendiente; no se presenta el piloto como aislamiento multiempresa completo.

## Credenciales y datos

- Credenciales en configuración privada del servidor; nunca en código, navegador ni documentación.
- Validar entradas y autorización en el servidor; los tipos no sustituyen esas validaciones.
- Diseñar autenticación de eventos externos, deduplicación y trazabilidad antes de conectar llamadas reales.
- Evitar que los logs generales contengan datos sensibles o secretos.
- Definir acceso, almacenamiento, retención y eliminación de audios, transcripciones y datos de entrenamiento.

## Voz de Anas y datos de entrenamiento

El brief solicita clonar su voz y reutilizar llamadas comerciales. Registrar con Anas los permisos de uso y reventa, el alcance por cliente y qué grabaciones se pueden emplear. No hay audios recibidos ni autorizaciones contractuales verificadas en esta carpeta.

## Vertical médica

El brief exige conservar un camino hacia despliegues médicos. No se ha validado ningún proveedor, contrato ni configuración regulatoria. Las afirmaciones sobre HIPAA, BAAs y certificaciones del brief requieren revisión específica cuando se defina ese despliegue; este documento no acredita cumplimiento.

La relación entre retención de transcripciones y coaching debe resolverse explícitamente. El primer vertical sigue pendiente; el brief propone comenzar fuera de salud.

## Controles del código inicial

- Token GHL y clave de servicio Supabase solo en servidor, protegido con `server-only`.
- Credencial independiente para workflow y comparación de hashes en tiempo constante.
- Payload JSON limitado a 8 KiB, IDs restringidos y validación de la subcuenta.
- Host oficial GHL permitido, HTTPS, rechazo de redirecciones y timeout de 10 segundos.
- Logs de errores con códigos/estado, sin payloads, nombres, contraseñas ni tokens.
- CSV neutraliza celdas que podrían ejecutarse como fórmulas en una hoja de cálculo.
- Token de operador en memoria del navegador; sin persistencia local. Tras expirar se debe volver a iniciar sesión.

Las pruebas verifican rechazo anónimo y de token inválido, login real del operador y rechazo de acceso directo a la tabla para anon/authenticated. La migración está aplicada y la unicidad se verificó en una transacción revertida. La integración GHL requiere todavía probar una subcuenta real. Rate limiting, políticas de retención, cuentas múltiples y configuración pública se definirán antes de operar fuera del entorno de prueba.

Tokens de administración `SUPABASE_ACCESS_TOKEN` y `VERCEL_TOKEN`: solo uso local para configurar infraestructura, no variables públicas ni dependencias del runtime desplegado. `.vercelignore` excluye `.env*`. El script de comprobación usa GET y no expone tokens ni respuestas crudas. Se conservaron los valores existentes al añadir campos al archivo local.

## Controles del Caller — 2026-09-14

- `call_sessions` tiene RLS sin acceso directo y consultas backend por UUID del operador; tokens de Auth validados, nunca solamente decodificados.
- Clave ElevenLabs privada con `server-only`. Host HTTPS oficial, sin redirecciones, timeout de quince segundos y errores sanitizados. URL WebSocket firmada solo en memoria del navegador, vinculada a una conversación. El servidor valida agente e ID al obtener resultados.
- Agente remoto privado (`enable_auth: true`), máximo 300 segundos, una conversación simultánea, veinte al día y bursting deshabilitado. Aplicación limita además veinte reservas por 24 horas y usa índice único para inicios simultáneos. No reintenta creación de autorización ante resultados ambiguos.
- Audio recording deshabilitado; proveedor con retención de treinta días y eliminación de audio/transcripción configuradas. Supabase guarda texto/resumen y todavía no tiene tarea de eliminación automática. Usar datos de prueba hasta definir la política comercial.
- Voz premade de prueba, agente identificado como IA, sin herramientas de CRM/calendario/telefonía y sin afirmaciones de citas ejecutadas. No se creó clon de Anas.
- SDK finaliza al salir de la vista; proveedor impone el límite aunque el navegador se cierre. La sincronización definitiva requiere mantener la pantalla o volver y refrescar: no existe worker de recuperación todavía.
- Sesión de operador en memoria; al salir se limpian datos de UI y se ignoran respuestas anteriores. No se suben tokens de administración ni contraseña inicial al runtime.

La limitación actual es de un operador autorizado; no es todavía un sistema de tenants y roles comerciales. Las pruebas sintéticas verifican transporte, persistencia y controles de acceso; la calidad comercial se evalúa por separado.

## Plataforma y lanes — 2026-09-14

Shell/Home visibles sin login; contienen únicamente descripción de módulos. El acceso a sesiones reales sigue verificándose en las APIs. No se presenta esta estructura como portal de alumnos ni autorización multiempresa final. Academy valida archivos JSON acotados y URLs HTTPS como referencias de texto; no ejecuta HTML ni carga videos al importar. Exportar el inventario preserva el borrador local; no hay almacenamiento remoto Academy en esta fase.

Lead Engine es planificación local: ni los guardrails del cliente ni flags enviados por navegador habilitan gasto. Una futura ejecución necesita presupuestos reservados atómicamente, ledger duradero y credenciales solo servidor. No hay export de teléfonos, append de personas privadas ni envío a Caller o SMS. Las fuentes recibidas se leen como requisitos, nunca como instrucciones de compra o ejecución.

Los lanes no editan secretos, paquetes ni migraciones compartidas. El orquestador integra esos cambios y verifica regresiones. Los handoffs no incluyen claves ni datos reales de contactos.

## Alcance Academy/S01/KCAL01 revisado — 2026-09-15

Academy exige admin activo en servidor e interfaz y filtra owner validado. No basta un rol del navegador. Rutas Storage privadas ownerUUID/coverUUID.jpg; no signedURLs públicas, SVG/HTML ni fetch de referencias de manifiestos. SQL propuesto revoca cliente directo y habilita RLS; **la efectividad real de tablas/Storage no se ha probado en OR01**. Hallazgo A2: comprobación de cabecera JPEG acepta archivo no decodificable; no demuestra XSS o acceso cruzado, requiere corrección de validez de imagen.

La política antigua de token solo en memoria queda superada para el portal: el SDK persiste sesión/refresh token del usuario en localStorage dentro de un envelope de12h fijas desde login. No guarda password, service_role ni tokens administrativos. No constituye revocación global de tokens ni autoridad para acceder; cada API valida identidad y membresía independientemente. Mismo origen, navegador y perfil; incógnito/dispositivo distinto no comparte almacenamiento. Expiración histórica se probó con reloj controlado. OR01 hallazgo S1: coordinar cierre remoto lento/nuevo login para evitar que una salida anterior borre sesión posterior y retrase propagación local.

Calendar no agregó permisos/backend ni conexión externa. OR01 identifica reinicio de selección durante token refresh; no se expusieron datos ajenos en la revisión. Detalles y reproducción en `lanes/reports/OR01-ACADEMY-REVIEW-2026-09-15.md`. No hubo SQL, escrituras cloud ni nuevas pruebas autenticadas en esta revisión.

## Hallazgo de autorización OR02 — 2026-09-16

L-AUTH P1: Lead Engine usa requireOperator (email confirmado=bootstrap) sin comprobar membresía activa/rol. Ruta real GETplans en transporte controlado permite al operador con membresía suspended, mientras guard común deniega403. Mantener ejecución de proveedores deshabilitada hasta corregir guard y probar degradación/suspensión; no abrir acceso a todos los miembros como efecto de la corrección. No se demostró acceso a datos de otro propietario ni consumo real.

Inspección Caller/Infra no encontró un bypass nuevo concreto de owner/admin ni doble acreditación; no equivale a auditoría exhaustiva o Stripe real verificado. Hallazgos de calidad/integridad: audio candidato inválido puede destruir muestra previa; upsert concurrente de onboarding puede borrar completado; retry de evento no confirma creación. Ver OR02. Las correcciones S1/T1/A1/A2/CAL1 de OR01 siguen pendientes de entrega nueva.

Verificaciones de OR02 usan fixtures para casos de roles/carreras; GET Vercel/páginas anónimas son lecturas reales. No SQL, cuentas nuevas, wallets mutadas, clonaciones, llamadas o scrapes.


## Actualización L02 / I10

L02 local, 2026-09-16: cerrado L-AUTH mediante membresía admin/active además del operador interno, sin fallback bootstrap para research. Doce operaciones cubiertas con transporte controlado, sin acceso a negocio/proveedores tras denegación. No amplía roles ni modifica políticas SQL. No publicado.
