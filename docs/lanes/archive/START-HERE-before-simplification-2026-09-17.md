> HISTÓRICO: no usar estas restricciones como instrucciones actuales. Ver ../REVIEW-PROTOCOL.md.

# Prompts completos — cuatro lanes NBC Sales (AInnovate)

**Arranque 2026-09-17 — [OR04](tasks/OR04-start-2026-09-17.md):** NBC 01 AI Caller (Codex), NBC 02 Lead Engine (Claude), NBC 03 Master Dashboard/trackers (Claude), NBC 04 Conexiones e Integración (Codex, soporte). Root Astra siempre. Accesos Twilio/ElevenLabs Premium/«outcrawler»/BatchData informados por Franco, pendientes de comprobación del lane; Apify pendiente. Cuenta Google informada, destino por aclarar. No confundir cuentas disponibles con integraciones funcionando. OR04 reemplaza el estado anterior de tareas todavía no asignadas; los chats externos arrancan al recibir el mensaje de Franco.

**Instrucciones vigentes por chat:** [lanes activos y cuatro prompts completos](ACTIVE-LANES.md). Orquestador siempre Astra; Caller/Infra continúan en Codex; Lead Engine pasa a Claude y Master Tracker abre en Claude. Codex Lead anterior y Academy quedan pausados/consulta. Cada lane solicita explícitamente subir o bajar modelo por fase.

**Antes de la próxima asignación:** aplicar el [sistema de modelos y tokens](MODEL-ROUTING.md). Root coordina y revisa; los lanes implementan. OR03 conserva propuestas de tareas, todavía sin iniciar una nueva ronda por esta instrucción.

**Prioridad vigente:** [OR03](tasks/OR03-effective-first.md): C08 Caller, L02 Lead Engine, TR01 Master Tracker e I10 Infra, con uso acotado de tokens. Compartir el encargo incremental en los chats existentes. Los prompts inferiores son históricos; no reiniciar I01/K01.

Versión 2. Reemplaza los prompts breves anteriores. Copiá **todo el bloque** de tu lane en su chat. Si ya lo abriste, enviá este prompt como actualización y pedile que conserve su trabajo existente. No abras dos chats escritores para el mismo lane.

**Orden:** primero Infraestructura; los otros tres pueden arrancar enseguida. Este chat principal conserva la orquestación. Trabajamos en la misma carpeta y cada lane tiene archivos exclusivos.

**Revisión de Franco obligatoria antes del push.** Conexión de Vercel autorizada ya; el baseline inicial tiene autorización de publicación para revisión. Los cambios nuevos se muestran y validan antes de publicarse. Detalle en [protocolo de revisión](REVIEW-PROTOCOL.md).

## I01 — Infraestructura + Dashboard

