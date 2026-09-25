# Reporte consolidado de la conversación — Caller / NBC Sales

Preparado para Franco y el orquestador el **16 de septiembre de 2026**. Cubre las entregas **C01 a C07** realizadas entre el 14 y el 15 de septiembre, las iteraciones pedidas en este chat y la aclaración final sobre activación del servicio.

Este documento consolida reportes, manifiestos y evidencias existentes. **Hoy no se volvieron a ejecutar pruebas, consultar suscripciones ni desplegar código.** Las comprobaciones remotas que se citan corresponden a sus fechas originales. Los avances de Academy, Calendar, Lead Engine, Members, créditos y Overview de otros lanes se conservaron al integrar; no se atribuyen a este chat.

**Resultado general:** ampliamos el Caller existente hasta un workspace con acceso compartido, CRM privado persistente, importación y listas de leads, notas con autor/fecha, pipelines personalizables, analytics configurable, insights basados en transcripciones y herramientas de voz para admins. Se publicó en Vercel para tu revisión y se iteró el diseño con tus capturas y comentarios. **Todavía no es un servicio de llamadas automáticas a leads:** faltan telefonía y ejecución real de la cola. La clonación está implementada, pero la última cuenta conectada comprobada no la habilitaba.

## 1. Punto de partida

Ya existían pruebas de voz en navegador con ElevenLabs, login de operador, sesiones persistidas, transcripciones, filtros, métricas recientes, exportación TXT y mute. No regeneramos el proyecto ni reconstruimos ese recorrido.

El encargo original C01 era evitar resultados irrecuperables al salir y superar el historial de treinta sesiones. Después ampliaste el alcance: revisar en Vercel, usar el login general del dashboard, transformar Caller en mini CRM, mejorar la estética, personalizar gráficos/pipeline, gestionar voces y facilitar la grabación de una muestra propia.

Se mantuvo Next.js + TypeScript + Supabase, estilos CSS Modules, UI en inglés y comunicación/documentación en español. El trabajo se realizó sin subagentes escritores y sin commits/pushes. Builds y pruebas de navegador usaron copias aisladas, sin reiniciar el servidor compartido.

## 2. Historial de entregas

| Entrega | Tu pedido | Qué se entregó |
|---|---|---|
| **C01 — 14/09** | Recuperar resultados y ver más historial; después, publicar para revisar en Vercel. | Cursor estable fecha+UUID, páginas sucesivas, recuperación por lotes de cinco, protección de transcripciones/estados finales, reintentos y exportación verificada. Preview autenticada comprobada. |
| **C02 — 14/09** | Un solo login, mejor diseño, mini CRM, gráficos, dialer, voces admin y motivos. | Caller adopta identidad NBC integrada por Infra; CSV, etapas/notas persistidas, tabs CRM/Analytics/Voice lab/Dialer/Insights/Voices, catálogo/diseño de voz y aviso inicial acorde al modo de registro. Telefonía explícitamente pendiente. |
| **C03 — 14–15/09** | Agregar/quitar mockdata, renombrar AI Caller, seleccionar listas, cola visible, grabar audio y copiar voz propia. | Herramientas demo solo admin, listas guardadas, selección CRM→AI Caller, cola secuencial DEMO, más gráficos, grabador local y endpoint idempotente de clonación con consentimiento. Diagnóstico del plan conectado. |
| **C04 — 15/09** | Ficha al costado, notas propias con hora/usuario, registrar “no contestó” y embudo personal. | Ficha lateral dentro del tab; actividad aditiva con autor/hora del servidor, resultados manuales y paginación; pipelines de 1–20 etapas por usuario, reasignación segura al eliminar buckets y conservación de Do not call. |
| **C05 — 15/09** | Gráficos animados/curvos, galería, tamaños y drag-and-drop; CRM con personalidad. | Dashboard personal con 12 widgets iniciales, curvas/animaciones, agregar/quitar/mover/redimensionar/guardar; tablero CRM con movimiento de tarjetas y columnas. Preferencias persistidas por usuario y modo. |
| **C06 — 15/09, revisión 2** | Consola de voz primero y ocultable, animación al hablar, colores NBC, drag más fluido, más previews y voces de personas autorizadas. | Consola visible sin abrir micrófono automáticamente; visualización por niveles del SDK; catálogo ampliado a **18 widgets**, previews con datos, tamaños y arrastre directo; mejoras de resize/autoscroll/colocación CRM. Diagnóstico de cuenta y clonación propia o autorizada. |
| **C07 — 15/09** | Hover con información, amarillo NBC, arreglar experiencia de grabación y ofrecer un guion. | Tooltips con fecha/valor/proporción, foco y tap móvil; amarillo en curvas/selección/audio; reproductor propio, onda real, duración/seek, subida/guardado claros, guion inglés y checklist de creación. Nombre precargado realmente y recheck que conserva muestra. |

