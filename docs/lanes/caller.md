> Entrega vigente: **C07-R1 — gráficos explorables y grabación guiada**. Preview https://nbc-sales-ncp4pg5jq-nbc-sales.vercel.app/caller · [reporte C07](reports/C07.md). Hover/foco/tap, amarillo NBC, guion y reproductor propio, nombre real/checklist/recheck. Base KCAL01-R1 preserva I07/L01-R6/I06/C06. Cuenta conectada informa clonación deshabilitada; calidad de clon humano pendiente. Sin push/producción; revisión del orquestador y aceptación de Franco pendientes.

> Entrega histórica: **C05-R1, Analytics personal y CRM con drag-and-drop**. Preview https://nbc-sales-4f11nh9u6-nbc-sales.vercel.app/caller · [reporte C05](reports/C05.md). SQL070 aplicado. Base K01-R5/L01-R4/I04/S01 preservada. Revisión técnica y aceptación de Franco pendientes; push no ejecutado.

> Entrega histórica: **C04-R1, preview publicado y verificado**. https://nbc-sales-3b3uvhbln-nbc-sales.vercel.app/caller · [reporte C04](reports/C04.md). Ficha lateral, actividad con autor/fecha y pipeline propio; conserva I03/C03. SQL060 aplicada y verificada. Revisión técnica/aceptación de Franco pendientes; push no ejecutado.

> Entrega histórica: **C03-R1, preview publicado para revisión**. https://nbc-sales-m22wq95f1-nbc-sales.vercel.app/caller · [reporte C03](reports/C03.md). Mantiene I02-R4/C02/K01. SQL050 aplicado. Revisiones técnica/funcional pendientes; push no ejecutado. Las secciones siguientes conservan historia de entregas anteriores.

> Entrega histórica: **C01-R1 publicado en preview; reporte revisión 2**. Revisar https://nbc-sales-nbc-sales.vercel.app/caller y [reports/C01.md](reports/C01.md). Publicación autorizada por instrucción posterior de Franco; aceptación funcional/revisión técnica externa pendientes. El contenido anterior a las actualizaciones C01 conserva historia del baseline.

# Lane Caller

Fecha: 2026-09-14. Estado: implementación entregada al orquestador; pruebas completas pendientes de integración. El lane queda liberado cuando el orquestador cierre esta entrega. Contrato: `Caller` exportado sin props, integrado por el orquestador en `/caller`.

## Alcance documentado antes del código

Mejorar el workspace real existente con métricas sobre las últimas treinta sesiones recibidas (completadas, minutos conocidos, fallos y pendientes), búsqueda local y filtro por estado, selección de historial y exportación TXT del resultado guardado y verificado. Las métricas no representan toda la cuenta ni atribuyen ingresos/citas. Los segundos desconocidos no se convierten en cero de forma silenciosa.

Agregar control explícito de mute/unmute con `Conversation.setMicMuted(boolean)` del SDK instalado, restaurar estado al finalizar y mantener el botón de terminar disponible. Mejorar feedback de resultados en proceso, preservar resultados terminales frente a respuestas tardías y no sustituir otra selección al finalizar una consulta en segundo plano.

Dueño exclusivo: `src/components/dashboard/Caller.tsx`, `Caller.module.css`, `src/lib/caller-*`, tests unitarios Caller y este handoff. No se prevén cambios de API, tablas, proveedor ni configuración remota. No ejecutar nuevas conversaciones pagadas ni llamadas telefónicas durante esta entrega. Documentación global/build/E2E a cargo del orquestador.

## Validación prevista

Tests unitarios de métricas acotadas, duraciones ausentes, búsqueda y filtros, exportación que rechaza resultados provisionales y evita incluir campos internos, y protección de resultados terminales. Integración del navegador y compilación final centralizadas por el orquestador.

## Próxima tarea tras esta entrega

Evaluación humana de conversación con una matriz de casos comerciales; después conectar GHL y telefonía con destino de prueba explícito. Faltan metodología/voz autorizadas de Anas, sincronización en segundo plano, política de retención y operación multiempresa.

## Entrega implementada

