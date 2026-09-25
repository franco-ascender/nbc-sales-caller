# NBC Sales — Visión de la plataforma

> Estado vigente de todos los lanes: [00-current-state.md](00-current-state.md), consolidado por OR02 el2026-09-16. Las secciones iniciales siguientes son historial.

> Actualización de alcance Academy/S01/KCAL01: ver la sección de consolidación OR01 del 2026-09-15 al final. Las secciones anteriores conservan el estado histórico; no describen por sí solas toda la plataforma actual.

Actualizado: 2026-09-14. Estado: dashboard demo y Caller privado de voz en navegador validados; Supabase conectado con operador, eventos y sesiones. GoHighLevel pendiente; Vercel bloqueado por permisos de creación de proyecto.

## Fuentes y autoridad

- `../metodo_ainnovate.md`: método de trabajo, documentación antes del código y validación al entregar.
- `../NBC_Voice_AI_Handoff_Brief (1).md`: contexto de Anas Daoud, funcionalidades, prioridades y posibles soluciones.
- Instrucción del Head of AI del 2026-09-12: definir juntos el stack, integrar GoHighLevel y disponer de dashboard propio con reportes y desglose de resultados. Esta instrucción prevalece sobre las alternativas técnicas del brief.

Los nombres, precios, benchmarks, fechas de lanzamiento y afirmaciones regulatorias del brief son información de referencia sin verificar. No constituyen decisiones ni hechos técnicos validados por el proyecto.

## Visión

Crear una plataforma central de NBC Sales que reúna operación comercial, Caller, Lead Engine, Academy y Ask Anas. El Caller mantiene su objetivo de aplicar la metodología comercial de Anas y conectarse a GoHighLevel; pasa a ser un módulo del producto. La migración completa del curso de Skool y una guía conversacional basada en ese contenido forman parte de la dirección confirmada, no de una integración ya realizada.

El usuario se incorpora como Head of AI. Anas es el dueño según el usuario y el responsable de metodología y evaluación de voz en el brief. NBC Voice AI identifica el módulo histórico; NBC Sales es el nombre de la plataforma principal por instrucción del usuario.

## Objetivos y prioridades

1. Responder con rapidez a los leads entrantes, calificarlos, manejar objeciones y agendar citas.
2. Conseguir una conversación natural, con poca latencia, interrupciones bien resueltas y fidelidad a la voz de Anas.
3. Mantener continuidad cuando la conversación pase de voz a texto o a una persona.
4. Hacer reutilizables la metodología, los datos curados y el estado de conversación para diferentes clientes y verticales.
5. Mostrar actividad, resultados y fallos por cliente, con trazabilidad hasta la llamada y el CRM.

El brief prioriza latencia y calidad de voz por encima del costo y la dificultad. No fija un presupuesto numérico ni autoriza contrataciones. La fidelidad de voz y la rapidez deben evaluarse juntas cuando entren en conflicto.

## Alcance por producto

| Producto del brief | Funciones | Secuencia |
|---|---|---|
| 1. ISA / Speed-to-Lead | Lead entrante, llamada inmediata, calificación, objeciones, agenda, texto y derivación humana | Primero |
| 2. Outbound y gestión de vendedores | Llamadas salientes y estadísticas de equipos humanos e IA | Posterior |
| 3. Roleplay y revisión de llamadas | Práctica contra prospectos simulados y coaching con voz de Anas | Posterior |

El brief plantea tres productos comerciales separados con metodología compartida y CRM como centro. Esto no obliga a desplegar tres sistemas técnicos independientes desde el inicio.

## Condiciones confirmadas por el usuario

- Integración con GoHighLevel obligatoria. Close no sustituye ese requisito.
- Dashboard propio, con reportes y breakdown del funcionamiento.
- Producto revendible a clientes.
- Stack aprobado: Next.js + TypeScript + Supabase. Proveedores de voz y telefonía por decidir junto al Head of AI.
- Mercado inicial: Estados Unidos; idioma: inglés (confirmado en el segundo mensaje).
- Prioridad inmediata: dashboard para mostrar a Anas y primera integración de prueba con GoHighLevel. El vertical y el tipo de cita siguen abiertos y no bloquean este hito.