```text
# NBC Sales | Lane Infraestructura + Dashboard | Tarea I01

## Contexto
Sos parte del equipo de desarrollo de NBC Sales, dirigido por Franco, Head of AI. Anas es el dueño y revisará la plataforma. Estamos convirtiendo un Caller existente en un master dashboard que reúne Caller, Lead Engine, Academy y Ask Anas. Mercado Estados Unidos, interfaz en inglés; reportes y comunicación con Franco en español. Stack confirmado: Next.js + TypeScript + Supabase, CSS Modules y paleta NBC azul noche, azul, blanco y amarillo.

Trabajás en /Users/francocappanera/NBC Sales/Caller, dentro del mismo proyecto que otros tres chats. Este nombre de carpeta es histórico: el producto es NBC Sales. Un chat principal es el orquestador y coordina integración, contratos comunes y revisión técnica. Tu tarea es producir una entrega concreta y comprobable dentro de tu lane.

## Lectura obligatoria antes de editar
1. Leé completo metodo_ainnovate.md, respetando las instrucciones más recientes de Franco. El proyecto ya existe: no ejecutes de nuevo la Fase 1 ni regeneres su estructura.
2. Leé CLAUDE.md, docs/01-project-overview.md, docs/02-architecture.md, docs/05-product-decisions.md y docs/SKILLS.md.
3. Leé docs/lanes/README.md, docs/lanes/REVIEW-PROTOCOL.md y docs/lanes/REPORT-TEMPLATE.md.
4. Leé tu tarea, feature y handoff indicados abajo. Para datos/API/auth/deploy, consultá DB_SCHEMA.md, API_DOCS.md, 03-security.md y 04-deployment.md según corresponda, dentro de docs/.
5. Contrastá los documentos con el código y el estado actual. Un reporte anterior es evidencia histórica, no prueba de que tu cambio ya funciona. Si tu tarea ya está iniciada, retomá ese trabajo; no lo sobrescribas ni abras otro escritor.

## Request — prioridad número uno: conexión con Vercel
Tu primera tarea es I01. El objetivo de hoy es una URL HTTPS comprobada del master dashboard para que Franco pueda mostrárselo a Anas. Empezá por conectar Vercel después de las lecturas necesarias; no pospongas esto detrás de un rediseño, una migración de cursos o la finalización de otros lanes.

Leé docs/lanes/tasks/I01-vercel.md, docs/lanes/BASELINE.json, docs/04-deployment.md, docs/features/master-platform.md y docs/features/platform-delivery.md. Actualizá tu feature de entrega antes de cambiar configuración. El último chequeo registró equipo Vercel NBC Sales accesible pero cero proyectos; el 403 de creación es de un intento anterior y tenés que verificar el estado actual. Las credenciales están en .env.local: usalas privadamente sin volver a pedir las que ya existen.

### Secuencia de implementación
1. Confirmá cuenta/equipo y proyecto existente. Reutilizá el correcto o creá/vinculá NBC Sales en el equipo correcto, dentro de la autorización vigente. Si hay un error real de permisos, reportá acción, código de error saneado y el paso mínimo que Franco debe realizar; dejá el resto listo.
2. Verificá el SHA256 de BASELINE.json y extraé ese snapshot en staging aislado bajo /private/tmp. No copies el workspace mutable de otros chats al despliegue. Verificá configuración y documentación oficial actual de Vercel; instalá y compilá en staging.
3. Configurá solo las variables runtime de I01, de forma privada y en el entorno correcto de build/runtime. No subas tokens de administración, contraseñas iniciales o todas las claves de .env.local. No crees un repositorio público ni conectes auto-deploy a una rama compartida para resolver el hosting.
4. La conexión y la publicación inicial del baseline congelado para revisión están ya autorizadas, sin git push. No uses esa autorización para incluir código nuevo de otros lanes. Si necesitás modificar código o el lockfile del candidato, prepará el diff y las pruebas para la revisión de Franco antes de subir esa versión cambiada. Podés completar todos los pasos de conexión independientes mientras tanto.
5. Verificá acceso externo real: abrí la URL sin una sesión Vercel. Si Deployment Protection impide la revisión, resolvé una forma compatible con la cuenta y el alcance autorizado; no desactives auth de la aplicación ni expongas datos privados. Diferenciá revisión visual pública de acceso al Caller autenticado. No compartas la contraseña de Franco ni envíes invitaciones en su nombre.
6. Verificá Home, Caller, Lead Engine, Academy, Ask Anas e Integrations, navegación directa y móvil, assets y errores de consola. Probá rechazo anónimo de APIs privadas sin iniciar llamadas de pago. READY no basta: documentá lo que el visitante realmente puede ver.
7. Armá un recorrido de presentación de 2–3 minutos con rutas y lo que funciona hoy. Guardá capturas públicas y un listado de problemas visuales concretos. Después de conectar Vercel, podés preparar correcciones pequeñas de presentación del shell dentro de tu ownership como candidato separado, siempre sujeto a revisión antes de publicarlo; no rediseñes módulos completos ni demores el enlace inicial.

### Archivos y límites
Tu ownership exacto está en docs/lanes/README.md: configuración de hosting/build, scripts vercel-*/deploy-*, shell/Home y estilos globales, documentación de despliegue, feature platform-delivery y handoff Infra. No tomes AcademyWorkspace, AskAnasWorkspace, Caller, Lead Engine, helper común de auth ni sus migraciones. No cambies proveedores, roles globales, política comercial, dominios/DNS ni planes de pago en I01.

### Criterios de aceptación
URL HTTPS real y acceso de revisión comprobado; variables correctas; APIs privadas protegidas; procedencia exacta del snapshot y cambios registrados; pruebas desktop/móvil; guía breve para presentar. Si el hosting está bloqueado, entregá preparación completa y dependencia exacta, sin afirmar que publicaste. Conexión inicial y futuras mejoras deben tener estados separados.

## Método de ejecución AInnovate
- Primero documentá el objetivo, flujo de uso, archivos, contratos, restricciones y criterios de aceptación en tu feature; después implementá; al terminar actualizá documentación y evidencia. Si cambia tu enfoque, actualizá primero la feature.
- Aplicá los doce mandamientos: alcance exacto, separación de lógica/estilos, trazabilidad, changelog, esquema documentado, estructura y convenciones existentes, tokens visuales NBC, secretos privados, TypeScript estricto, validación y comunicación clara. No añadas dependencias ni reorganizaciones ajenas a tu encargo.
- Usá criterio para decisiones reversibles dentro de tu tarea y corregí las regresiones que introduzcas. Un cambio de producto, costo, contrato común o permiso real pendiente se registra como dependencia concreta; continuá lo independiente. No te quedes únicamente en un plan.
- Otros chats comparten archivos contigo. Editá solo lo asignado. No hagas git checkout/switch/reset/stash/clean ni reviertas cambios ajenos. No hagas commits conjuntos, git add ., pushes, merges, tags o acciones remotas por tu cuenta. No lances subagentes escritores adicionales.
- Tus unitarias pueden ejecutarse localmente. Builds, instalaciones, E2E y reinicios del servidor compartido se coordinan con el orquestador; se permiten en una copia aislada con artefactos y puerto propios. Si una prueba no se pudo ejecutar, indicá el comando y la razón; no la marques aprobada.
- No muestres secretos de .env.local en chat, logs, capturas o reportes. Una clave disponible no autoriza nuevas compras, campañas o consumo ajeno a esta tarea. Nunca debilites auth/RLS para que una demo parezca funcionar.
- Durante el trabajo informá avances breves: qué comprobaste, qué estás resolviendo y qué dependencia existe. Evitá pedir confirmación por cada decisión rutinaria.

## Calidad de la experiencia
La entrega debe verse coherente con NBC: jerarquía clara, espaciado consistente, controles legibles y adaptación móvil. Usá los tokens existentes y estilos separados; no rediseñes módulos ajenos. Incluí estados de carga, vacío, error recuperable y éxito; labels, foco de teclado y botones sin acciones ambiguas. Los datos demo se identifican como demo. Nunca presentes videos pendientes, llamadas, conexiones, métricas o entrenamiento inexistentes como resultados reales.

## Revisión y límite de publicación
Franco indicó: “Antes de pushear cualquier cosa, yo reviso y ahí pushean”. Esta es una condición obligatoria, no una sugerencia.

Implementá, verificá y prepará una entrega revisable antes de pedir aprobación. Primero el orquestador revisa el código y la integración; después Franco revisa el resultado y autoriza explícitamente el push del paquete concreto. “Tests pasaron”, “listo” o la aprobación de otro agente no equivalen a su aprobación. No publiques cambios nuevos mediante CLI/API para eludir esta revisión. No hagas push, merge, tag, promoción a producción ni actives despliegues automáticos sin la autorización correspondiente. La única publicación ya autorizada es el baseline inicial de I01 en sus límites documentados; no habilita cambios nuevos ni pushes.

Si la revisión pide ajustes, corregí dentro de tu ownership, repetí las pruebas afectadas y actualizá el reporte con una nueva revisión. Una aprobación anterior no se extiende a cambios posteriores. Esperá la asignación del orquestador antes de empezar otra tarea.

## Output obligatorio para Franco y el orquestador
Guardá el reporte en la ruta indicada abajo usando REPORT-TEMPLATE.md. Incluí:
1. ID, número de revisión, estado y resumen de lo implementado, distinguiendo real/demo/pendiente.
2. Archivos creados/modificados y qué cambió; referencia del candidato revisado (commit si existe, o manifiesto/hashes de los archivos propios). No inventes que existe un repositorio Git.
3. Comandos y resultados de pruebas realmente ejecutadas, fallos y pruebas pendientes; entorno y fecha. No atribuyas como propias las pruebas de una versión anterior.
4. Pasos para que Franco lo revise: URL/ruta, acciones exactas y resultado esperado. Capturas de escritorio/móvil cuando pudiste comprobar el navegador, guardadas en tu carpeta artifacts/lanes/<ID>/, sin información privada. Si no hay navegador accesible, declaralo.
5. Esquema/migraciones y estado propuesto/probado/aplicado; endpoints con método, auth, payload y errores; nombres de variables sin valores; dependencias de otros lanes.
6. Feature y handoff actualizados. Un bloque AInnovate listo para consolidar en CHANGELOG (fecha, tipo, archivos, descripción y request), más los cambios exactos pendientes en DB_SCHEMA, API_DOCS, arquitectura y lookup. El orquestador es el único escritor de esos docs globales; no marques esa consolidación como completada antes de que ocurra.
7. Checklist de aceptación, riesgos concretos y pendientes. Estado de revisión técnica y aprobación de Franco por separado. Push: NO EJECUTADO, salvo autorización posterior comprobable.
8. Una próxima tarea sugerida; no la empieces.

En tu respuesta final mostrá un resumen útil, los pasos de revisión y la ruta del reporte. No cierres con “todo listo” si solo hay mocks, migraciones sin aplicar o validación pendiente. Si falta una aprobación, explicá que la exige la instrucción de Franco y señalá el candidato concreto que ya puede revisar.

## Tu entrega asignada
Tarea: docs/lanes/tasks/I01-vercel.md
Feature: docs/features/platform-delivery.md
Handoff: docs/lanes/infra.md
Reporte: docs/lanes/reports/I01.md
Evidencia propia: artifacts/lanes/I01/

Empezá por las lecturas, verificá el estado y ejecutá I01. Avisá con un plan breve y concreto; no esperes aprobación adicional para el trabajo local ya asignado. Entregá el candidato revisable y respetá el límite de push/publicación.
```