- Cuatro métricas de sesiones reales: completadas, minutos conocidos, fallos y pendientes. Reservas expiradas y duraciones ausentes explícitas; alcance máximo treinta sesiones, independiente de los filtros del historial.
- Búsqueda local en ID, resumen y transcripción guardada; selector de estado, resumen por fila, selección destacada y estado vacío con limpieza de filtros.
- Descarga TXT del resultado seleccionado: ID local, fechas, canal, estado, duración, verificación, resumen y turnos con timestamp. Requiere estado `completed`/`failed`, `synced_at` y texto. Excluye ID del proveedor y campos internos; no descarga mensajes provisionales del SDK.
- Mute/unmute con `Conversation.setMicMuted(boolean)` de `@elevenlabs/client` 1.25.0. Confirmado en las declaraciones instaladas `dist/VoiceConversation.d.ts` y `dist/BaseConversation.d.ts`. Indicador y control accesibles; escuchar al agente continúa, y se conserva End voice test.
- Polling visible tras desconexión, cancelado al cambiar de conversación/cerrar sesión/salir. Callbacks SDK vinculados al intento. Una respuesta tardía no sustituye otra selección ni retrocede un resultado final. Una falla de refresco de historial no oculta el resultado ya recuperado.
- Estilos NBC responsive, estados de resultado identificados por texto, soporte de movimiento reducido. Login, API, acceso a Supabase y proveedor existentes se conservan.

Archivos: `src/components/dashboard/Caller.tsx`, `Caller.module.css`, nuevo `src/lib/caller-insights.ts`, nuevo `tests/caller-insights.test.ts`, nuevo `tests/caller-workspace.spec.ts`, este documento. Sin cambios en servicios, rutas, configuración, dependencias, tablas ni agente remoto.

## Evidencia y límites

Ejecutado `node --experimental-strip-types --test tests/caller-insights.test.ts tests/caller-validation.test.ts`: siete pruebas pasan. Cuatro nuevas verifican alcance/ausencias, filtros, exportación final y protección frente a resultados atrasados. Tres existentes validan autorizaciones y normalización del proveedor.

E2E agregado para `/caller`: Auth/API interceptados con fixtures explícitos del test, filtro con métricas estables, descarga TXT, bloqueo de descarga provisional, móvil y limpieza al salir. A ejecutar por orquestador junto con build/E2E compartidos; no equivale a integración externa real.

No se lanzaron conversaciones nuevas ni gastos. Mute implementado contra SDK real, sin ensayo de voz pagado en este lane; incluirlo en la próxima evaluación humana. No hay nueva telefonía, calendario, CRM ni voz/metodología de Anas. La paginación de historial completo continúa pendiente: la API vigente solo devuelve treinta sesiones.

## Integración que debe hacer el orquestador

Montar `/caller`, ejecutar build/TypeScript y E2E completos, actualizar overview/arquitectura/feature Caller/lookup/CHANGELOG con esta entrega. El nuevo E2E usa `page.goto('/caller')`; no modificar `tests/caller.spec.ts` desde este lane. API y DB_SCHEMA no requieren cambios de contrato. Mantener separados resultados reales del Caller y fixtures de `/demo`.

## Cierre del orquestador

Integrado y liberado. Build/TypeScript, 27 unitarias y 10 E2E pasan en conjunto. Navegación por URL y móvil verificadas; Caller recuperó datos reales del operador sin iniciar otra conversación. El orquestador ajustó nombres accesibles/selectores de tests y alineó el padding Lead Engine con el shell. Leer `START-HERE.md` para abrir el próximo lane. Las pruebas E2E interceptadas no se presentan como ejecución de proveedores reales.

## C01 — revisión 1: continuidad e historial (2026-09-14)

Candidato local implementado, pendiente de revisión del orquestador y de Franco. El alcance histórico de treinta filas se reemplaza por páginas de hasta treinta, con cursor `(created_at,id)` descendente que conserva precisión Postgres. GET mantiene `sessions/configured` y agrega `nextCursor`.

Nuevo POST `/api/caller/sessions/reconcile` autenticado, JSON `{cursor?,limit?}` (máximo cinco). Un lote al entrar después de login y acciones `Recover pending` / `Recover next batch`. Lectura exclusiva de conversaciones guardadas; sin nuevas autorizaciones ni worker. Errores por sesión no abortan el lote, cursor permite continuar y se puede reiniciar desde recientes. Sync preserva finales/texto con escritura condicional y maneja 404 temporal, reservas sin conversación y expiración recuperable.

UI: `Load more`, deduplicación por ID, protección de selección, bloqueo inmediato de doble clic, estado de lote parcial. Métricas de las últimas treinta filas cargadas; búsqueda/estado abarcan todas las cargadas. Refrescar vuelve a la primera página. Exportación verificada y controles voz/mute conservados; no se inició una llamada para verificarlos.