Tu feedback de mejora visual en C05/C06 orientó las siguientes iteraciones; no se tomó como aprobación automática de cada cambio posterior, del push o de producción.

## 3. Qué quedó implementado

### Acceso, continuidad e historial

Caller usa la misma identidad del dashboard: no tiene un segundo login de operador. La base compartida de autenticación fue integrada por Infra; Caller consume esa identidad y verifica membresía/rol en sus rutas. Datos privados filtrados por UUID del usuario autenticado; controles de voces y mockdata restringidos a admins en servidor.

El historial carga páginas por `(created_at,id)`, con validación de cursor/límite y precisión de timestamps. Empates de fecha y nuevas sesiones no duplican filas entre páginas. La recuperación consulta hasta cinco conversaciones ya vinculadas por agente/conversation ID; maneja procesamiento pendiente, 404 temporal, expiración y fallos individuales. **No crea conversaciones ni funciona como worker permanente.**

Se preservan transcripciones verificadas y estados finales, selección del usuario y protección frente a doble clic/respuestas atrasadas. Export TXT exige resultado guardado/verificado; no exporta texto provisional ni IDs internos del proveedor. Inicio/fin de voz y mute se conservaron.

### CRM de trabajo y listas

- Importación CSV con preview, normalización de teléfono estadounidense, validación por fila y deduplicación. Hasta **500 filas / 512 KiB** por importación; operación transaccional e idempotente.
- Tablero y lista, búsqueda/filtros, selección de hasta **500 leads**, seleccionar todos los filtrados, guardar listas nombradas y enviarlas a AI Caller. Se muestran hasta **1.000 leads recientes** y hasta **100 listas recientes**.
- Ficha lateral dentro del CRM, apilada en móvil: contacto, empresa, origen, etapa, bloqueo y actividad.
- Notas nuevas aditivas con autor autenticado y timestamp del servidor. Las notas antiguas se conservan como contexto sin inventar autor/fecha.
- Registro manual de No answer, Connected, Left voicemail, Busy y Wrong number. Es una anotación del operador; no acredita que NBC haya realizado la llamada.
- Actividad paginada, borradores por lead durante navegación y protección de reintentos/cambios de selección.
- Pipeline propio por miembro y modo Live/Demo: **1–20 etapas**, nombre/color/orden, categoría Active/Won/Lost y etapa inicial. Eliminar un bucket requiere reasignar sus leads; conserva notas/historial.
- Drag-and-drop de tarjetas y columnas, destino visible, arrastre flotante, autoscroll, alternativas de teclado y persistencia. Versiones detectan ediciones concurrentes. **Do not call permanece independiente de la etapa.**

El CRM es privado por operador; no se construyó un CRM organizacional compartido ni una sincronización completa con GHL.

### Analytics personal e insights

Analytics evolucionó desde tarjetas básicas a gráficos sobre fondo navy, curvas suaves, animación de números/trazos, colores NBC y acentos amarillos. Se retiró el turquesa introducido en la primera iteración. Las curvas respetan valores observados; no se añadió ruido para aparentar actividad. Se respeta reduced-motion.

