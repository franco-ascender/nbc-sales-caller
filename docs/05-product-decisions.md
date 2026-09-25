# Decisiones de producto y descubrimiento

**Decisión vigente 2026-09-16:** «Don't be cute, be effective». Priorizar Caller telefónico, scraper real (objetivo hoy condicionado a insumos) y Master Tracker según referencia pendiente. Academy/Ask Anas y estética en pausa. Franco reporta $400 en tokens en dos días; pendiente desglose, sin presupuesto numérico nuevo acordado. [OR03](lanes/tasks/OR03-effective-first.md) define tareas y reducción de trabajo duplicado; no implica ahorro medido ni topes técnicos ya activos.

> Actualización de alcance Academy/S01/KCAL01: ver la sección de consolidación OR01 del 2026-09-15 al final. Las secciones anteriores conservan el estado histórico; no describen por sí solas toda la plataforma actual.

Actualizado: 2026-09-14. Este registro separa lo decidido de lo pendiente.

## Confirmado

| Tema | Decisión | Fuente |
|---|---|---|
| Producto comercial | Servicio revendible a agencias/clientes | Usuario y brief |
| CRM | Integración con GoHighLevel | Usuario |
| Visibilidad | Dashboard propio con reportes y desglose | Usuario |
| Selección técnica | Next.js + TypeScript + Supabase aprobados; voz abierta | Usuario |
| Primer producto | ISA para leads entrantes | Brief |
| Diferenciador | Metodología de Anas, voz y rapidez conversacional | Brief |
| Mercado e idioma | Estados Unidos, inglés | Segundo mensaje del usuario |
| Próxima entrega | Dashboard demostrable y conexión de prueba con GoHighLevel | Segundo mensaje del usuario |

## Decisiones pendientes, en orden de dependencia

| Pregunta | Por qué afecta al diseño |
|---|---|
| ¿Quién es el primer cliente y vertical? | Determina el piloto comercial; no bloquea dashboard ni pruebas técnicas. País e idioma ya definidos |
| ¿Qué cita cuenta como resultado y qué califica a un lead? | Define el flujo y permite medir éxito |
| ¿Qué evento de GoHighLevel dispara el contacto? | Define elegibilidad, tiempos y prevención de llamadas duplicadas |
| ¿Llamada primero, texto primero o reglas según contexto? | Define el alcance del piloto y la continuidad entre canales |
| ¿Qué ocurre si no atiende, pide una persona o solicita no continuar? | Define reintentos, salida y derivación |
| ¿Anas necesita su voz exacta desde el primer piloto? | Permite acordar cómo resolver el conflicto entre fidelidad y latencia |
| ¿Quién configura y opera cada cuenta? | Define permisos, onboarding y autonomía del cliente |
| ¿Qué reportes necesita NBC y cuáles necesita el cliente? | Define las vistas y el significado de cada métrica |
| ¿Cuál es el volumen y concurrencia esperados? | Permite dimensionar pruebas e infraestructura |
| ¿Cuándo se necesita atender al sector médico? | Determina requisitos de datos y contratos para ese despliegue |

El usuario confirmó que todavía no conoce el negocio ni el tipo de cita y pidió avanzar ya con dashboard e integración. Esos datos se posponen hasta el piloto comercial. El usuario aprobó Next.js + TypeScript y Supabase para datos/autenticación. Se implementó la demo y la base de integración; quedan pendientes las cuentas y credenciales para pruebas externas.

## Tensiones que debe resolver una prueba

- Rapidez de conversación frente a fidelidad a la voz de Anas: comparar ambas en la misma llamada.
- Portabilidad frente a capacidades exclusivas: mantener separados los activos propios y documentar dependencias reales.
- Retención de llamadas para coaching frente a restricciones de datos: definir qué puede almacenarse y para qué uso.
- Tres productos frente al primer lanzamiento: validar primero el recorrido comercial del Producto 1, conservando las necesidades futuras como contexto.

## Material que falta

El brief propone reunir las mejores llamadas comerciales por vertical y audio limpio de Anas. Todavía no hay material recibido. La cantidad y calidad necesarias para clonar la voz se comprobarán con los candidatos elegidos.

También faltan el guion comercial, objeciones y respuestas autorizadas, criterios de calificación, configuración real de GoHighLevel, calendario y destino de las derivaciones.

## Actualización posterior

- Referencias visuales NBC aportadas por el usuario: azul/blanco/amarillo. Paleta aplicada; logo exacto pendiente de archivo local.
- El usuario ya solicitó acceso a GHL y avisará cuando lo reciba.
- Infraestructura: Supabase y Vercel, con tokens API por preferencia explícita. Equipos/proyectos se identificarán al disponer de esos tokens.
- Credenciales preparadas para OpenAI, Anthropic (Claude) y ElevenLabs; su configuración no activa integraciones ni fija el proveedor final. Retell y Twilio se agregarán cuando hagan falta, según indicación del usuario.
- Prioridad posterior: continuar a nivel visual y entregar capturas para compartir; retomar funcionalidad comercial después. La guía de permisos Vercel se entrega sin nuevas modificaciones cloud durante este trabajo visual.

## Reanudación funcional — 2026-09-14

Solicitud: «bueno, ahora si, A hacer funcionar el Caller». Primer hito ejecutado: conversación de voz desde el dashboard autenticado y resultado persistente. Se consultó preferencia ElevenLabs/Retell y estado GHL; sin respuesta recibida durante la implementación se comunicó y adoptó ElevenLabs como opción inicial de prueba, aprovechando la clave existente. Esto no equivale a aprobación del proveedor comercial final.