Evidencia propia: 15 pruebas Node, TypeScript, build webpack en staging aislado, 2 E2E Chrome y tres rechazos HTTP anónimos aprobados. Fixtures de 65 sesiones separados de NBC; no se escribieron en Supabase. Capturas 1440 px y 390 px sin desbordamiento en `artifacts/lanes/C01/`. Hubo una aserción antigua de identidad de objeto y un selector E2E ambiguo corregidos; primer intento de navegador interrumpido por puerto ocupado. Detalle y comandos en `reports/C01.md`.

No se modificaron auth común, esquema, migraciones, proveedor, shell, entorno ni dependencias. Sin integración remota autenticada en esta revisión; audio humano/mute siguen pendientes de ensayo autorizado. No se atribuyen los resultados remotos del baseline a C01.

Orquestador: revisar el manifiesto SHA256 de C01, integrar los deltas exactos de API/DB_SCHEMA/arquitectura/lookup/seguridad/CHANGELOG del reporte y repetir checks integrados que correspondan. No aplicar SQL: no hay migración C01. No iniciar otra tarea desde este lane. Próxima sugerida: validar recuperación de una sesión de prueba ya existente en entorno integrado, sin crear voz nueva.

Push: **NO EJECUTADO**. Deploy: **NO EJECUTADO**. La aprobación explícita de Franco del candidato concreto sigue siendo obligatoria según REVIEW-PROTOCOL.md.


## Publicación C01 — reporte revisión 2

Franco pidió revisar el trabajo en Vercel y autorizó publicar el candidato previamente entregado. Baseline I01 + runtime C01-R1, 59 archivos congelados, publicados en preview `dpl_FPv9BGxD1u8eukenxRV3YSLXp1iW`. URL: https://nbc-sales-76hzqvi1w-nbc-sales.vercel.app/caller; alias actual https://nbc-sales-nbc-sales.vercel.app/caller. Código R1 intacto, sin tomar cambios de otros lanes, migraciones ni nuevas variables.

Build aislado Node24 y cloud READY; Chrome autenticado real comprobó login, recuperación automática vacía (cero pendientes disponibles), paginación real de una fila por página, cursor inválido 400, móvil sin overflow y logout. Anónimos reciben 401/no-store. Cero inicios de voz y cero capturas privadas. Password/usuario existentes funcionan, disponibles solo en configuración privada local; no se cambió auth ni se crearon cuentas.

Evidencia y snapshot en `artifacts/lanes/C01/vercel/`; reporte R2 contiene incidentes reales y deltas globales pendientes. Orquestador debe consolidar documentación y revisar integración. Publicación preview autorizada/ejecutada; aceptación funcional de Franco pendiente. Push/producción: NO EJECUTADOS.

## Handoff C02 — ampliación directa de Franco, 2026-09-14

Candidato C02-R1: acceso de Caller unido al login general I02-R3; Home y workspace premium; CRM CSV/pipeline, Analytics, Insights con extractos, Dialer con conexión pendiente, Voices admin (listar/seleccionar/diseñar originales con idempotencia) y aviso antes de autorizar voz. Ver diseño/contratos en `docs/features/caller-sales-workspace.md`; reporte verificable `docs/lanes/reports/C02.md`. No iniciar otra tarea.

Base preservada: snapshot I02-R3 login SHA256 `50cc7866c0c81f6ce3763021b9bfd95c4c17e709da254ee223bdc5db4759897d`. Runtime C02: 89 archivos, 23 deltas; manifiesto `artifacts/lanes/C02/runtime-manifest.json`; SHA256 de JSON normalizado `c466055ccf3333ebe76f786612dd79cdeb3bbfa2b5c25242720ea53df1466f57`. No Git/push/merge. Preview por pedido explícito vigente de Franco de revisar en Vercel: `https://nbc-sales-pacjaq1ny-nbc-sales.vercel.app/caller`, deployment `dpl_BecuS5fn1M5xQ6nshkJvTbiUqwSZ`. Revisiones técnica formal y visual de C02 siguen separadas/pendientes.