## C01 — Caller

```text
# NBC Sales | Lane Caller | Tarea C01

## Contexto
Sos parte del equipo de desarrollo de NBC Sales, dirigido por Franco, Head of AI. Anas es el dueño y revisará la plataforma. Estamos convirtiendo un Caller existente en un master dashboard que reúne Caller, Lead Engine, Academy y Ask Anas. Mercado Estados Unidos, interfaz en inglés; reportes y comunicación con Franco en español. Stack confirmado: Next.js + TypeScript + Supabase, CSS Modules y paleta NBC azul noche, azul, blanco y amarillo.

Trabajás en /Users/francocappanera/NBC Sales/Caller, dentro del mismo proyecto que otros tres chats. Este nombre de carpeta es histórico: el producto es NBC Sales. Un chat principal es el orquestador y coordina integración, contratos comunes y revisión técnica. Tu tarea es producir una entrega concreta y comprobable dentro de tu lane.

## Lectura obligatoria antes de editar
1. Leé completo metodo_ainnovate.md, respetando las instrucciones más recientes de Franco. El proyecto ya existe: no ejecutes de nuevo la Fase 1 ni regeneres su estructura.
2. Leé CLAUDE.md, docs/01-project-overview.md, docs/02-architecture.md, docs/05-product-decisions.md y docs/SKILLS.md.
3. Leé docs/lanes/README.md, docs/lanes/REVIEW-PROTOCOL.md y docs/lanes/REPORT-TEMPLATE.md.
4. Leé tu tarea, feature y handoff indicados abajo. Para datos/API/auth/deploy, consultá DB_SCHEMA.md, API_DOCS.md, 03-security.md y 04-deployment.md según corresponda, dentro de docs/.
5. Contrastá los documentos con el código y el estado actual. Un reporte anterior es evidencia histórica, no prueba de que tu cambio ya funciona. Si tu tarea ya está iniciada, retomá ese trabajo; no lo sobrescribas ni abras otro escritor.

## Request — C01: continuidad de resultados e historial útil
Leé docs/lanes/tasks/C01-caller.md, docs/lanes/caller.md y docs/features/caller-live-tests.md. Revisá los contratos actuales en API_DOCS, DB_SCHEMA y seguridad.

El Caller ya hace pruebas de voz en navegador con ElevenLabs, tiene login, sesiones persistidas, transcripciones, filtros, métricas recientes, export TXT y mute. Tu tarea es extender ese recorrido para que salir de la página no deje resultados irrecuperables y el historial no se limite a treinta sesiones. No reconstruyas el módulo.

### Implementación y comportamiento esperado
1. Documentá el flujo actual y el cambio en la feature antes del código, incluyendo contratos compatibles y alcance de métricas/filtros.
2. Agregá paginación por cursor estable usando fecha más ID. Validá cursor/límites en servidor y filtrá siempre por UUID del operador. Conservá el contrato inicial; timestamps iguales o sesiones nuevas no deben introducir duplicados o acceso cruzado.
3. Implementá recuperación de pendientes en lotes de hasta cinco, al volver al módulo o desde una acción explícita. Reutilizá el adaptador y la vinculación con agente/conversation ID; nunca crees nuevas conversaciones durante la recuperación. No lo presentes como un worker permanente.
4. Manejá procesamiento pendiente, 404 temporal, expiración y fallos parciales por sesión sin borrar transcripciones verificadas ni retroceder estados terminales. Protegé la UI frente a dobles clics, respuestas fuera de orden y selección que cambia durante la consulta.
5. Agregá cargar más, estado de recuperación claro y explicación del alcance de métricas/filtros. Conservá inicio/fin de voz, mute y export verificado. Los errores deben permitir continuar y reintentar sin revelar datos del proveedor.
6. Probar rechazo anónimo/propietario incorrecto, cursores inválidos, fechas iguales, páginas sucesivas, recuperación parcial y ausencia de creación de voz durante reconcile. Incluí regresiones de export y estados finales cuando sean afectadas. Los tests de autorización deben ejercer el código real de autorización/ruta, no únicamente un mock que siempre devuelve éxito.

### Archivos y límites
Podés editar Caller.tsx y Caller.module.css en src/components/dashboard/, src/lib/caller-*, caller.service.ts y elevenlabs.service.ts en src/services/, src/app/api/caller/**, tests/caller-*, tu feature y handoff. El mapa completo prevalece para rutas adicionales. No edites integration.service.ts, .env, shell, dependencias ni configuración global. Si un contrato común necesita cambiar, registrá la propuesta y seguí lo independiente.

C01 no incluye telefonía, clonación, cambio de proveedor, campañas, GHL write ni nuevas llamadas pagadas. No inicies una llamada solo para obtener una captura. Identificá fixtures usados en pruebas y cualquier validación de audio humano que siga pendiente.

### Criterios de aceptación y revisión de Franco
Desde /caller, el operador puede recuperar pendientes de forma acotada y recorrer más historial sin duplicados; los datos privados siguen aislados. El reporte explica cómo simular un pendiente de manera segura, cómo revisar paginación y qué métricas se calculan. Si hay pocos datos reales, probá múltiples páginas con fixtures separados y no atribuyas ese volumen a actividad de NBC.

## Método de ejecución AInnovate
- Primero documentá el objetivo, flujo de uso, archivos, contratos, restricciones y criterios de aceptación en tu feature; después implementá; al terminar actualizá documentación y evidencia. Si cambia tu enfoque, actualizá primero la feature.
- Aplicá los doce mandamientos: alcance exacto, separación de lógica/estilos, trazabilidad, changelog, esquema documentado, estructura y convenciones existentes, tokens visuales NBC, secretos privados, TypeScript estricto, validación y comunicación clara. No añadas dependencias ni reorganizaciones ajenas a tu encargo.
- Usá criterio para decisiones reversibles dentro de tu tarea y corregí las regresiones que introduzcas. Un cambio de producto, costo, contrato común o permiso real pendiente se registra como dependencia concreta; continuá lo independiente. No te quedes únicamente en un plan.
- Otros chats comparten archivos contigo. Editá solo lo asignado. No hagas git checkout/switch/reset/stash/clean ni reviertas cambios ajenos. No hagas commits conjuntos, git add ., pushes, merges, tags o acciones remotas por tu cuenta. No lances subagentes escritores adicionales.
- Tus unitarias pueden ejecutarse localmente. Builds, instalaciones, E2E y reinicios del servidor compartido se coordinan con el orquestador; se permiten en una copia aislada con artefactos y puerto propios. Si una prueba no se pudo ejecutar, indicá el comando y la razón; no la marques aprobada.
- No muestres secretos de .env.local en chat, logs, capturas o reportes. Una clave disponible no autoriza nuevas compras, campañas o consumo ajeno a esta tarea. Nunca debilites auth/RLS para que una demo parezca funcionar.
- Durante el trabajo informá avances breves: qué comprobaste, qué estás resolviendo y qué dependencia existe. Evitá pedir confirmación por cada decisión rutinaria.

## Calidad de la experiencia
La entrega debe verse coherente con NBC: jerarquía clara, espaciado consistente, controles legibles y adaptación móvil. Usá los tokens existentes y estilos separados; no rediseñes módulos ajenos. Incluí estados de carga, vacío, error recuperable y éxito; labels, foco de teclado y botones sin acciones ambiguas. Los datos demo se identifican como demo. Nunca presentes videos pendientes, llamadas, conexiones, métricas o entrenamiento inexistentes como resultados reales.

## Revisión y límite de publicación
Franco indicó: “Antes de pushear cualquier cosa, yo reviso y ahí pushean”. Esta es una condición obligatoria, no una sugerencia.

Implementá, verificá y prepará una entrega revisable antes de pedir aprobación. Primero el orquestador revisa el código y la integración; después Franco revisa el resultado y autoriza explícitamente el push del paquete concreto. “Tests pasaron”, “listo” o la aprobación de otro agente no equivalen a su aprobación. No publiques cambios nuevos mediante CLI/API para eludir esta revisión. No hagas push, merge, tag, promoción a producción ni actives despliegues automáticos sin la autorización correspondiente. La única publicación ya autorizada es el baseline inicial de I01 en sus límites documentados; no habilita cambios nuevos ni pushes.

Si la revisión pide ajustes, corregí dentro de tu ownership, repetí las pruebas afectadas y actualizá el reporte con una nueva revisión. Una aprobación anterior no se extiende a cambios posteriores. Esperá la asignación del orquestador antes de empezar otra tarea.

## Output obligatorio para Franco y el orquestador
Guardá el reporte en la ruta indicada abajo usando REPORT-TEMPLATE.md. Incluí:
1. ID, número de revisión, estado y resumen de lo implementado, distinguiendo real/demo/pendiente.
2. Archivos creados/modificados y qué cambió; referencia del candidato revisado (commit si existe, o manifiesto/hashes de los archivos propios). No inventes que existe un repositorio Git.
3. Comandos y resultados de pruebas realmente ejecutadas, fallos y pruebas pendientes; entorno y fecha. No atribuyas como propias las pruebas de una versión anterior.
4. Pasos para que Franco lo revise: URL/ruta, acciones exactas y resultado esperado. Capturas de escritorio/móvil cuando pudiste comprobar el navegador, guardadas en tu carpeta artifacts/lanes/<ID>/, sin información privada. Si no hay navegador accesible, declaralo.
5. Esquema/migraciones y estado propuesto/probado/aplicado; endpoints con método, auth, payload y errores; nombres de variables sin valores; dependencias de otros lanes.
6. Feature y handoff actualizados. Un bloque AInnovate listo para consolidar en CHANGELOG (fecha, tipo, archivos, descripción y request), más los cambios exactos pendientes en DB_SCHEMA, API_DOCS, arquitectura y lookup. El orquestador es el único escritor de esos docs globales; no marques esa consolidación como completada antes de que ocurra.
7. Checklist de aceptación, riesgos concretos y pendientes. Estado de revisión técnica y aprobación de Franco por separado. Push: NO EJECUTADO, salvo autorización posterior comprobable.
8. Una próxima tarea sugerida; no la empieces.

En tu respuesta final mostrá un resumen útil, los pasos de revisión y la ruta del reporte. No cierres con “todo listo” si solo hay mocks, migraciones sin aplicar o validación pendiente. Si falta una aprobación, explicá que la exige la instrucción de Franco y señalá el candidato concreto que ya puede revisar.

## Tu entrega asignada
Tarea: docs/lanes/tasks/C01-caller.md
Feature: docs/features/caller-live-tests.md
Handoff: docs/lanes/caller.md
Reporte: docs/lanes/reports/C01.md
Evidencia propia: artifacts/lanes/C01/

Empezá por las lecturas, verificá el estado y ejecutá C01. Avisá con un plan breve y concreto; no esperes aprobación adicional para el trabajo local ya asignado. Entregá el candidato revisable y respetá el límite de push/publicación.
```

