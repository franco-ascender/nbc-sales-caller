# C03 — listas, AI Caller, demo administrable, analytics y grabación

2026-09-14. Diseño previo a código. Pedido directo de Franco: agregar/quitar mockdata admin durante desarrollo; más gráficos premium; renombrar Voice lab a AI Caller y poder enviar listas/selecciones de leads desde CRM a una cola con progreso y resultados; botón de grabación en dialer; diagnosticar diseño de voz fallido y grabar muestras para una copia de la propia voz.

## Flujo y límites

Conservar C02, login I02 compartido, propiedad UUID y pruebas de voz de navegador. Nuevos cambios se revisan en preview Vercel bajo la instrucción vigente de Franco; no push/producción. No crear llamadas pagadas, generaciones ni clones de prueba. Leer estado real antes de diagnosticar fallo.

Mockdata: acción admin real en backend, datos propios marcados `is_demo`, idempotencia y borrado solo de esa marca/UUID; jamás borrar leads/imports reales. Vista Demo separada de Live (filtros API por defecto excluyen demo). Datos y transcripciones sintéticas claramente etiquetados. Cargar/quitar desde Caller en dos botones, bloquear durante voz activa. Simulación de cola únicamente en modo demo, no endpoint de llamada real.

Listas: tablas caller_lead_lists y caller_lead_list_items, propietario verificado, membresía lead/lista del mismo UUID/modo. Crear lista nombrada desde selección (individual/todos los filtrados), seleccionar lista en CRM/AI Caller, enviar selección directamente al AI Caller. Guardado transaccional/idempotente por UUID de lista. Recuperar selección desde lista; limitar500 leads. DNC/lost/won no se llaman automáticamente. Ediciones manuales mantienen estados; listas no realizan campañas por sí mismas.

AI Caller: tab renombrado; vista principal guía Load from CRM / Choose saved list / Upload CSV (abre CRM import). Tabla de cola con selección, estado y detalle. Turn on AI Caller disponible como intención de modo real pero bloqueado explícitamente hasta conectar telefonía; estado pendiente con pasos de conexión, jamás simular llamadas reales. En demo, Run demo sequence anima calling → completed con transcripciones sintéticas enlazadas. Stop detiene simulación, no timers activos al desmontar; runId/refs evitan respuestas viejas. Browser voice test queda dentro de sección secundaria "Test your AI agent", con inicio/fin/mute/historial/export originales.

Analytics: gráficos SVG accesibles de actividad por día, distribución de etapas y resultados; período7/14/30d, fuente web/phone, denominadores, ceros honestos y distinción Demo. No revenue inventado ni tasas de venta derivadas de prácticas web. Detalles/leyendas y adaptación móvil.

Grabación: grabador MediaRecorder común con permiso explícito, indicador/tiempo, límite120s/3MB, stop/cancel, limpiar tracks/objectURLs al salir, errores seguros y descarga local. Dialer no tiene fuente de audio de llamadas PSTN externas; Record call explica que grabación bilateral requiere conexión, ofrece registrar una nota de micrófono con etiqueta explícita (no grabación de llamada verificada). No afirmar capturar otra app ni subir notas de audio automáticamente.

Voz propia: admin graba o adjunta una muestra propia de audio, escucha y confirma que es su voz/autoriza clonación y uso del servicio. Guía1–2min, silencio, un hablante, volumen constante. POST multipart privado a ElevenLabs IVC `v1/voices/add`; no referencia a persona ajena ni clonación sin declaración. Payload≤3MiB+64KiB para límite serverless; sin guardar audio en DB/logs. Idempotencia persistente con tipo/hash audio y nombres; intento ambiguo no se repite. Guardar estado needsVerification y no permitir activar voz sin completar verificación cuando proveedor la requiera. Errores mapeados a razones permitidas (plan, permisos, cupo, archivo inválido), sin payload del proveedor. Diagnóstico read-only de jobs/plan/permisos; si causa histórica no está registrada, declarar desconocida y mejorar observabilidad segura, no regenerar para probar.