**Customize** ofrece 18 widgets: seis números —leads, conversaciones, completadas, minutos, pendientes y promedio de duración— y doce gráficos —actividad, resultados, pipeline, canales, duración diaria, hora de inicio, fuentes de leads, rangos de duración, acumulado, días de semana, promedio diario y completadas por día—.

Permite agregar/quitar, previsualizar tamaños, arrastrar desde la galería, reordenar, ajustar ancho/alto, guardar/cancelar/restablecer. Preferencias en Supabase por usuario y Live/Demo. Usa una grilla, no posicionamiento libre arbitrario; cada widget aparece una vez. Móvil adapta a una columna y conserva tamaños de escritorio.

C07 agregó hover, foco de teclado y tap con fecha/categoría, cantidad/unidad y porcentaje pertinente. Escape cierra; tooltips acotados al viewport. Las miniaturas de galería no capturan foco de exploración.

**Alcance de métricas:** Analytics calcula sobre sesiones cargadas y período/canal seleccionado, con agrupación por hora/día local. Pipeline/fuentes reflejan leads cargados y no siguen el filtro temporal de conversaciones. Duraciones desconocidas se excluyen de promedios. El resumen del historial conserva sus treinta sesiones recientes cargadas; sus filtros de búsqueda/estado abarcan todas las páginas cargadas. No se inventan ingresos, conversión, citas ni tasas de respuesta.

Insights detecta patrones de frases de participantes en transcripciones finales verificadas: objeciones, cancelaciones y siguientes acciones. Cuenta cada tema una vez por sesión, muestra extractos y permite ir a la transcripción/export. Son sugerencias basadas en reglas con evidencia, **no un clasificador semántico avanzado ni motivos comerciales confirmados**.

### Demo y AI Caller

Los admins pueden agregar/quitar datos ilustrativos en desarrollo, con modo DEMO separado: hasta **32 leads y 24 transcripciones sintéticas** por admin. Alta idempotente; borrado por propietario y marca demo, sin afectar datos reales. La mutación de mockdata está deshabilitada en producción.

Voice lab pasó a **AI Caller**. La consola de prueba y transcripción aparece primero, es ocultable y permite regresar/finalizar. La animación lee niveles de entrada/salida del SDK durante una sesión: azul para micrófono, amarillo para agente. **Visible/lista no significa micrófono o llamada encendidos automáticamente.**

La lista elegida aparece como cola con progreso y acceso a detalle/historial. La secuencia Calling→Completed funciona **solo como simulación DEMO**, excluye Do not call/Won/Lost y tiene Stop. En Live no ejecuta llamadas. El progreso de campaña real no se implementó ni persiste como un trabajo en segundo plano.

### Dialer, voces y grabación guiada

El dialer tiene teclado, selección de lead, contexto/notas y enlace explícito a la app telefónica del dispositivo. **Llamar desde el navegador y capturar ambos extremos de una llamada siguen pendientes.** Record call explica ese límite y permite una nota de micrófono local; no la presenta como grabación bilateral verificada.

Admins pueden consultar catálogo paginado y previews existentes, seleccionar voz para futuros tests del agente y solicitar diseño de una voz original. La selección afecta al agente compartido, no es una preferencia privada por usuario. Escrituras con validación e idempotencia; un resultado incierto no dispara una generación nueva automáticamente.

Se añadió clonación de voz propia y de otra persona que haya autorizado al admin, con identificación/consentimiento explícitos, validación de muestra, hash y referencia de solicitud. Si ElevenLabs exige verificación adicional, se conserva ese bloqueo. No se afirma haber verificado identidad externamente.

El nuevo grabador permite Record/Stop/Record again, Upload audio, Play/Pause, posición de reproducción y Save recording. Máximo **2 minutos / 3 MiB**. Calcula duración y onda a partir de la muestra; conserva audio anterior ante archivo inválido/recheck. Salir detiene micrófono. No sube audio hasta enviar la creación; hay que guardar una copia antes de cerrar la pestaña.