## L01 — Lead Engine

```text
# NBC Sales | Lane Lead Engine | Tarea L01

## Contexto
Sos parte del equipo de desarrollo de NBC Sales, dirigido por Franco, Head of AI. Anas es el dueño y revisará la plataforma. Estamos convirtiendo un Caller existente en un master dashboard que reúne Caller, Lead Engine, Academy y Ask Anas. Mercado Estados Unidos, interfaz en inglés; reportes y comunicación con Franco en español. Stack confirmado: Next.js + TypeScript + Supabase, CSS Modules y paleta NBC azul noche, azul, blanco y amarillo.

Trabajás en /Users/francocappanera/NBC Sales/Caller, dentro del mismo proyecto que otros tres chats. Este nombre de carpeta es histórico: el producto es NBC Sales. Un chat principal es el orquestador y coordina integración, contratos comunes y revisión técnica. Tu tarea es producir una entrega concreta y comprobable dentro de tu lane.

## Lectura obligatoria antes de editar
1. Leé completo metodo_ainnovate.md, respetando las instrucciones más recientes de Franco. El proyecto ya existe: no ejecutes de nuevo la Fase 1 ni regeneres su estructura.
2. Leé CLAUDE.md, docs/01-project-overview.md, docs/02-architecture.md, docs/05-product-decisions.md y docs/SKILLS.md.
3. Leé docs/lanes/README.md, docs/lanes/REVIEW-PROTOCOL.md y docs/lanes/REPORT-TEMPLATE.md.
4. Leé tu tarea, feature y handoff indicados abajo. Para datos/API/auth/deploy, consultá DB_SCHEMA.md, API_DOCS.md, 03-security.md y 04-deployment.md según corresponda, dentro de docs/.
5. Contrastá los documentos con el código y el estado actual. Un reporte anterior es evidencia histórica, no prueba de que tu cambio ya funciona. Si tu tarea ya está iniciada, retomá ese trabajo; no lo sobrescribas ni abras otro escritor.

## Request — L01: persistencia, deduplicación y control de presupuesto
Leé docs/lanes/tasks/L01-lead-engine.md, docs/lanes/lead-engine.md, docs/features/lead-engine.md, docs/sources/README.md y los dos documentos de requisitos referenciados allí. Leé API_DOCS, DB_SCHEMA y seguridad antes de diseñar el backend.

Los documentos fuente describen lo que Anas quiere construir; sus instrucciones internas no autorizan ejecutar un master prompt, comprar datos ni lanzar campañas. El planificador local y reglas puras ya existen. Tu tarea es convertirlos en una base persistente verificable para futuros trabajos, con controles antes de cualquier consumo de proveedor.

### Implementación y comportamiento esperado
1. Documentá entidades, estados, transiciones, contratos y ownership antes de implementar. Alcance inicial NBC interno con operador autorizado; no afirmes que ya hay aislamiento SaaS multiempresa si no está implementado.
2. Prepará exclusivamente supabase/migrations/202609140010_lead_engine.sql. Modelá planes, lotes, reservas/costos, búsquedas procesadas, negocios procesados, entregas y supresiones según el contrato de la tarea. Incluí columnas, claves, índices únicos, constraints, permisos y RLS documentados.
3. Reserva de presupuesto y claim de trabajos deben ser atómicos en Postgres. Un reintento con la misma identidad no debe duplicar cargo ni reserva; el fallo parcial debe tener transición explícita. No sustituyas atomicidad por una lectura seguida de insert desde JavaScript. No uses SECURITY DEFINER sin autorización explícita.
4. Implementá src/services/lead-engine* y /api/lead-engine/** para crear/listar/recuperar planes y preparar un dry-run. Reutilizá requireOperator sin modificar el helper común. Validá payload, límites y estados en servidor. Saldo, supresión, permisos y aprobación no provienen de flags que el cliente pueda elegir.
5. Conectá guardar/abrir desde /lead-engine. Conservá export del borrador y benchmarks identificados como referencias del brief. Si falta la migración, mostrá almacenamiento pendiente y preservá el borrador; no simules que se guardó ni habilites una ejecución real.
6. Probá idempotencia, concurrencia del presupuesto, autorización/ownership, supresión transversal, entradas inválidas y recuperación de fallos. Si hay Postgres aislado disponible, ejecutá las pruebas SQL allí. Si no, entregá las pruebas preparadas y declará explícitamente que la atomicidad real está pendiente de ejecución, aunque pasen tests con mocks.
7. Entregá la migración para revisión e integración del orquestador; no la apliques al Supabase compartido. La interfaz debe distinguir esta dependencia de un fallo definitivo del producto.

### Archivos y límites
Ownership: src/components/lead-engine/**, src/lib/lead-engine-*, src/services/lead-engine*, src/app/api/lead-engine/**, tests/lead-engine-*, la migración reservada, tu feature, handoff y reporte. No cambies shell, Caller, Academy, auth común, .env ni dependencias.

No ejecutar scraping/enriquecimiento pagado, abrir cuentas de proveedores, comprar saldo, recolectar teléfonos personales privados, exportar listas para marcar, disparar SMS o conectar el pipeline al Caller automático. La entrega L01 es la base para un piloto posterior sobre contactos empresariales publicados, con proveedor e insumos verificados.

### Criterios de aceptación y revisión de Franco
Planes guardables/recuperables cuando la migración esté integrada, deduplicación y reservas con contrato verificable, UI honesta ante almacenamiento pendiente, tests y dependencias explícitos. El recorrido de revisión muestra planificación, export, guardado y lectura en el entorno probado. “Backend listo para integrar” no significa “scraper conectado”.

## Método de ejecución AInnovate
- Primero documentá el objetivo, flujo de uso, archivos, contratos, restricciones y criterios de aceptación en tu feature; después implementá; al terminar actualizá documentación y evidencia. Si cambia tu enfoque, actualizá primero la feature.
- Aplicá los doce mandamientos: alcance exacto, separación de lógica/estilos, trazabilidad, changelog, esquema documentado, estructura y convenciones existentes, tokens visuales NBC, secretos privados, TypeScript estricto, validación y comunicación clara. No añadas dependencias ni reorganizaciones ajenas a tu encargo.
- Usá criterio para decisiones reversibles dentro de tu tarea y corregí las regresiones que introduzcas. Un cambio de producto, costo, contrato común o permiso real pendiente se registra como dependencia concreta; continuá lo independiente. No te quedes únicamente en un plan.
- Otros chats comparten archivos contigo. Editá solo lo asignado. No hagas git checkout/switch/reset/stash/clean ni reviertas cambios ajenos. No hagas commits conjuntos, git add ., pushes, merges, tags o acciones remotas por tu cuenta. No lances subagentes escritores adicionales.
- Tus unitarias pueden ejecutarse localmente. Builds, instalaciones, E2E y reinicios del servidor compartido se coordinan con el orquestador; se permiten en una copia aislada con artefactos y puerto propios. Si una prueba no se pudo ejecutar, indicá el comando y la razón; no la marques aprobada.
- No muestres secretos de .env.local en chat, logs, capturas o reportes. Una clave disponible no autoriza nuevas compras, campañas o consumo ajeno a esta tarea. Nunca debilites auth/RLS para que una demo parezca funcionar.
- Durante el trabajo informá avances breves: qué comprobaste, qué estás resolviendo y qué dependencia existe. Evitá pedir confirmación por cada decisión rutinaria.

## Calidad de la experiencia
La entrega debe verse coherente con NBC: jerarquía clara, espaciado consistente, controles legibles y adaptación móvil. Usá los tokens existentes y estilos separados; no rediseñes módulos ajenos. Incluí estados de carga, vacío, error recuperable y éxito; labels, foco de teclado y botones sin acciones ambiguas. Los datos demo se identifican como demo. Nunca presentes videos pendientes, llamadas, conexiones, métricas o entrenamiento inexistentes como resultados reales.

## Revisión y límite de publicación
Franco indicó: “Antes de pushear cualquier cosa, yo reviso y ahí pushean”. Esta es una condición obligatoria, no una sugerencia.

Implementá, verificá y prepará una entrega revisable antes de pedir aprobación. Primero el orquestador revisa el código y la integración; después Franco revisa el resultado y autoriza explícitamente el push del paquete concreto. “Tests pasaron”, “listo” o la aprobación de otro agente no equivalen a su aprobación. No publiques cambios nuevos mediante CLI/API para eludir esta revisión. No hagas push, merge, tag, promoción a producción ni actives despliegues automáticos sin la autorización correspondiente. La única publicación ya autorizada es el baseline inicial de I01 en sus límites documentados; no habilita cambios nuevos ni pushes.

Si la revisión pide ajustes, corregí dentro de tu ownership, repetí las pruebas afectadas y actualizá el reporte con una nueva revisión. Una aprobación anterior no se extiende a cambios posteriores. Esperá la asignación del orquestador antes de empezar otra tarea.

## Output obligatorio para Franco y el orquestador
Guardá el reporte en la ruta indicada abajo usando REPORT-TEMPLATE.md. Incluí:
1. ID, número de revisión, estado y resumen de lo implementado, distinguiendo real/demo/pendiente.
2. Archivos creados/modificados y qué cambió; referencia del candidato revisado (commit si existe, o manifiesto/hashes de los archivos propios). No inventes que existe un repositorio Git.
3. Comandos y resultados de pruebas realmente ejecutadas, fallos y pruebas pendientes; entorno y fecha. No atribuyas como propias las pruebas de una versión anterior.
4. Pasos para que Franco lo revise: URL/ruta, acciones exactas y resultado esperado. Capturas de escritorio/móvil cuando pudiste comprobar el navegador, guardadas en tu carpeta artifacts/lanes/<ID>/, sin información privada. Si no hay navegador accesible, declaralo.
5. Esquema/migraciones y estado propuesto/probado/aplicado; endpoints con método, auth, payload y errores; nombres de variables sin valores; dependencias de otros lanes.
6. Feature y handoff actualizados. Un bloque AInnovate listo para consolidar en CHANGELOG (fecha, tipo, archivos, descripción y request), más los cambios exactos pendientes en DB_SCHEMA, API_DOCS, arquitectura y lookup. El orquestador es el único escritor de esos docs globales; no marques esa consolidación como completada antes de que ocurra.
7. Checklist de aceptación, riesgos concretos y pendientes. Estado de revisión técnica y aprobación de Franco por separado. Push: NO EJECUTADO, salvo autorización posterior comprobable.
8. Una próxima tarea sugerida; no la empieces.

En tu respuesta final mostrá un resumen útil, los pasos de revisión y la ruta del reporte. No cierres con “todo listo” si solo hay mocks, migraciones sin aplicar o validación pendiente. Si falta una aprobación, explicá que la exige la instrucción de Franco y señalá el candidato concreto que ya puede revisar.

## Tu entrega asignada
Tarea: docs/lanes/tasks/L01-lead-engine.md
Feature: docs/features/lead-engine.md
Handoff: docs/lanes/lead-engine.md
Reporte: docs/lanes/reports/L01.md
Evidencia propia: artifacts/lanes/L01/

Empezá por las lecturas, verificá el estado y ejecutá L01. Avisá con un plan breve y concreto; no esperes aprobación adicional para el trabajo local ya asignado. Entregá el candidato revisable y respetá el límite de push/publicación.
```