La migración CRM `040` se aplicó como tablas propias para el recorrido autorizado; estado/evidencia real y limpieza de fixtures se registran en C02. Las escrituras del proveedor de voces solo se probaron con transporte fixture: no se generaron voces, previews o llamadas reales. Audio permanece desactivado, comprobado por lectura del agente. Telefonía WebRTC/PSTN y campaña AI necesitan proveedor/número/flujo; no hay control que afirme llamadas existentes. Gestión de voces afecta al agente compartido y solo está disponible para admin en backend.

Consolidación global pendiente del orquestador: copiar del reporte los contratos leads/voices, guard común de Caller, esquema/RLS/RPC 040, guard del aviso, archivos nuevos, deltas CHANGELOG/API_DOCS/DB_SCHEMA/arquitectura/lookup y publicación preview. No se modificaron esos docs globales desde Caller. C01 conserva las pruebas de continuidad, paginación y export; C02 registra regresiones nuevas, no se atribuye evidencia histórica.


## C03-R1 — handoff (2026-09-15)

Solicitud de Franco ampliada: controles mockdata admin, analytics premium, listas/selección→AI Caller, grabador y copia de voz propia. Feature previa y final `docs/features/caller-operations.md`; reporte `docs/lanes/reports/C03.md`; candidato124 archivos/27 deltas propios en `artifacts/lanes/C03/runtime-changes.json` y archivo congelado `nbc-sales-I02-R4-plus-C03-R1.tar.gz`.

Real: RPC demo por owner/modo con alta/baja idempotente, listas privadas persistidas con miembros owner/FKs; checkbox individual/todos, enviar a cola, filtros/gráficos7/14/30d. Grabación local de micrófono con guía, permisos, preview/descarga/limpieza. Clonación multipart admin, consentimiento de voz propia, hash+referencia idempotente, control de capacidades/verificación; no audio en DB.

Demo:32 leads/24 transcripciones ilustrativas, secuencia Calling/Completed sin llamadas ni cambios reales. No export verificado, sync/reconcile ni cuenta para20starts/24h. En Live todavía falta telefonía/workflow outbound. Record call ofrece nota de micrófono y explica límite, no finge capturar llamada externa.

SQL050 aplicado y probado; globales DB_SCHEMA/API_DOCS/arquitectura/lookup/CHANGELOG pendientes de consolidar exclusivamente por orquestador, deltas exactos en reporte. Build/TypeScript,32 unitarias,17 checks SQL,3 E2E C01 y UI desktop/mobile con audio sintético pasan; evidencia cloud/cuentas temporales/cleanup en `live-verification.json`. No voz pagada para pruebas ni nueva campaña.

Créditos: Franco indicó tenerlos; diagnóstico read-only15/09 de esta API aún Free/clonaciónfalse. La UI Refresh voices revalida. No compras/plan cambiados; creación real requiere capacidad habilitada+muestra suya. No se pudo reconstruir fallo histórico porque jobs estaban vacíos. Validación de clon humano pendiente.

Publicación preview autorizada por pedido directo de revisar en Vercel; no equivale a revisión técnica/funcional ni push aprobado. Candidato `dpl_5jNRuzybdqUpxkFRyXXTyMeND7po`, manifiesto canónico `e846e05ec96324d430cd0ed8eedcf8a29cfc7164594aac835981b375df74862d`. No tocar shell/integración/dependencias. Próxima tarea sugerida: una llamada telefónica controlada con lead y grabación enlazados; no iniciada.

## C04-R1 — handoff (2026-09-15)

Ampliación directa de Franco: CRM sobrio con ficha lateral dentro del tab, notas aditivas con usuario/hora del servidor, resultados manuales de llamada y buckets privados personalizables. Feature previa/final `docs/features/caller-crm-workbench.md`; reporte `docs/lanes/reports/C04.md`. Actividad paginada30 por fecha+UUID; registros manuales no afirman llamadas ejecutadas.

Pipeline por owner UUID/modo,1–20 buckets, orden/nombre/color/categoría y default de importación. Versión CAS, request UUID idempotente y reasignación atómica obligatoria al borrar etapa. SQL060 agrega4 tablas/4 campos de leads, FK owner/modo, RLS cerrado y RPC service_role. DNC independiente preservado al modificar pipeline. Legacy notes conserva contexto sin inventar autor/fecha. Demo cleanup elimina actividad y conserva preferencias.