Se agregó un **guion original en inglés de aproximadamente 1–2 minutos**, con saludo, preguntas, horarios/números y cierre. Es guía de grabación limpia/consistente, no garantía de calibración o calidad. Una muestra corta recibe recomendación sin un mínimo artificial que impida enviarla.

Se corrigió además una causa de confusión: el nombre del clon era solamente un placeholder; ahora es un valor real precargado. El checklist indica muestra, nombre, consentimiento y acceso, y Recheck cloning access consulta el plan sin borrar el audio.

### Aviso inicial

Antes de autorizar una prueba se verifica la configuración del agente y su mensaje inicial. Con transcripción y audio desactivado usa “This call is being transcribed for educational purposes.” Si se activa grabación de audio, usa “This call is going to be recorded for educational purposes.” El saludo identifica al asistente de IA y el contexto de prueba interna.

No se activó grabación de audio por inferencia. Escucha humana del aviso y adaptación al futuro recorrido telefónico quedan pendientes del piloto.

## 4. Persistencia, seguridad y contratos

Cuatro migraciones propias fueron probadas de forma aislada, aplicadas y verificadas en Supabase según las evidencias de sus entregas:

| SQL | Incorporación |
|---|---|
| [040 — CRM](../../../supabase/migrations/202609140040_caller_crm.sql) | Leads, importaciones y trabajos de voz; importación transaccional/idempotente. |
| [050 — operaciones](../../../supabase/migrations/202609140050_caller_operations.sql) | Separación demo/live, listas e integrantes, relación sesión/lead y datos de jobs de clonación. |
| [060 — workbench](../../../supabase/migrations/202609150060_caller_workbench.sql) | Pipelines, buckets, actividad y registro de cambios/reintentos; bucket del lead. |
| [070 — vistas](../../../supabase/migrations/202609150070_caller_views.sql) | Configuración personal de Analytics/CRM y guardado con control de versión. |

C01, C06 y C07 no requirieron migraciones nuevas. Se mantuvo RLS y el acceso cerrado de tablas/RPC a clientes directos; las rutas autorizan antes de usar el servicio de servidor. UUID/autor/fecha no se aceptan del cliente como autoridad. Conflictos de versión y reintentos se resuelven sin sobrescribir silenciosamente otras ediciones.

Familias de API: `/api/caller/sessions` y sync/reconcile; leads/importación/details/activity; listas/pipeline; preferencias `/views/analytics` y `/views/crm`; demo; voces/capabilities/clone. Contratos, payloads, errores y hashes completos están en los reportes de cada entrega. No se creó una API de llamadas telefónicas salientes.

No se expusieron secretos en código, capturas, reportes o uploads. Variables existentes de Supabase/ElevenLabs/Vercel se usaron sin publicar valores. No se cambiaron planes, compraron números ni iniciaron campañas. Cambios de créditos/Usage de Infra se conservaron en las bases integradas; no son implementación atribuida a Caller.

## 5. Verificación realizada y sus límites

Las suites crecieron con cada entrega: **15 → 26 → 32 → 39 → 45 → 52 → 55** pruebas unitarias documentadas. Son fotografías de la suite de cada versión; **no se suman como pruebas independientes del candidato final**.

En C07 se ejecutó:

| Verificación | Resultado documentado del 15/09 |
|---|---|
| Build Next/TypeScript aislado | Aprobado; 45 páginas del paquete integrado. |
| Unitarias Caller | **55/55** aprobadas. |
| Navegador C07 | **6 grupos** escritorio/móvil: tooltip, foco/touch/Escape, amarillo, grabación, reproducción, seek, archivos inválidos, recheck, doble submit y temas. |
| Regresiones de C03/C04/C01 | **6 grupos + 10 grupos + 3 E2E** aprobados: listas/demo/CRM/notas/pipeline/continuidad/auth/export. |
| HTTPS + Supabase reales | **4 grupos** aprobados; anónimo401, miembro no admin403, admin200; formulario/gráficos sobre preview real. |
| Limpieza | Dos cuentas temporales C07 y sus fixtures eliminados. |
| Manifiesto/assets | **265 archivos** inspeccionados sin valores privados; fuentes propias coinciden con snapshot; ambas URLs200 al cierre. |

