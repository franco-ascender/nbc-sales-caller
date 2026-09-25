> C05-R1 conserva el recorrido de voz/historial:45 unitarias Caller y3 E2E C01 ejecutadas de nuevo sobre build integrado; sin llamadas de prueba. Analytics/CRM personalizado y límites en [reporte C05](../lanes/reports/C05.md).

> Continuidad vigente15/09: C04-R1 conserva voz, historial C01, export verificado y recuperación. Nuevas regresiones sobre snapshot integrado I03 aprobadas (3 E2E C01 +39 unitarias Caller); no nueva llamada de prueba. CRM lateral/notas/pipeline documentados en [caller-crm-workbench.md](caller-crm-workbench.md) y [reporte C04](../lanes/reports/C04.md). Las secciones inferiores son historia de sus respectivos hitos.

# Caller: primeras conversaciones reales

Fecha: 2026-09-14. Estado vigente: C01-R1 implementado y verificado localmente, pendiente de revisión/integración; ver sección C01 y reporte `docs/lanes/reports/C01.md`. Las secciones del primer hito conservan evidencia histórica de voz en navegador y no acreditan validación remota nueva de C01.

## Primer hito

Operador autenticado abre Caller, inicia y termina una conversación de voz controlada, y consulta el historial persistente, duración, transcripción y resumen obtenidos del proveedor. Mantener las vistas de presentación como demo y mostrar sesiones reales exclusivamente en el workspace autenticado. La primera conversación no confirma citas ni dispara contactos comerciales; faltan subcuenta/calendario y metodología final.

Se consulta al usuario si prefiere ElevenLabs Agents (clave existente, prueba de navegador y telefonía posterior) o Retell. No hay credenciales GHL/Retell/Twilio configuradas. La base compartida de sesiones y autorización no depende de esa elección. No adquirir números ni llamar a terceros sin destino de prueba indicado.

## Diseño compartido

- `call_sessions`: propietario Supabase Auth, proveedor/agente, identificador de conversación, canal, estado, timestamps, duración, transcripción y resumen. Sin fixtures entre datos reales.
- RLS y revocación de acceso directo; servidor filtra siempre por operador validado. No admitir identificadores de otras cuentas.
- Token del proveedor en servidor; el navegador recibe únicamente autorización temporal para su conversación.
- Inicio explícito del operador, límite de duración de prueba y controles ante doble clic. No reintentar automáticamente una creación ambigua que pueda generar otra llamada.
- Resultado consultado desde el proveedor; el navegador no puede declarar reservas, duración ni transcripción definitiva. Si el proveedor sigue procesando, mostrarlo y permitir sincronización posterior.
- Estados vacíos y errores accionables para agente, permisos, créditos, micrófono o configuración pendientes.

## Validación prevista

Autorización anónima/inválida, separación de sesiones, idempotencia del inicio, finalización, consulta del proveedor y persistencia. Build/TypeScript y pruebas del flujo de navegador. Separar pruebas sintéticas de una conversación real; no afirmar calidad de voz sin evaluación humana.

## Implementación y resultados

ElevenLabs implementado como opción provisional comunicada durante el trabajo. Agente privado creado a partir de `config/nbc-test-agent.json` con voz estándar Roger, gpt-4.1-mini gestionado por ElevenLabs, inglés, 300 segundos, una conversación simultánea, veinte diarias, sin herramientas ni grabación de audio. No consume las claves directas OpenAI/Anthropic. La tabla `call_sessions` fue aplicada a Supabase; `ELEVENLABS_AGENT_ID` guardado en configuración local privada.

API reserva UUID único y obtiene una URL firmada de un uso con conversation ID fijo antes de abrir el SDK. Inicio duplicado o simultáneo rechazado. El resultado se lee desde el proveedor, validando identidad, se normaliza y se persiste. UI consulta automáticamente tras desconexión y permite refrescar después; no hay worker/webhook autónomo. Estados terminales protegidos de respuestas tardías. Desconectar sesión limpia el token en memoria y evita que respuestas anteriores repueblen el workspace.

Verificación externa: primera conexión recibió saludo/texto/audio y guardó resultado (2 segundos). Segunda conversación usó frase sintética de una agencia con veinte leads semanales: ASR registró el mensaje y el agente respondió con voz; 27 segundos, tres turnos y resumen guardados. Ambas finalizadas. Repetir un UUID devuelve 409 y consultar sesión inexistente devuelve 404; validaciones unitarias rechazan identidad de otro agente/conversación. No se midió latencia real percibida ni se evaluó calidad humana. Capturas en `artifacts/caller/`.

Pendientes comerciales: voz/metodología de Anas, GHL, agenda, telefonía, multiempresa, retención automática de texto en Supabase y sincronización en segundo plano. El dashboard demo conserva sus fixtures sin mezclar los tests reales.