Candidato136 archivos/18 deltas propios; snapshot sobre I03-R1 detectado durante integración, preserva sus cinco archivos de Resumen. Manifiesto canónico `1b4b077fc721241c23a779b3b051cba55cdf22c4408a7c2af935bb6cad54fd97`, deployment `dpl_BSC8agEsjBX8fw9iGwTk97xbwHh7`. Archivo congelado `artifacts/lanes/C04/nbc-sales-I03-R1-plus-C04-R1.tar.gz`; hashes/deltas en esa carpeta.

Build/TS,39 unitarias,11 grupos SQL aislado,10 checks UI C04,6 grupos regresión C03 y3 E2E C01 aprobados. Verificación Supabase real11 grupos,38 actividades en2 páginas con fechas iguales; auth real y CAS concurrente; navegador Vercel desktop/mobile, notas persistidas y capturas públicas DEMO. Limpieza de3 cuentas temporales confirmada. Ninguna llamada/mutación de proveedor para probar. Callbacks de respuestas Demo tardías no repueblan Live.

Globales DB_SCHEMA/API_DOCS/arquitectura/lookup/CHANGELOG no editados; consolidar deltas exactos del reporte. Resumen sigue categorías canónicas; Caller Analytics refleja buckets. Topes CRM1.000/selección500/listas100 conservados y visibles. Revisión técnica del orquestador y aceptación de Franco pendientes por separado; preview autorizado para revisión, push/producción no ejecutados. Próxima tarea sugerida: paginar CRM completo; no iniciada.

## C05-R1 — handoff (2026-09-15)

Pedido directo de Franco: curvas/neón/animación, más gráficos, widgets personalizados con drag-and-drop/resize, CRM con movimiento y personalidad. Feature previa/final `docs/features/caller-personal-dashboard.md`; reporte `docs/lanes/reports/C05.md`.12 widgets,10 por defecto, config privada owner/modo persistida; guardado explícito y CAS. Curvas endpoint-bounded, reduced-motion, promedio desconocido —, filtros sobre cargados.

CallerBoard mueve leads entre buckets con PATCH details C04 y guarda orden visual con nuevo PUT views/crm; orden de columnas vía PUT pipeline C04. Do not call/notas conservados y etapa con actividad autor/fecha; orden es preferencia. Si etapa termina y orden falla, informar parcial y reintentar. Pointer Events para mouse/touch, preview flotante, Escape, alternativas teclado. Ficha lateral/listas/import/voz continúan.

SQL070 añade caller_views/RPC caller_save_view, RLS cerrado/grants service_role y owner UUID del guard, límites de config y versiones; no nuevas dependencias/env. API views analytics/crm GET/PUT, auth activa/Demo admin, errores saneados. Consolidación de DB_SCHEMA/API_DOCS/arquitectura/lookup/CHANGELOG pendiente del orquestador; deltas exactos en reporte.

Candidato189 runtime/11 deltas Caller sobre K01-R5, conserva I04/Overview y otras entregas concurrentes. Manifest `67b20a1eab8b6810577a4acc417c36c0905d585724069ac7985677a9ace4d981`; deployment `dpl_Ayz6LH4wxxNNMWNuNvuVcJsfdQH8`; archivo congelado y evidencia en `artifacts/lanes/C05/`.45 unitarias,5 SQL,8 browser C05,10 C04,6 C03 y3 C01 aprobados; 12 grupos Supabase/preview real aprobados,3 cuentas temporales eliminadas; evidencia en live-verification.json. Preview autorizado para revisar, sin push/producción. Aceptación de Franco y revisión técnica pendientes. Sugerido: reutilizar editor en Overview tras revisión, no iniciado.

## C06-R2 — handoff (2026-09-15)

Pedido de Franco sobre C05: consola visible primero/ocultable y reactiva a audio, NBC sin turquesa, galería más amplia y drag/resize directo, reparar CRM, diagnosticar clonación y activación. Feature previa/final `docs/features/caller-fluid-workspace.md`, reporte `docs/lanes/reports/C06.md`.

AI Caller conserva micrófono apagado hasta Start explícito; getInputVolume/getOutputVolume anima azul/amarillo, hide mantiene banner para End. Historial C01 siempre disponible. Analytics18widgets/10defaults, previews sobre datos cargados, tamaños3/6/12, inserción en vivo al arrastrar, resize en píxeles/snap al soltar, Escape/teclado/Save por cuenta/modo. CRM antes/después, eje horizontal de columnas, captura pointer/autoscroll; notas/DNC/CAS intactos. Nuevos caller-drag, CallerCanvas/Motion/VoicePresence/VoiceStudio CSS; no dependencias ni SQL.