Otras entregas verificaron SQL/RPC/RLS, importación simultánea, aislamiento entre propietarios, reintentos con confirmación perdida, ediciones concurrentes, fechas iguales, páginas sucesivas, estados finales, borrado demo y persistencia de layouts desde navegador. Las pruebas de autorización ejecutan el guard y las rutas reales; el transporte externo se simula en unitarias, no se reemplaza la autorización por “siempre permitido”.

Los tests visuales utilizan leads/transcripciones rotulados DEMO, micrófono sintético Chrome y, en C07, WAV de 12 segundos con tono generado. La prueba de creación habilitada usa una respuesta simulada y comprueba que doble clic no envíe dos creaciones. **Eso no acredita un clon humano generado ni la calidad de una llamada.**

No iniciamos nuevas llamadas, clonaciones o generaciones pagadas para obtener evidencia. No se verificó audio humano, conversación telefónica bidireccional ni funcionamiento en un teléfono físico; móvil se comprobó con navegador emulado. Tus pruebas personales de voz no se contabilizan como ensayos automatizados nuestros.

Las incidencias intermedias y correcciones están registradas: selectores/esperas de tests, foco/scroll de tooltips, doble Stop del grabador, conflictos de base concurrente y una limpieza de wallets de cuentas temporales que requirió completar el retiro. Los resultados finales citados corresponden a las repeticiones aprobadas; no se ocultó el límite de fixtures ni se dejaron aprobaciones inventadas.

## 6. Vercel, integración y candidato revisable

Tu instrucción «empezá a poner todo en el Vercel porque ahí es donde estoy revisando todo» autorizó publicar previews para revisión. Cada entrega se congeló con manifiesto/hash y conservó la base integrada disponible; en C07 el guard detectó un alias nuevo, detuvo el primer intento y se rebasó sobre KCAL01 antes de publicar, preservando I07/L01-R6/I06/C06.

Último candidato de **este chat**:

