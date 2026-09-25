# C06 — AI Caller visible, NBC y arrastre fluido

2026-09-15. Diseño previo a código. Franco acepta dirección C05 y solicita: prueba de voz/texto visible primero al entrar a AI Caller y ocultable, animación al hablar; colores NBC sin turquesa; drag/resize más directo, galería más amplia agrupada por tamaño con previews; corregir drag CRM; diagnosticar clonación y explicar qué falta para usar llamadas reales.

## Flujo y límites

La consola de prueba queda abierta por defecto y delante de la cola. Ready no significa micrófono conectado: Start voice test explícito conserva autorizaciones/costos; ocultar deja acceso a End cuando hay conversación. Animación lee volumen de entrada/salida del SDK durante sesión real y estado speaking/listening, no finge una llamada en standby. Texto provisional y resultado verificado mantienen contrato C01. Ninguna voz/call nueva para probar: SDK/volumen fixtures marcados y revalidación humana pendiente.

Paleta local Analytics: azul noche, azul luminoso y amarillo NBC; sin cian/turquesa. Nuevo CSS CallerCanvas para no pisar cambios concurrentes de tokens en CSS existentes. Se detectaron cinco CSS Caller modificados fuera de C05 (wrappers de tokens); se conservan en source pero no se toman automáticamente para publicar. Snapshot base último publicado + manifiesto explícito de propios cambios.

Drag compartido: captura pointer, umbral, ghost proporcional, hit testing antes/después, Escape/cancel/blur, autoscroll continuo por RAF aun con puntero quieto al borde, restauración del gesto. CRM inserta exactamente antes/después de tarjeta o al final de etapa; estados/errores/DNC/notas C04 intactos, feedback del destino. Dashboard reordena visualmente mientras se arrastra, resize sigue píxeles y se ajusta al grid al soltar. Galería18 opciones, filtros por números/gráficos y tamaños Small/Medium/Wide, previews sobre datos cargados; arrastrar desde galería hasta destino o click añade visible y permite mover. Guardado explícito y alternativas de teclado. Memoización de gráficos evita recalcular todas las series por cada movimiento del puntero.

Voces: diagnosticar suscripción/capacidades/cupos con GET read-only, comprobar entorno preview sin exponer claves. Mostrar motivo preciso y acción Refresh. Crédito de uso no equivale a permiso de clonación. Además de voz propia, admin puede enviar muestra de una persona que le dio permiso (por ejemplo Anas), con consentimiento explícito y nombre del dueño; backend valida y audita permiso. No crear un clon sin audio ni consentimiento, no adquirir plan ni números. Mantener contrato propio anterior compatible.

## Contratos/archivos

Widgets extienden catálogo cerrado de12 a18 manteniendo config/v1 y defaults anteriores. Tabla views070 admite config objeto, no requiere SQL nuevo. Nuevo helper de colocación compartido. CallerAnalytics/Charts/Drag/Board, consola Caller.tsx + nuevo CallerVoicePresence/CSS, CallerCanvas y CallerMotion CSS; lib caller-dashboard/drag; voices capabilities/clone service y rutas propias, CallerOwnVoice/Voices. Tests caller-fluid*, feature/handoff/reporte C06/artifacts propios. No shell/globales/dependencias/env editados.

Consentimiento clone: payload multipart legado ownVoiceConsent=true sigue admitido como own; alternativa voicePermission=authorized + voiceOwnerName + voiceOwnerConsent=true, service usage=true. Guard admin real. Identidad de la voz y confirmación se registran en description del job existente; hash/request siguen evitando generación duplicada. No nueva migración. IDs/clave/proveedor sensibles sólo servidor.

## Evidencia y aceptación

Validar colocación bidireccional/antes/después, cancel, rects/scroll, teclado, resize continuo/ghost y persistencia; auth/layout límites18; console default y volumen fake sin tráfico de voz; clone permisos reales de ruta/guard con transporte fixture y flags/cupos/errores; regresiones C01/C03/C04/C05. Build/browser en snapshot aislado con puertos propios. Preview autorizado para revisión en Vercel, sin push/producción; read-only diagnóstico real y cuentas temporales limpias. Reporte distingue UI disponible, navegador voz, clonación condicionada y telefonía/cola real pendiente. Consolidación global sólo propuesta para orquestador.