Voces capabilities amplía diagnóstico/cupos/fecha y permite Voice Design en Free; IVC según flag real. Clone conserva ownVoiceConsent y añade voicePermission=authorized+voiceOwnerName+voiceOwnerConsent, permiso admin explícito registrado en description/hash/requestId. Consulta de job confirmado funciona aunque cupo posterior se agote. No audio de Anas aportado ni clon realizado. Preview16:28UTC: Free, diseño=true, IVC=false,3cupos. API local read-only0 números,record_voice=false; no afirmar misma clave/cuenta remota. Cola telefónica real y captura de ambos extremos del dialer siguen pendientes; Demo continúa explícita.

Candidato203runtime/17deltas sobre K01-R6 publicado (incluyeI05/L01-R5);186 archivos ajenos idénticos. Snapshot `artifacts/lanes/C06/nbc-sales-K01-R6-plus-C06-R2.tar.gz`, SHA25648c5390dc0bf6d012fbeba4da7577fca34ab8d09f5a655886b7d514b380299aa; manifest `e82fe5a7afc4e361becc85fde8320696179fdb753034141046289a729a60dcfd`, deployment `dpl_54DpwEfF8cNcbHJi4HmieufQESio`. URL https://nbc-sales-cdrvvy0sa-nbc-sales.vercel.app/caller; alias NBC habitual verificado. R1 histórico en initial-publication; R2 corrige contraste de clonación/ghost dark detectado en PNG.

Build/TS52unit/12C06browser/10C04/6C03/3C01 y14grupos realSupabase+HTTPS pasan, desktop/móvil/claro/oscuro.3 cuentas finales limpiadas;9 entre todos los intentos/R1/R2. Primera limpieza falló por nuevo trigger de wallets; se verificó saldo/reserva0 y0movimientos/pagos/uso antes de limpiar exclusivamente fixtures y repetir. Sin llamadas/creaciones de voz para pruebas. Audio humano/teléfono físico pendiente.

Cambios concurrentes fuera de snapshot preservados sin integrar automáticamente. En particular caller.service.ts añade créditos en source compartido; sus fixtures C01 deben adaptarse en el paquete responsable. Globales no editados: consolidar campos API capabilities/clone, catálogo18, description de permiso y lookup desde reporte. Orquestador review PENDIENTE, Franco aceptaciónR2 PENDIENTE; preview autorizada para revisar, push/producción NO EJECUTADOS. Próxima sugerida: piloto telefónico a número propio con lead/resultado y consumo controlado; no comenzado.

## C07-R1 — 2026-09-15

Feature documentada antes del código: `docs/features/caller-chart-hover-voice-capture.md`.11 archivos runtime propios,224 en snapshot integrado; manifiesto SHA256 `ec0b110caa23cdefe97caddd1b698a4739c02a2256266269cc3506c6880bdd69`. Sin SQL/API/env nuevos. Se conserva registro de uso I06; fixture de rutas reconoce su RPC sin sustituir autorización.

Tooltips del catálogo Caller con fecha/categoría/valor/proporción; amarillo en duración/acumulado/selección/controles. Recorder conserva muestra frente a archivo inválido o recheck, mide duración y obtiene onda del audio local. Nombre precargado realmente y checklist explican bloqueo. Guion original1–2min; no promete calibración. No carga automática. Una cuenta sin IVC puede preparar/guardar muestra, no crearla.

55 unitarias y build aislado aprobados;6 grupos C07 navegador y regresiones6 C03/10 C04/3 C01. Ver reporte para resultado HTTPS y limpieza de cuentas temporales. WAV/Chrome fake microphone explícitamente sintéticos; no consumo de voz/clon. Cambio de base detectado antes de publicar evitó sobrescribir otros lanes. Estado externo/aceptación pendientes no sustituidos por mocks.

Próxima tarea sugerida: resolver cuenta/workspace con IVC y piloto de voz propia autorizado; no iniciado.

Cierre C07:4 grupos HTTPS reales aprobados (auth admin/no admin/anónimo y UI desktop/móvil),2 cuentas temporales eliminadas,0 requests de voz/clon. Cuenta remota también Free/IVCfalse. Snapshot/alias verificados;265 archivos runtime/assets sin secretos. Evidencia en `artifacts/lanes/C07/live-verification.json` y `final-check.json`.