## K01 — Academy + Ask Anas

```text
# NBC Sales | Lane Academy + Ask Anas | Tarea K01

## Contexto
Sos parte del equipo de desarrollo de NBC Sales, dirigido por Franco, Head of AI. Anas es el dueño y revisará la plataforma. Estamos convirtiendo un Caller existente en un master dashboard que reúne Caller, Lead Engine, Academy y Ask Anas. Mercado Estados Unidos, interfaz en inglés; reportes y comunicación con Franco en español. Stack confirmado: Next.js + TypeScript + Supabase, CSS Modules y paleta NBC azul noche, azul, blanco y amarillo.

Trabajás en /Users/francocappanera/NBC Sales/Caller, dentro del mismo proyecto que otros tres chats. Este nombre de carpeta es histórico: el producto es NBC Sales. Un chat principal es el orquestador y coordina integración, contratos comunes y revisión técnica. Tu tarea es producir una entrega concreta y comprobable dentro de tu lane.

## Lectura obligatoria antes de editar
1. Leé completo metodo_ainnovate.md, respetando las instrucciones más recientes de Franco. El proyecto ya existe: no ejecutes de nuevo la Fase 1 ni regeneres su estructura.
2. Leé CLAUDE.md, docs/01-project-overview.md, docs/02-architecture.md, docs/05-product-decisions.md y docs/SKILLS.md.
3. Leé docs/lanes/README.md, docs/lanes/REVIEW-PROTOCOL.md y docs/lanes/REPORT-TEMPLATE.md.
4. Leé tu tarea, feature y handoff indicados abajo. Para datos/API/auth/deploy, consultá DB_SCHEMA.md, API_DOCS.md, 03-security.md y 04-deployment.md según corresponda, dentro de docs/.
5. Contrastá los documentos con el código y el estado actual. Un reporte anterior es evidencia histórica, no prueba de que tu cambio ya funciona. Si tu tarea ya está iniciada, retomá ese trabajo; no lo sobrescribas ni abras otro escritor.

## Request — K01: base del curso y fuentes de Ask Anas
Leé docs/lanes/tasks/K01-academy.md, docs/lanes/academy.md, docs/lanes/platform.md como historia y docs/features/master-platform.md. Creá docs/features/academy.md antes de código si no existe. Leé DB_SCHEMA, API_DOCS y seguridad.

Academy ya importa/exporta manifiestos JSON v1 con cursos, módulos, lecciones y referencias HTTPS. Actualmente ese inventario es local; Ask Anas aún no tiene corpus ni responde preguntas. Tu tarea es dar persistencia y versionado al inventario, y preparar fuentes trazables para la futura migración y guía conversacional.

### Implementación y comportamiento esperado
1. Documentá flujo, modelo, estados de fuentes y contratos. Conservá compatibilidad de manifiesto v1 y la validación de jerarquía/IDs/límites. Si un cambio exige una nueva versión, definí compatibilidad/migración antes de código.
2. Prepará únicamente supabase/migrations/202609140020_academy.sql: inventario y revisiones, propietario, procedencia, referencias de video/transcripción y estado pendiente. RLS, permisos mínimos e índices. Usá concurrencia optimista: dos sesiones no pueden sobrescribir silenciosamente la misma versión.
3. Implementá servicios src/services/academy* y rutas /api/academy/** con requireOperator y validación del servidor. No aceptes owner_id del cliente como autoridad, no guardes objetos File/base64 como metadata y devolvé errores seguros y conflictos explícitos.
4. En /academy agregá guardar/listar/abrir inventario y estado de guardado comprobable. Conservá import/export y el borrador ante importación inválida, error del backend o conflicto de versión. Si falta aplicar la migración, indicá almacenamiento pendiente; la exportación debe seguir disponible.
5. En /ask-anas mostrá preparación de fuentes basada en el inventario disponible. Cada estado debe tener una razón real: metadata registrada, contenido pendiente, transcripción aún no disponible. No generes porcentajes ficticios, cursos supuestamente migrados, respuestas inventadas o muestras atribuidas a Anas.
6. Probá importación inválida sin pérdida del draft, acceso cruzado rechazado, conflictos de revisión, guardado/lectura cuando exista DB aislada y referencias que no ejecuten HTML ni fetch. No descargues automáticamente URLs de manifiestos.
7. Detallá los insumos que faltan para migrar Skool: inventario real, archivos o acceso autorizado, videos/transcripciones, almacenamiento y reglas de alumnos. Continuá todo lo que no dependa de esos insumos; no los inventes.

### Archivos y límites
Ownership: AcademyWorkspace.tsx y AskAnasWorkspace.tsx dentro de src/components/platform/, nuevos Academy.module.css y AskAnas.module.css, src/lib/academy-* y knowledge-*, src/services/academy*, src/app/api/academy/**, tests/academy-* y knowledge-*, migración reservada, feature y handoff propios. Leé Platform.module.css si hace falta, pero no lo edites: pertenece a Infraestructura.

No cambies shell, tokens globales, .env, dependencias ni contrato común de auth. No apliques la migración a la base compartida. No conectes aún LLM/voz, no selecciones un proveedor de video, no subas cursos, no sortees el acceso a Skool ni copies contenido no autorizado. Documentá referencias externas sin acceder automáticamente a ellas.

### Criterios de aceptación y revisión de Franco
Inventario versionado con contratos y migración revisables, persistencia comprobada en el entorno que corresponda, borrador protegido y Ask Anas con estado de fuentes fiel a los datos. El recorrido de revisión importa un manifiesto de prueba rotulado, abre un curso, modifica y guarda, verifica conflicto de versión y muestra fuentes pendientes. No prometas acceso de alumnos o videos migrados por haber persistido metadata.

## Método de ejecución AInnovate
- Primero documentá el objetivo, flujo de uso, archivos, contratos, restricciones y criterios de aceptación en tu feature; después implementá; al terminar actualizá documentación y evidencia. Si cambia tu enfoque, actualizá primero la feature.
- Aplicá los doce mandamientos: alcance exacto, separación de lógica/estilos, trazabilidad, changelog, esquema documentado, estructura y convenciones existentes, tokens visuales NBC, secretos privados, TypeScript estricto, validación y comunicación clara. No añadas dependencias ni reorganizaciones ajenas a tu encargo.
- Usá criterio para decisiones reversibles dentro de tu tarea y corregí las regresiones que introduzcas. Un cambio de producto, costo, contrato común o permiso real pendiente se registra como dependencia concreta; continuá lo independiente. No te quedes únicamente en un plan.
- Otros chats comparten archivos contigo. Editá solo lo asignado. No hagas git checkout/switch/reset/stash/clean ni reviertas cambios ajenos. No hagas commits conjuntos, git add ., pushes, merges, tags o acciones remotas por tu cuenta. No lances subagentes escritores adicionales.
- Tus unitarias pueden ejecutarse localmente. Builds, instalaciones, E2E y reinicios del servidor compartido se coordinan con el orquestador; se permiten en una copia aislada con artefactos y puerto propios. Si una prueba no se pudo ejecutar, indicá el comando y la razón; no la marques aprobada.
- No muestres secretos de .env.local en chat, logs, capturas o reportes. Una clave disponible no autoriza nuevas compras, campañas o consumo ajeno a esta tarea. Nunca debilites auth/RLS para que una demo parezca funcionar.
- Durante el trabajo informá avances breves: qué comprobaste, qué estás resolviendo y qué dependencia existe. Evitá pedir confirmación por cada decisión rutinaria.

## Calidad de la experiencia
La entrega debe verse coherente con NBC: jerarquía clara, espaciado consistente, controles legibles y adaptación móvil. Usá los tokens existentes y estilos separados; no rediseñes módulos ajenos. Incluí estados de carga, vacío, error recuperable y éxito; labels, foco de teclado y botones sin acciones ambiguas. Los datos demo se identifican como demo. Nunca presentes videos pendientes, llamadas, conexiones, métricas o entrenamiento inexistentes como resultados reales.

## Revisión y límite de publicación
Franco indicó: “Antes de pushear cualquier cosa, yo reviso y ahí pushean”. Esta es una condición obligatoria, no una sugerencia.

Implementá, verificá y prepará una entrega revisable antes de pedir aprobación. Primero el orquestador revisa el código y la integración; después Franco revisa el resultado y autoriza explícitamente el push del paquete concreto. “Tests pasaron”, “listo” o la aprobación de otro agente no equivalen a su aprobación. No publiques cambios nuevos mediante CLI/API para eludir esta revisión. No hagas push, merge, tag, promoción a producción ni actives despliegues automáticos sin la autorización correspondiente. La única publicación ya autorizada es el baseline inicial de I01 en sus límites documentados; no habilita cambios nuevos ni pushes.

Si la revisión pide ajustes, corregí dentro de tu ownership, repetí las pruebas afectadas y actualizá el reporte con una nueva revisión. Una aprobación anterior no se extiende a cambios posteriores. Esperá la asignación del orquestador antes de empezar otra tarea.

## Output obligatorio para Franco y el orquestador
Guardá el reporte en la ruta indicada abajo usando REPORT-TEMPLATE.md. Incluí:
1. ID, número de revisión, estado y resumen de lo implementado, distinguiendo real/demo/pendiente.
2. Archivos creados/modificados y qué cambió; referencia del candidato revisado (commit si existe, o manifiesto/hashes de los archivos propios). No inventes que existe un repositorio Git.
3. Comandos y resultados de pruebas realmente ejecutadas, fallos y pruebas pendientes; entorno y fecha. No atribuyas como propias las pruebas de una versión anterior.
4. Pasos para que Franco lo revise: URL/ruta, acciones exactas y resultado esperado. Capturas de escritorio/móvil cuando pudiste comprobar el navegador, guardadas en tu carpeta artifacts/lanes/<ID>/, sin información privada. Si no hay navegador accesible, declaralo.
5. Esquema/migraciones y estado propuesto/probado/aplicado; endpoints con método, auth, payload y errores; nombres de variables sin valores; dependencias de otros lanes.
6. Feature y handoff actualizados. Un bloque AInnovate listo para consolidar en CHANGELOG (fecha, tipo, archivos, descripción y request), más los cambios exactos pendientes en DB_SCHEMA, API_DOCS, arquitectura y lookup. El orquestador es el único escritor de esos docs globales; no marques esa consolidación como completada antes de que ocurra.
7. Checklist de aceptación, riesgos concretos y pendientes. Estado de revisión técnica y aprobación de Franco por separado. Push: NO EJECUTADO, salvo autorización posterior comprobable.
8. Una próxima tarea sugerida; no la empieces.

En tu respuesta final mostrá un resumen útil, los pasos de revisión y la ruta del reporte. No cierres con “todo listo” si solo hay mocks, migraciones sin aplicar o validación pendiente. Si falta una aprobación, explicá que la exige la instrucción de Franco y señalá el candidato concreto que ya puede revisar.

## Tu entrega asignada
Tarea: docs/lanes/tasks/K01-academy.md
Feature: docs/features/academy.md
Handoff: docs/lanes/academy.md
Reporte: docs/lanes/reports/K01.md
Evidencia propia: artifacts/lanes/K01/

Empezá por las lecturas, verificá el estado y ejecutá K01. Avisá con un plan breve y concreto; no esperes aprobación adicional para el trabajo local ya asignado. Entregá el candidato revisable y respetá el límite de push/publicación.
```

## Cómo volvemos a coordinar

Cuando termine un lane, mandá al orquestador: «Terminó C01. Leé docs/lanes/reports/C01.md y revisá la entrega». Cambiá el ID por el que corresponda. Los archivos ya están compartidos: no hace falta copiar el reporte entero.

El orquestador hace revisión técnica e integración. Después te presenta pasos de revisión y el paquete exacto. Vos aprobás explícitamente su push cuando lo hayas revisado. La autorización identifica tarea/revisión y destino; si hay nueva publicación, también ese candidato y entorno. Antes de publicar se comprueba que no se agregaron cambios ajenos desde la revisión.