## Stack técnico

| Capa | Decisión |
|---|---|
| Frontend / backend | Next.js + React + TypeScript |
| Base de datos / autenticación | Supabase NBC Caller; Auth y almacenamiento verificados |
| Estilos | CSS Modules y tokens propios |
| Conversación, voz y transcripción | ElevenLabs Agents implementado para pruebas internas en navegador; proveedor comercial por confirmar |
| Telefonía | Pendiente; sin números ni llamadas telefónicas |
| Canal de texto | Requerido por el brief; proveedor pendiente |
| CRM integrado | GoHighLevel; contrato de integración pendiente |
| Dashboard | Propio; demo navegable implementada |
| Hosting y observabilidad | Vercel elegido; creación de proyecto pendiente de permisos |

## Estado y próximo hito

| Hito | Estado |
|---|---|
| Leer fuentes y crear base documental de AInnovate | Completado |
| Definir cliente piloto, país, idioma y objetivo de cita | Estados Unidos e inglés confirmados; cliente y cita pendientes |
| Especificar y acordar alcance inicial y criterios de calidad | Borrador en `features/isa-speed-to-lead.md` |
| Probar conversación de voz | Validado en navegador con ElevenLabs y audio sintético; telefonía y calidad comercial pendientes |
| Elegir stack e inicializar aplicación | Completado: Next.js + TypeScript + Supabase |
| Dashboard demo y base de integración | Completado localmente; Supabase conectado, GHL pendiente |
| Implementar y validar piloto completo | Pendiente |

Las estimaciones de semanas del brief no son un compromiso de entrega. Por instrucción posterior del usuario, el siguiente hito es un dashboard demostrable y una prueba de integración con GoHighLevel; después se incorpora la conversación real al recorrido completo. Ver `features/dashboard-ghl-test.md`.

## Hito funcional — 2026-09-14

El usuario pide hacer funcionar el Caller. Se implementa una primera conversación de voz en navegador con login, resultados obtenidos del proveedor y persistencia. Se usa ElevenLabs como decisión de implementación provisional después de consultar preferencia y comunicar la suposición; no se presenta como proveedor comercial aprobado. Ver `features/caller-live-tests.md`. Próximo recorrido: evaluación humana, metodología/voz autorizadas y conexión de GHL y telefonía de prueba.

## Cambio de enfoque — plataforma y lanes

El usuario solicita mantener Caller, sumar Academy/Ask Anas y un scraper basado en dos especificaciones, y producir en tres o cuatro conversaciones en paralelo. Se autoriza trabajo paralelo explícitamente. Esta entrega establece Home y rutas de módulos, preparación local de importación Academy, planificación Lead Engine y mejoras operativas Caller. Documentos fuente en `sources/`; contratos y handoffs en `lanes/`.

Los datos privados reales siguen protegidos en las APIs actuales. El shell público es una estructura de desarrollo, no un login unificado ni un sistema multiempresa. Los cursos/videos aún no se migraron; Ask Anas no tiene corpus ni generación conectada; Lead Engine no ejecuta scraping ni gasto. El siguiente paso de cada módulo queda documentado, sin suponer disponibles archivos, accesos o presupuestos que no se recibieron.

## Estado de Academy, sesión y calendario recibido el 2026-09-15

Academy tiene importación por planilla/JSON, editor de cursos/módulos/clases, portadas propias locales y preview de alumno; APIs admin de inventario versionado y Storage implementadas, con SQL/bucket reales pendientes. Ask Anas muestra preparación de fuentes, sin corpus/respuestas. El portal restaura sesión12h por navegador; Calendar muestra grilla mensual aunque el feed esté vacío. Los reportes registran publicación en el alias habitual; OR01 no revalidó el alias.

Revisión del orquestador:37 unitarias pasan, typecheck global falla y cinco hallazgos agrupados requieren correcciones. La entrega es parcial para uso real de Academy. Fuente y próxima coordinación: `lanes/reports/OR01-ACADEMY-REVIEW-2026-09-15.md`. Los estados iniciales de este documento son históricos y no sustituyen los reportes nuevos; otros lanes aún requieren su revisión propia.