- **C07-R1**, deployment `dpl_EGN55sjUjXKs6t9UBSLn4aF2Gxuf`, staging/preview.
- [Preview inmutable de Caller C07](https://nbc-sales-ncp4pg5jq-nbc-sales.vercel.app/caller).
- [Alias compartido de revisión](https://nbc-sales-nbc-sales.vercel.app/caller). Puede contener entregas posteriores de otros lanes; no se comprobó de nuevo su destino el 16/09.
- Snapshot: **224 archivos, 11 deltas propios** sobre KCAL01-R1.
- SHA256 del manifiesto normalizado: `ec0b110caa23cdefe97caddd1b698a4739c02a2256266269cc3506c6880bdd69`.
- Archive: `artifacts/lanes/C07/nbc-sales-KCAL01-R1-plus-C07-R1.tar.gz`; SHA256 `3cf0f5e466aa3c965c4b64bb22414ee73298f693d76677bf83cb2b6198591447`.
- Código/tests/docs propios identificados en [delivery-manifest.json](../../../artifacts/lanes/C07/delivery-manifest.json); capturas en [artifacts/lanes/C07/browser](../../../artifacts/lanes/C07/browser).

Se compartió el preview sin exigir login de Vercel mediante excepción limitada al deployment; el login NBC se mantuvo. **Push, merge, tags y promoción a producción: NO EJECUTADOS.** No existía repositorio Git en el workspace documentado, por lo que se usaron manifiestos y no commits inventados.

Autorrevisión y pruebas de cada entrega están documentadas. Revisión técnica formal del orquestador y aceptación final de C07 por Franco permanecen pendientes en los reportes. La autorización de preview no reemplaza tu condición «Antes de pushear cualquier cosa, yo reviso y ahí pushean».

## 7. Qué falta para que el servicio llame a leads reales

La aclaración final de esta conversación fue: **no alcanza con pagar ElevenLabs y agregar un número; también falta implementación de nuestro lado.**

| Pendiente | Estado y siguiente paso |
|---|---|
| Cuenta/workspace con clonación habilitada | Último GET remoto: **15/09, 20:06 UTC**, Free, cloneAllowed=false y3 cupos. Confirmar la cuenta/API que debe usarse y revalidar. Los créditos NBC no prueban que ElevenLabs habilite clonación. No se comprobó nuevamente hoy. |
| Voz de Franco/Anas | Muestra propia o autorizada, consentimiento, creación cuando la cuenta lo permita y escucha humana. Clonar es opcional para un piloto con una voz existente. |
| Número y proveedor telefónico | Última lectura local del15/09 encontró0 números conectados. Falta definir/conectar el número y la integración compatible. No se compró ninguno. |
| Llamadas AI reales y cola persistida | Implementar ejecución saliente, estados/eventos, vínculo lead→llamada→transcripción, paso al siguiente lead, detener/reintentar y límites de consumo; recuperación de progreso al salir. Hoy la secuencia es demo. |
| Dialer manual dentro de NBC y grabación bilateral | Integrar audio/telefonía dentro del navegador. El enlace a la app del dispositivo y el grabador de micrófono no cubren ese recorrido. |
| Piloto completo | Una llamada a un número propio, verificar aviso inicial, audio, interrupciones, resultado/transcripción y consumo; después evaluar ampliación a leads. |
| Revisión/publicación final | Revisión técnica y aceptación del candidato concreto antes de push/producción. |

El **voice test de navegador ya funciona**, junto con CRM, listas, notas y analytics. El próximo objetivo sugerido es cerrar un piloto telefónico controlado de punta a punta. No se comenzó por pedir este reporte ni se activó consumo adicional.

## 8. Cómo revisar lo entregado

1. Abrir Caller con el login habitual. Como admin, agregar/mostrar demo para ver volumen sin llamadas reales.
2. CRM: abrir ficha, agregar nota, registrar manualmente No answer, editar etapas, mover tarjeta y comprobar autor/fecha/persistencia.
3. Guardar una lista y enviarla a AI Caller. Revisar la cola DEMO y su Stop; Live sigue mostrando conexión pendiente.
4. Analytics: Customize, agregar/mover/redimensionar y guardar; explorar tooltips con mouse/teclado/tap.
5. Voices: Clone a voice, revisar nombre y guion, grabar/detener/reproducir/guardar; Recheck mantiene muestra y muestra la capacidad conectada. No hace falta crear una voz para revisar esta UI.
6. Historial: Recover pending/Load more y exportación de una transcripción verificada. No iniciar una conversación solo para obtener una captura.

## 9. Documentación y trazabilidad

Reportes detallados: [C01](C01.md), [C02](C02.md), [C03](C03.md), [C04](C04.md), [C05](C05.md), [C06](C06.md) y [C07](C07.md).

Features: [continuidad](../../features/caller-live-tests.md), [sales workspace](../../features/caller-sales-workspace.md), [operaciones](../../features/caller-operations.md), [CRM de trabajo](../../features/caller-crm-workbench.md), [dashboard personal](../../features/caller-personal-dashboard.md), [fluidez y voces](../../features/caller-fluid-workspace.md), [hover y captura guiada](../../features/caller-chart-hover-voice-capture.md). [Handoff Caller](../caller.md).

Evidencia por entrega en `artifacts/lanes/C01/` a `C07/`: comandos/logs, SQL aplicado, resultados HTTP/browser, capturas, snapshots y hashes. Los reportes incluyen bloques propuestos para CHANGELOG y deltas de API_DOCS/DB_SCHEMA/arquitectura/lookup. La consolidación global pertenece al orquestador; este resumen no la declara completada ni reemplaza los reportes históricos.

Este archivo es la única incorporación de esta solicitud de resumen. No modifica código, esquema, configuración, proveedores ni deployments.