Validación final: acceso directo anon/authenticated rechazado en call_sessions, servicio permitido, RLS e índice único de sesión activa comprobados. Historial recuperado en nuevo login, móvil sin desbordamiento y salida de sesión limpia verificados. Build/TypeScript, seis unitarias y cinco E2E pasaron.

## Integración en NBC Sales

Ruta `/caller` independiente dentro del master dashboard. Agregado `caller-insights.ts`: métricas de últimas treinta sesiones, búsqueda y filtro de historial, exportación TXT de transcripción final verificada. Control mute mediante SDK real y selección/polling protegidos ante respuestas tardías. Handoff en `../lanes/caller.md`. El ensayo de mute con micrófono humano queda pendiente; no se iniciaron nuevas sesiones pagadas en esta entrega.

## C01 — diseño previo al código (2026-09-14)

Estado: en implementación local; los resultados históricos anteriores no validan C01.

Objetivo: recuperar resultados al volver a `/caller` después de autenticarse y recorrer más de treinta sesiones. El flujo actual reserva una autorización fija, abre voz solo por acción explícita, consulta `/sync` al desconectar y lista treinta filas; cerrar la página corta el polling. Se conserva inicio/fin, mute, exportación verificada, login en memoria, adaptador e identidad de agente/conversación.

Flujo ampliado:
1. Login carga la primera página y dispara **un** lote de recuperación. `Recover pending` permite repetir; `Recover next batch` recorre pendientes más antiguos. No hay worker, cron, nueva conversación ni bucle de lotes automático.
2. GET `/api/caller/sessions?limit=30&cursor=…` conserva `sessions` y `configured`; agrega `nextCursor: string|null`. Límite entero 1–30. Cursor base64url versionado de `created_at` UTC (precisión de Postgres conservada) + UUID v4, validado en servidor. Orden descendente por fecha e ID y frontera estricta; todas las consultas filtran el UUID autenticado. Nuevas sesiones aparecen al refrescar la primera página; no desplazan páginas sucesivas.
3. POST `/api/caller/sessions/reconcile`, JSON `{cursor?: string, limit?: number}` (1–5, default 5), devuelve `{results: [{sessionId, outcome, session?, error?}], nextCursor}`. Selecciona pendientes/expiradas propios en el mismo orden estable, lee cada conversación guardada en paralelo acotado y devuelve fallos individuales saneados. Un cursor permite seguir aunque algunas filas sigan pendientes. Un nuevo recorrido se inicia sin cursor. Nunca acepta IDs de proveedor, resultados del cliente ni propietario.
4. 404 del proveedor antes de diez minutos mantiene pendiente; pasado ese plazo expira la reserva. Sin conversation ID también expira tras diez minutos. Expirado puede recuperar un resultado final pero no vuelve a activo/procesando. Completado/fallido son inmutables. Guardado condicional por estado y última sincronización evita sobrescrituras concurrentes; texto verificado existente no se borra por payloads vacíos/parciales. Fallos de lectura/persistencia permiten reintentar.
5. `Load more` concatena por ID; `Refresh history` vuelve a la página más reciente. Métricas: últimas treinta sesiones cargadas más recientes, sin efecto de filtros; búsqueda y estado: **todas las filas cargadas**, no toda la cuenta. La UI explica ambos alcances, páginas restantes y recuperación parcial; protege dobles clics, selección y respuestas fuera de orden.

Archivos: Caller.tsx/CSS; caller-types, caller-validation, caller-insights y nuevo caller-pagination; caller.service; rutas Caller GET y reconcile; tests caller-*; feature/handoff/reporte/evidencia C01. Sin cambios de esquema, dependencias, auth común, entorno, shell ni configuración del proveedor. El índice actual permite el recorrido; un índice compuesto adicional será solo propuesta de optimización al orquestador si se justifica con volumen real.

Criterios: pruebas con rutas y autorización reales (solo transporte externo simulado), anónimo/operador incorrecto/UUID ajeno; cursores inválidos, empate de fecha, precisión submilisegundo, páginas con inserción nueva; lote parcial de cinco, expiración, protección de texto/finales y cero creación de voz; regresiones de métricas, filtros y export. Build/navegador únicamente en copia aislada o integración del orquestador. Fixtures identificados, sin escribir datos demo en Supabase. Evaluación humana/audio sigue pendiente. Documentos globales se proponen en reporte y los consolida el orquestador.

### C01 — candidato local, revisión 1

Implementación local completa. `caller-pagination.ts` valida cursores y límites; GET agrega `nextCursor` conservando `sessions/configured`. `/reconcile` devuelve resultados individuales, consulta como máximo cinco conversaciones existentes y permite seguir con cursor aun ante errores. `syncSession` trata 404 temporal, expira reservas sin ID y mantiene estados finales; escritura condicional por estado/`synced_at`, con marca estrictamente creciente, hasta tres intentos ante concurrencia. La fusión preserva transcripciones con más turnos/texto y metadatos ya verificados ante resultados parciales.

