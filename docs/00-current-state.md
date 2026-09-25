# NBC Sales — estado actual y prioridades

**Login reparado y probado 2026-09-17:** navegador con credencial existente llegó a Overview y Sign out; sesión autenticada200, anónima401, alias estable durante prueba. Producción carecía de configuración auth que sí estaba en preview. Evidencia `artifacts/orchestrator/login-repair-20260917/verification.json`; detalles en reporte LOGIN-REPAIR. La validación anterior /200 no acreditaba login completo. **Git:** repositorio local main inicializado, todavía sin commit/remoto; GitHub pendiente del nombre/acceso a la otra cuenta u organización elegida por Franco (no fcappanera).

**Reparación de acceso 2026-09-17:** alias habitual comprobado por root sin cookies: /200 y /api/workspace/session401, sin redirect Vercel. Regla simplificada de publicación en REVIEW-PROTOCOL: publicar lo solicitado en el mismo enlace, sin permisos repetidos ni localhost como entrega. Detalle operativo en docs/04-deployment.md; referencias de deploy anteriores conservan fecha histórica.

> Regla vigente de publicación (2026-09-17): `docs/lanes/REVIEW-PROTOCOL.md` desde la raíz. Un pedido de Franco de publicar/pushear autoriza Vercel en el enlace habitual; no reiterar permisos ni entregar localhost. Las restricciones históricas inferiores que contradigan esto quedan reemplazadas.

**Arranque 2026-09-17 — [OR04](lanes/tasks/OR04-start-2026-09-17.md):** NBC 01 AI Caller (Codex), NBC 02 Lead Engine (Claude), NBC 03 Master Dashboard/trackers (Claude), NBC 04 Conexiones e Integración (Codex, soporte). Root Astra siempre. Accesos Twilio/ElevenLabs Premium/«outcrawler»/BatchData informados por Franco, pendientes de comprobación del lane; Apify pendiente. Cuenta Google informada, destino por aclarar. No confundir cuentas disponibles con integraciones funcionando. OR04 reemplaza el estado anterior de tareas todavía no asignadas; los chats externos arrancan al recibir el mensaje de Franco.

**Instrucciones vigentes por chat:** [lanes activos y cuatro prompts completos](lanes/ACTIVE-LANES.md). Orquestador siempre Astra; Caller/Infra continúan en Codex; Lead Engine pasa a Claude y Master Tracker abre en Claude. Codex Lead anterior y Academy quedan pausados/consulta. Cada lane solicita explícitamente subir o bajar modelo por fase.

**Antes de la próxima asignación:** aplicar el [sistema de modelos y tokens](lanes/MODEL-ROUTING.md). Root coordina y revisa; los lanes implementan. OR03 conserva propuestas de tareas, todavía sin iniciar una nueva ronda por esta instrucción.

Actualizado por el orquestador el 2026-09-16. Fuente vigente: [revisión OR02](lanes/reports/OR02-PLATFORM-REVIEW-2026-09-16.md), con [Academy OR01](lanes/reports/OR01-ACADEMY-REVIEW-2026-09-15.md). Leer antes de usar estados iniciales del proyecto como actuales.

**Enlace de revisión:** https://nbc-sales-nbc-sales.vercel.app . Verificado por GET a las15:38UTC: L01-r9, READY/staging;234 archivos del manifiesto coinciden localmente. Es preview, no aceptación de lanzamiento comercial.

| Área | Disponible según código y evidencia | Siguiente dependencia |
|---|---|---|
| Portal NBC | Login general, roles, Members/onboarding, soporte/chat, Overview y temas, Settings | Correcciones de concurrencia/sesión; roadmap oficial y acceso por compra pendientes |
| Caller | CRM privado, import/listas/pipeline/notas,55 pruebas de lane históricas, Analytics18widgets, voz de navegador y herramientas admin | Corregir recovery/drafts/audio; telefonía y cola real aún no implementadas |
| Lead Engine | Planes, carpetas y dry-run persistentes; SQL aplicado con evidencia aislada | Guard L-AUTH corregido localmente; proveedores, precio y verificación reales pendientes |
| Academy/Ask Anas | Editor admin/portadas locales, importación, preview y fuentes | Correcciones OR01; SQL/Storage, contenido y catálogo de alumnos; sin respuestas Ask Anas |
| Calendar | Grilla mensual y sesiones NBC/feed preparado | Correcciones selección/reintento; Google externo pendiente |
| NBC Credits | Wallet/ledger, asignaciones manuales, Usage y adaptador Checkout/webhook | Tarifas, Stripe real, débitos y ciclo comercial pendientes |

## Validación actual

188 unitarias pasan tras la entrega local L02; typecheck global pasa tras corregir T1. L-AUTH está corregido localmente, pendiente de publicación. [Evidencia L02](lanes/reports/L02.md). Las reproducciones OR02 detectaron L-AUTH (ahora corregido localmente), recovery Caller trabado y carreras/reintentos en Members (todavía abiertos). No son pruebas con DB/proveedor reales. Siete archivos de migraciones aplicadas coinciden con sus hashes históricos; no se reaplicaron ni se consultó DB en OR02.

## Orden de trabajo — actualización de Franco

«Don't be cute, be effective». Caller y scraper avanzan en paralelo; Academy/Ask Anas y mejoras estéticas quedan en pausa.

1. **C08 Caller:** llamada telefónica real a número propio, estados y resultado persistentes, recuperación, DNC y límites. Clonar voz no bloquea el piloto.
2. **L02 Lead Engine:** búsqueda real útil, objetivo hoy sujeto a acceso y prueba concreta. L-AUTH ya corregido localmente; sigue contrato/precio Apify y ejecución acotada. `APIFY_API_TOKEN` no está configurado en el chequeo local. Discovery no equivale a verificar el celular del dueño.
3. **TR01 Master Tracker:** antiguo lane Academy pasa a definir métricas/fuentes mientras llega la referencia de Anas. Se integra al portal existente.
4. **I10 Infra:** auth, typecheck, sesión e integración de esos recorridos. Otros hallazgos siguen en backlog salvo que bloqueen el objetivo.

**Costo transversal:** Franco reporta $400 en tokens en dos días; pendiente identificar proveedor y separar desarrollo de operación NBC. Aplicar encargos incrementales, lecturas dirigidas, evitar trabajo duplicado y reservar modelos costosos para tareas que lo justifiquen. No afirmar ahorro medido ni límites técnicos aún configurados.

Encargos vigentes: [OR03 — resultados y control de tokens](lanes/tasks/OR03-effective-first.md). OR02 conserva el backlog, ya no fija el orden. Los chats externos no reciben mensajes automáticamente; Franco comparte el encargo y el orquestador revisa los reportes. Se mantiene revisión de Franco antes del push y coordinación de publicaciones.