Diagnóstico inicial15/09 15:53 UTC: API local ElevenLabs200, Free, IVCfalse/PVCfalse,0 de3 voces,1584/10000 caracteres, agente privado inglés, record_voice=false,0 números. El GET de entorno Vercel no expone plaintext; no afirmar mismatch por valor oculto. Pendiente confirmar capacidades mediante endpoint admin del preview. Usuario consultado sobre dónde cargó créditos; avanzar UI independiente.

### Diagnóstico adicional antes de modificar voces
La documentación oficial de ElevenLabs Billing permite Voice Design en Free (hasta tres voces); la condición local `tier !== free` lo bloqueaba incorrectamente. C06 separa diseño y clonación: diseño según plan conocido/cupos disponibles; clonación según `can_use_instant_voice_cloning` y cupos. La API conserva autoridad final sobre permisos y uso. Capabilities añade campos opcionales de cupos/motivos/fecha sin exponer credenciales. No se genera ninguna voz como prueba.

Revisión de recuperación de voces: una creación ya confirmada debe poder consultarse aunque luego se llene el último cupo. Diseño consulta primero su job idempotente; formularios permiten comprobar referencias pendientes aun cuando el alta nueva esté deshabilitada. Sin generación repetida.

16:14 UTC: se publicó concurrentemente I05→L01-R5→K01-R6. C06 se recompone sobre el archive K01-R6 verificado (`a6311d01b898250f253b0158006abdea658018223fdbd2fad39aca2abe04180a`), conserva apariencia/sesión/calendar/Academy/Lead Engine y repite build/regresiones. El cambio en caller.service.ts de créditos existe solo en source compartido, fuera del snapshot publicado; no se incorpora sin el paquete del lane responsable. Pruebas del candidato ejecutadas en copia aislada para no mezclar versiones.

Revisión visual HTTPS R1: .row>button heredado volvía claro el fondo del botón primario de clonación, manteniendo texto blanco. R2 añade CallerVoiceStudio.module.css local con prioridad/contraste NBC en ambos temas; ghost CRM usa texto navy sobre blanco y target de etapa respeta --soft. Sin cambiar CSS compartidos ni API. Repetir build y recorridos afectados; mantener evidencia R1 separada.

Fuentes primarias consultadas: [ElevenLabs Billing](https://elevenlabs.io/docs/overview/administration/billing), [GET subscription](https://elevenlabs.io/docs/api-reference/user/subscription/get), [SDK JavaScript](https://elevenlabs.io/docs/eleven-agents/libraries/java-script). Diagnóstico del endpoint admin real en preview16:23 UTC confirma diseño=true, clonación=false, plan=free,3cupos; no prueba que la clave local y remota sean iguales.

## Cierre C06-R2
Publicado para revisión en https://nbc-sales-cdrvvy0sa-nbc-sales.vercel.app/caller y alias habitual. Deployment `dpl_54DpwEfF8cNcbHJi4HmieufQESio`; manifest `e82fe5a7afc4e361becc85fde8320696179fdb753034141046289a729a60dcfd`.203runtime/17deltas sobre K01-R6; nueva CSS Studio corrige contraste sin tocar globales. Build/TS,52unit,12C06browser,10C04,6C03,3C01 y14 grupos Supabase/HTTPS pasan sobre R2. Fixtures y audio sintético identificados;3 cuentas finales eliminadas (9 en total contando intentos/revisión previa),0 creación de voces/llamadas. Endpoint preview16:28 UTC confirma Free/IVCfalse/3cupos, Designtrue. Reporte C06 revisión2 y handoff contienen evidencia, fallos resueltos, globales propuestos y límites. Review orquestador/Franco pendientes; sin push/producción.