Caller aplica un lote al entrar, ofrece reintento y siguiente lote, carga más páginas y mantiene selección ante respuestas tardías. Recuperación modifica solo filas ya cargadas; no incorpora filas aisladas de páginas aún no recorridas. Refrescar historial reinicia el recorrido en la página más reciente. End voice test conserva un bloqueo separado para seguir disponible durante consultas de historial; mute usa el SDK existente.

Validación de esta revisión: 15 pruebas Node pasan, TypeScript sin emisión pasa, build Next webpack en copia aislada pasa y 2 E2E Chrome con fixtures pasan. Prueba HTTP sobre el servidor aislado rechaza anónimos en GET/sync/reconcile con 401/no-store. Datos de 65 sesiones son exclusivamente fixtures locales; autorización, rutas, SDK HTTP de Supabase, adaptador ElevenLabs y lógica de servicio se ejecutan realmente en tests de rutas con transporte simulado. No se ejecutó integración remota autenticada, nueva conversación ni ensayo de audio humano. Capturas desktop/mobile y logs en `artifacts/lanes/C01/`; reporte revisable en `docs/lanes/reports/C01.md`.

Sin migraciones, variables o dependencias nuevas. Documentación global, revisión técnica del orquestador, revisión de Franco y publicación pendientes; no presentar este candidato como desplegado. Las pruebas históricas de esta feature permanecen como antecedentes y no sustituyen la evidencia de C01.

### Publicación solicitada por Franco — 2026-09-14

Instrucción posterior: «empeza a poner todo en el Vercel porque ahí es donde estoy revisando todo». Autoriza publicar C01-R1 como preview revisable en el proyecto NBC Sales existente. Se prepara copia congelada del baseline I01 + únicamente runtime C01 ya identificado; se verifica build antes de subir. No se toman archivos mutables de otros lanes ni se aplican migraciones. Revisiones técnicas externas siguen sin recibirse; no se inventa que ocurrieron. No hay git push, promoción a producción, cambios de auth, nuevas conversaciones ni publicación automática.

El login visible es la protección del Caller, no evidencia de un fallo de despliegue. Verificar acceso del operador por HTTPS con configuración privada existente, sin exponer credenciales/capturas privadas. Pregunta sobre disponibilidad de sus credenciales pendiente; no resetear ni eliminar auth por inferencia. Evidencia de la publicación en `artifacts/lanes/C01/vercel/`, resultado por registrar en revisión 2 del reporte. La referencia R1 anterior se conserva en esa carpeta.


Resultado de publicación (reporte revisión 2): baseline I01 + C01-R1 ya publicado y verificado en https://nbc-sales-nbc-sales.vercel.app/caller. Deployment preview `dpl_FPv9BGxD1u8eukenxRV3YSLXp1iW`, fuente congelada de 59 archivos. Build Node24, login real, historial paginado real, cursor inválido, lote automático vacío, anonimato rechazado y móvil/logout pasan. Cero pendientes reales disponibles para ensayo de recuperación de contenido; casos parciales siguen cubiertos con fixtures. Auth intacta, cero voz nueva, sin push/promoción a producción. Aceptación funcional y revisión técnica externa siguen pendientes; la autorización de publicación proviene del mensaje posterior de Franco citado en el reporte R2.

## Extensión C02 (2026-09-14)

Solicitud posterior de Franco: el ingreso de Caller se une al dashboard; el producto pasa a workspace CRM/Analytics/Voice lab/Dialer/Insights/Voices. Diseño previo y contratos completos en `docs/features/caller-sales-workspace.md`; entrega/evidencia en `docs/lanes/reports/C02.md` y `artifacts/lanes/C02/`.

Se conservan cursores fecha+UUID, reconcile acotado, propiedad por UUID, export verificado y estados terminales C01. Cambia el guard de acceso: miembros activos del dashboard pueden usar Caller; admin controla voces. La sesión del contexto raíz se reutiliza y se refresca en memoria. Voice lab permanece montado al cambiar tabs; salir del módulo cierra voz y el resultado pendiente se recupera como en C01. Antes de una autorización nueva se verifica aviso inicial conforme a privacidad real; esa operación no forma parte de reconcile. No hay telefonía/campañas nuevas implícitas en la importación de leads.


## Extensión C03 (2026-09-15)

El tab se denomina AI Caller. CRM incorpora listas/selección; AI Caller presenta cola y acceso secundario a prueba de navegador/historial. C01 conserva cursores, reconcile5, mute/fin y export. Nuevos datasets `is_demo` sólo admin se excluyen del historial real, sync/reconcile, límite de starts y export verificado. Demo se usa para ilustrar cola/transcripciones sin iniciar conversaciones. Diseño/implementación en `caller-operations.md`; reporte `docs/lanes/reports/C03.md`. SQL050 aplicado y preview publicado bajo autorización de Franco para revisar allí. Telefonía/grabación bilateral y clon real evaluado por persona siguen pendientes; no se iniciaron llamadas para evidencia.
