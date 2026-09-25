# OR02 — Revisión del orquestador: Infraestructura, Caller y Lead Engine

Fecha: 2026-09-16. Entrada: tres reportes consolidados remitidos por Franco. Alcance: I01–I09, C01–C07 y L01-r1–r9, conectados con la revisión previa OR01 de Academy/S01/KCAL01. **Estado: REVISADO CON CORRECCIONES, no aceptación de lanzamiento comercial.** No se modificó runtime ni se ejecutaron SQL, compras, llamadas, scraping, push o deploy.

## Estado comprobado ahora

- GET Vercel a las **15:38:19 UTC**: alias habitual `https://nbc-sales-nbc-sales.vercel.app` apunta a `dpl_yCUAVQPNyp4nySasyLosVRSUBpCC`, READY, staging (L01-r9). Los234 archivos de su manifiesto coinciden byte a byte con sus archivos locales; tar y hash canónico válidos. No es una comparación de todos los archivos no publicados del workspace.
- `/`, `/caller`, `/lead-engine`: HTTP200 sin login de Vercel. `/api/workspace/session` y `/api/lead-engine/plans`:401 anónimo. Esto verifica accesibilidad/guard anónimo, no sustituye pruebas visuales o con miembros reales.
- `npm test`: **177/177** pruebas pasan, cero fallos/omitidas. Transportes de rutas controlados; no llamadas a proveedores pagados.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: **exit2**, persiste T1 de OR01 (snapshots históricos de artifacts incluidos y tipos BodyInit en tests/academy-covers.test.ts). No implica que los builds aislados históricos no hayan pasado.
- Siete migraciones recibidas coinciden con sus hashes de aplicación históricos. La evidencia registra Members, Usage, Caller040/050/060/070 y Lead Engine010 como aplicadas; **no reaplicarlas**. OR02 no consultó esquema remoto ni ejecutó tests SQL. Academy020 sigue como propuesta según evidencia disponible.

## Hallazgos nuevos

### L-AUTH — P1 — Lead Engine omite suspensión/rol de la membresía NBC

`src/services/lead-engine.service.ts:15` y `src/services/lead-engine-scrape.service.ts:17` usan `requireOperator`. `src/services/integration.service.ts:31–42` admite el email bootstrap confirmado sin consultar nbc_members; `workspace-auth.ts:11–15` sí consulta membresía y rechaza suspended.

**Reproducción ejecutada sobre ruta real y transporte local controlado:** mismo usuario Auth válido, email igual a NBC_OPERATOR_EMAIL, membresía student/suspended. requireWorkspaceUser responde403; GET `/api/lead-engine/plans` responde200 y hace cero lecturas de membresía. No se usó una cuenta suspendida real ni se accedió a contactos ajenos. La autorización por email no respeta una suspensión aplicada en el portal. Esto es independiente de la limitación declarada de no habilitar estudiantes/créditos todavía.

**Corrección:** exigir membresía activa y rol autorizado además del alcance interno actual. No abrir automáticamente la herramienta a cualquier miembro por sustituir el guard. Pruebas de suspensión/degradación/ausencia de membresía y autorización antes del store/proveedor. Prioridad previa a habilitar consumo. No se demostró gasto ni acceso cruzado actuales.

### C-RECOVERY — P2 — Recuperación queda bloqueada tras rotación de token

`src/components/dashboard/Caller.tsx:97–114` y efecto `:220–224`. Si se renueva el token mientras reconcile espera, el nuevo recover sale por recoveryLock; el finally antiguo libera el lock pero solo limpia recovering si el token coincide. Se queda `recovering=true`, bloqueando controles que dependen de ese estado.

**Reproducción ejecutada:** cuerpo real de recover transpilado en memoria, refs/request controlados, segunda invocación durante la primera y token distinto: recoveringState=true, recoveryLock=false. No se montó React ni llamó a ElevenLabs. Corregir estado por generación/identidad de operación sin permitir que respuestas antiguas reemplacen datos nuevos; probar renovación, cancelación y logout.

### C-DRAFT — P2 — Renovación borra personalización de Analytics sin guardar

`src/components/dashboard/CallerAnalytics.tsx:20–21` y `CallerDashboardLayout.tsx:8–11`. Los efectos ligados a token cierran Customize y restauran configuración persistida al renovar credenciales del mismo usuario. Reproducción por inspección: mover/quitar widgets sin guardar → TOKEN_REFRESHED → borrador descartado. Preservar borrador por identidad/modo; invalidar acceso no equivale a resetear preferencias. Reproducción browser pendiente.

### C-AUDIO — P2 — Audio malformado reemplaza la muestra válida antes de decodificar

`src/components/dashboard/CallerAudioRecorder.tsx:11–14` cambia archivo/revoca URL antes de decodificar e ignora el fallo. Un WAV2048bytes con RIFF/WAVE y sin chunks de audio supera reconocimiento superficial y destruye la muestra previa. El endpoint clone usa también detección superficial (`src/app/api/caller/voices/clone/route.ts:14–16`). Hallazgo de recorrido de código y comprobación local del helper; no se envió audio al proveedor ni se generó un clon.

Conservar la muestra anterior hasta validar candidato; distinguir formato no decodificable en navegador de archivo malformado. Validar cuerpo en servidor antes de reservar/despachar creación. Pruebas de muestra válida→corrupta, recheck y doble submit; no iniciar consumo para probarlo.