## Archivos / contratos

Caller.tsx/CSS, CallerSalesPanels/CSS, CallerVoices; nuevos componentes propios CallerLists, CallerAnalytics, CallerAudioRecorder/Clone; lib caller-*; servicios Caller; /api/caller/demo, lists, voices/clone; extensión compatible sessions/leads `demo=true` solo admin y campo opcional is_demo. Migración nueva050, nunca editar040 aplicada: is_demo en leads/sessions, tablas listas, RPCs guardarlista/demo y ampliación job de voz (tipo/hash/verificación/failed/failure_code). RLS cerrado a anon/authenticated, funciones execute service_role. No editar integration.service ni módulos ajenos. Fuente base snapshot publicado más reciente contrastado con manifests.

## Pruebas y aceptación

Auth real de ruta para admin/estudiante/anónimo; demo cleanup no toca reales/otros; listas de otro usuario y mezcla live/demo rechazadas; IDs/cantidades; simulación sin creación de voz; gráficos períodos; grabador stop/cancel/permiso; clonación multipart límites/tipos/consentimiento/retry/verificación y errores permitidos; C01 paginación/exports/terminales y C02 CRM regresiones. SQL aislado, build/Chrome puerto propio, live fixtures temporales con cleanup; no gasto de voz para evidencia. Reporte docs/lanes/reports/C03.md, artifacts/lanes/C03, feature/handoff/changelog/deltas globales.


## Entrega C03-R1 — 2026-09-15

Implementada y publicada como preview revisable `dpl_5jNRuzybdqUpxkFRyXXTyMeND7po`: https://nbc-sales-m22wq95f1-nbc-sales.vercel.app/caller. Se preservó I02-R4/C02/K01 desde snapshot. SQL050 aplicado HTTP201, hash `7e426a2960703ae02195462050f12ac2cc94766a545871d9e122069bcaf72fec`. Candidato124 archivos/27 deltas, detalles y evidencias en [reporte C03](../lanes/reports/C03.md).

Botones reales Add/Remove mock data y Live/Demo admin,32 leads/24 transcripciones sintéticas; colisiones de número preservan existente. Listas guardadas hasta500 IDs, últimas100 listas, validación owner/modo y FK compuestas. Cola demo con bloqueo y cancelación, acceso al detalle; llamada real no habilitada. Browser test/historial pasan a sección secundaria, conservan controles. Analytics cuatro visualizaciones y alcance visible. Grabador de micrófono local real con guía/permisos/stop/preview/descarga; nota de micrófono no es grabación bilateral.

Clonación propia multipart implementada con confirmación, hash/idempotencia y estados finales/fallos; muestra no persiste en DB. Reintentos guardan referencia en sesión del navegador; si se vuelve, debe cargarse el mismo archivo. Verificación del proveedor pendiente bloquea selección. Refresh voices reconsulta capacidades del plan. Diagnóstico real15/09: API conectada aún reporta Free/clonaciónfalse después de que Franco indicó tener créditos; no se afirma que su compra no exista, sólo lo observado en esta conexión. No hubo jobs históricos para explicar su error anterior.

Verificado build/TypeScript,32 unitarias,17 checks SQL050 aislados,3 E2E C01 y recorrido C03 Chrome desktop/mobile con audio sintético. Verificación Vercel/Supabase y cleanup registrados en reporte/evidencia. Regresión detectó fixtures desactualizados y se corrigió; controles de historial/carreras/export se reejecutaron. Demo nunca exporta como provider-verified ni participa en sync/reconcile/límite de inicios.

Revisión técnica del orquestador y aceptación de Franco pendientes. Preview autorizado por su solicitud de revisar todo allí; push/producción no ejecutados. Validación humana de clon/micrófono, telefonía real y grabación bilateral siguen pendientes. No se consumió voz para probar.