GHL, Retell y Twilio siguen sin credenciales configuradas. Se pospone la llamada telefónica hasta tener telefonía y destino de prueba. Se usa Roger, voz estándar, y guion de calificación genérico expresamente interno. No se afirma entrenamiento de la metodología ni clon de Anas. Primer ensayo con audio sintético de 27 segundos exitoso; falta evaluación humana y casos comerciales antes de un piloto con leads.

## Plataforma NBC Sales — reunión nueva con Anas

Solicitud del 2026-09-14: master dashboard con Caller, herramientas, scraper, curso Skool y Ask Anas; mantener y avanzar el Caller, desarrollar plataforma/Academy y Lead Engine en tres lanes simultáneos. Confirmado por el usuario, sustituye la prioridad anterior de trabajar solo Caller.

Implementación de esta entrega: tres agentes internos y handoffs para continuidad en otras conversaciones. Los archivos compartidos se integran desde el orquestador. No se presupone comunicación automática con chats externos. El scope del scraper se extrae de ambos adjuntos con sus contradicciones registradas en `sources/README.md`. El brief no autoriza una campaña, compras de proveedores ni generación de listas reales.

Pendientes de datos: inventario/export y archivos autorizados de Skool, proveedor de entrega de video, estructura final curso, reglas de acceso de alumnos, corpus/respuestas de Ask Anas, primer negocio/metro/target/techo de piloto Lead Engine y contratos API/precios verificados. Los módulos pueden avanzar sin inventar esos insumos.

## Ronda de cuatro lanes — 2026-09-14

El usuario confirma conversaciones con acceso al mismo proyecto y solicita prompts para cuatro lanes con reportes al orquestador. Se elige Codex Local para esta ronda: Caller, Lead Engine, Infraestructura/Dashboard y Academy/Ask Anas. Primera tarea de Infraestructura: conectar y publicar Vercel para revisión de Anas, explícitamente autorizado. No requiere pedir nuevamente autorización genérica de despliegue. Root recibe avisos, lee los reportes compartidos, revisa e integra antes de asignar la siguiente tarea. Claude y Fable quedan disponibles, sin asignación en esta ronda.

## Revisión antes del push — instrucción posterior de Franco

Los prompts se amplían conforme a AInnovate; tareas y ownership se mantienen. Antes de cualquier push, Franco revisa y autoriza el paquete concreto. La revisión técnica del orquestador no sustituye su aprobación. Conectar Vercel y publicar el baseline inicial congelado para revisión conserva la autorización previa; código nuevo/correcciones del candidato deben presentarse y revisarse antes de publicarse. No usar CLI/API, merge, promoción o auto-deploy para eludir esa revisión. Detalle vigente: `docs/lanes/REVIEW-PROTOCOL.md` (ruta desde raíz).

Cada lane entrega evidencia, criterios de aceptación, pasos para revisión y deltas documentales; orquestador consolida CHANGELOG/esquema/API/arquitectura/lookup. Infraestructura mantiene su feature `docs/features/platform-delivery.md` y puede preparar mejoras pequeñas del shell como candidato separado después de la conexión, sujeto a revisión; no bloquea el enlace inicial por un rediseño amplio.

## Revisión recibida Academy/S01/KCAL01 — 2026-09-15

Franco entrega el reporte consolidado para continuidad del orquestador. Se registra la ampliación de Academy a editor admin/planillas/portadas/outline22 cursos y preview; sesión compartida fija12h y calendario mensual visible vacío, según encargos documentados por su lane. Los títulos de capturas son un borrador de estructura, no cursos migrados. Vimeo sigue como referencia pendiente, sin decidir ni conectar proveedor nuevo.

La prioridad funcional de Academy pasa por corregir A1/A2 y validar SQL/Storage aislados antes de habilitar guardado compartido. También se devuelven S1/CAL1/T1 a sus propietarios. La revisión visual reportada no sustituye pruebas de persistencia ni una aprobación de push. Orquestación conserva referencia única de revisión en Vercel y evita publicaciones concurrentes que pierdan avances. Detalle: `lanes/reports/OR01-ACADEMY-REVIEW-2026-09-15.md` y `lanes/tasks/OR01-review-corrections.md`.

## Reportes de tres lanes recibidos — 2026-09-16

Franco remite consolidados Infra/Members/Dashboard I01-I09, Caller C01-C07 y Lead Engine L01-r9 para continuidad. La revisión OR02 registra estado verificado y correcciones; no infiere autorización de pagos/campañas/push/deploy. Datos actuales en00-current-state.

Prioridad de corrección: suspensión de operador debe aplicarse también a Lead Engine (L-AUTH); preservar borradores y recuperación durante refresh; onboarding atómico y reintentos de eventos; cerrar OR01/T1. Próximos hitos comerciales propuestos, no iniciados: telefonía controlada Caller y proveedores/piloto Lead Engine; guardado Academy tras pruebas aisladas. No basta con comprar ElevenLabs/agregar número para convertir la cola demo en llamadas reales. Se conservan cuentas/proveedores existentes y decisiones pendientes sin compras nuevas.


## Prioridades y accesos informados — 2026-09-17

Franco solicita arranque de AI Caller, Lead Engine (objetivo operativo hoy) y Master Dashboard con trackers. Infra es soporte transversal, no producto/dashboard separado. Accesos informados: Twilio, ElevenLabs Premium, «outcrawler» y BatchData disponibles; Apify pendiente. Confirmar nombre exacto del scraper, sentido de Heygen y destino de cuenta Google antes de nuevas integraciones; no son verificaciones remotas. OR04 asigna C08/L03/TR01/I10 con modelo inicial y handoffs. No ampliar campañas por contar con acceso.