### I-ONBOARD — P2 — Un borrador atrasado puede deshacer onboarding completado

`src/services/member-workspace.ts:82–86`: lectura de completed_at seguida de upsert no atómico. Dos pestañas leen incompleto; Complete guarda fecha, y Save for later con lectura anterior escribe null.

**Reproducción ejecutada:** servicio real con transporte controlado, GET de borrador retenido hasta después del completado: completed=true→null. No PostgreSQL real. Conservar completed_at de forma atómica o rechazar revisiones atrasadas; no sustituirlo por otra lectura JS. Si requiere SQL, nueva migración coordinada: no reescribir Members aplicada.

### I-EVENT — P2 — Reintentar una sesión ya creada devuelve conflicto

`src/services/member-workspace.ts:94` usa insert directo; `src/components/members/MemberPanels.tsx:24–25` conserva ID tras error. Si se pierde la respuesta de una creación exitosa, reenviar el mismo payload recibe409 por PK. Cambiar el formulario puede crear otro ID y duplicar la sesión.

**Reproducción ejecutada:** servicio real, primera inserción201 y segunda idéntica409 con transporte controlado. Resolver reintento comparando actor/payload del ID existente y devolver éxito solo cuando coincide; payload distinto sigue en conflicto. Probar confirmación perdida/concurrencia, sin eventos reales.

### I-DRAFT — P2 — Settings pierde formulario ante renovación de sesión

`src/components/account/ProfileSettings.tsx:5–6`: cambio de token hace setData(null) y vuelve a cargar perfil; borrador y respuesta usan el mismo estado. Una renovación del mismo usuario borra Business/Goal sin guardar. Separar estado guardado/borrador, conservar cambios ante refresh y responder correctamente si el usuario sigue editando durante Save. Inspección estática; prueba browser pendiente.

## Evidencia reproducible

Carpeta `artifacts/orchestrator/platform-review-20260916/`:

| Archivo/comando | Resultado y alcance |
|---|---|
| `unit-tests.log` / npm test |177 pruebas locales pasan |
| `typecheck.log` / tsc --noEmit --incremental false |exit2; T1 sigue abierto |
| `read-only-state.json` |GET alias/deployment/public checks y comparación234 archivos |
| `migrations.json` |7 hashes SQL coinciden con registros de aplicación; sin verificación DB remota nueva |
| `node artifacts/orchestrator/platform-review-20260916/access-reproduction.mjs` |Guard/ruta reales, transporte sintético: portal403/Lead plans200 para suspended |
| `node artifacts/orchestrator/platform-review-20260916/member-reproduction.mjs` |Servicio real, transporte sintético: onboarding true→null; retry evento409 |
| `node artifacts/orchestrator/platform-review-20260916/recovery-reproduction.mjs` |Función recover real, refs controlados: estado queda trabado |

Tres revisores de solo lectura asistieron la inspección por módulo. No ejecutaron cambios de aplicación, SQL compartido ni operaciones cloud. Sus recorridos estáticos no se etiquetan como pruebas de navegador.

## Dependencias comerciales, distintas de bugs

- **Caller:** CRM/listas/pipeline/views persistentes y prueba de voz web; cola solo DEMO. Faltan telefonía, ejecución saliente y cola persistente, eventos/consumo y prueba en número propio. Clonación necesita capacidad de la cuenta y muestra autorizada; usar voz existente permite desacoplarla de un piloto telefónico. No se revalidó hoy plan/cupos de ElevenLabs.
- **Lead Engine:** planes/carpetas/dry-run ya persistentes. Proveedores/tarifas reales, investigación del dueño, BatchData, conciliación final de costos y score hacia Caller siguen pendientes. El consumo continúa deshabilitado en la última evidencia DB; OR02 no vuelve a consultar ese control.
- **Infra:** roles, Members/onboarding/chat/support/Settings/Usage, wallets y adaptador de pagos existen. Stripe real, débitos/tarifa final, acceso automático tras compra y calendario externo siguen pendientes; roadmap es demo explícita, layouts Overview locales.
- **Academy:** OR01 permanece con correcciones A1/A2/S1/CAL1/T1 y DB/Storage sin habilitar según reportes. L01 documenta instalación de PostgreSQL17 local, por lo que el antiguo bloqueo “no hay psql” no debe repetirse sin comprobar el entorno. No equivale a que Storage o Academy se hayan probado.

## Decisión del orquestador y continuidad

Entrega **con correcciones**. L-AUTH primero; luego carreras/pérdidas de borrador y T1. Detalle por lane en `docs/lanes/tasks/OR02-next-round.md`; no se iniciaron automáticamente los chats escritores. Preservar los reportes históricos, SQL aplicados y candidato publicado; una nueva revisión necesita evidencia propia. Centralizar la próxima publicación para no mover el alias desde candidatos concurrentes.

Consolidación documental OR02: estado actual único, registro de migraciones/contratos y deltas de arquitectura/seguridad/deployment; pruebas y hallazgos actuales separados de los históricos. No se declara auditada toda combinación de módulos ni aprobada operación comercial. Franco revisa el candidato antes de push; recibir reportes o pasar pruebas no sustituye su autorización.
