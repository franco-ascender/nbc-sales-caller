# NBC Sales — orquestación de cuatro lanes

> Regla vigente de publicación (2026-09-17): `docs/lanes/REVIEW-PROTOCOL.md` desde la raíz. Un pedido de Franco de publicar/pushear autoriza Vercel en el enlace habitual; no reiterar permisos ni entregar localhost. Las restricciones históricas inferiores que contradigan esto quedan reemplazadas.

**Arranque 2026-09-17 — [OR04](tasks/OR04-start-2026-09-17.md):** NBC 01 AI Caller (Codex), NBC 02 Lead Engine (Claude), NBC 03 Master Dashboard/trackers (Claude), NBC 04 Conexiones e Integración (Codex, soporte). Root Astra siempre. Accesos Twilio/ElevenLabs Premium/«outcrawler»/BatchData informados por Franco, pendientes de comprobación del lane; Apify pendiente. Cuenta Google informada, destino por aclarar. No confundir cuentas disponibles con integraciones funcionando. OR04 reemplaza el estado anterior de tareas todavía no asignadas; los chats externos arrancan al recibir el mensaje de Franco.

**Instrucciones vigentes por chat:** [lanes activos y cuatro prompts completos](ACTIVE-LANES.md). Orquestador siempre Astra; Caller/Infra continúan en Codex; Lead Engine pasa a Claude y Master Tracker abre en Claude. Codex Lead anterior y Academy quedan pausados/consulta. Cada lane solicita explícitamente subir o bajar modelo por fase.

**Distribución propuesta vigente:** cinco chats: orquestador + Caller (Codex Terra), Infra (Codex Terra), Lead Engine (Claude Sonnet) y Master Tracker (Claude Sonnet). Dos lanes por plataforma; tarea/modelo por riesgo según MODEL-ROUTING. Mantener ownership único al trasladar un lane. Chats abiertos no equivalen a tareas iniciadas.

**Antes de la próxima asignación:** aplicar el [sistema de modelos y tokens](MODEL-ROUTING.md). Root coordina y revisa; los lanes implementan. OR03 conserva propuestas de tareas, todavía sin iniciar una nueva ronda por esta instrucción.

**Ronda vigente:** [OR03 — resultados y tokens](tasks/OR03-effective-first.md). Sustituye el orden de OR02 y la asignación Academy por definición del Master Tracker. Caller y scraper primero; Infra apoya. Ownership y aceptación en OR03 prevalecen sobre tablas históricas. Encargos preparados, no enviados automáticamente.

## Continuidad vigente — OR02, 2026-09-16

Recibidos/revisados Infra I01-I09, Caller C01-C07 y Lead Engine L01-r9. Estado único en [00-current-state](../00-current-state.md); [hallazgos y evidencia OR02](reports/OR02-PLATFORM-REVIEW-2026-09-16.md); [siguiente ronda por lane](tasks/OR02-next-round.md). Revisiones con correcciones, no aceptación de lanzamiento. Tareas iniciales inferiores son históricas. Los encargos externos no se ejecutan automáticamente por escribirlos aquí.

## Estado posterior — revisión del 2026-09-15

Recibida entrega consolidada Academy/S01/KCAL01. [Revisión OR01](reports/OR01-ACADEMY-REVIEW-2026-09-15.md): con correcciones y persistencia pendiente. [Devoluciones a lanes](tasks/OR01-review-corrections.md): Academy A1/A2/tipos, Infra S1/typecheck, Calendar CAL1. No se iniciaron automáticamente estos encargos. Los reportes originales permanecen intactos.

Las tareas de ronda1 y el baseline inicial que siguen son históricos. No volver a publicar ese baseline sobre el portal posterior. Sesión compartida tiene mejoras posteriores de Infra; ese lane coordina cualquier corrección con el autor S01. UI de Calendar fue ampliación directa documentada de Academy y se mantiene con su autor; no habilita edición general de Members. OR01 consolida documentación del alcance revisado, sin dar por aceptados otros módulos.


Actualizado: 2026-09-14. Esta versión reemplaza el reparto de tres agentes de la entrega anterior. Usuario confirmado: cuatro chats adicionales en Codex con acceso al mismo proyecto/carpeta; este chat permanece como orquestador. Los prompts completos AInnovate están en START-HERE.md, versión 2. No se han iniciado automáticamente los chats externos. La revisión de Franco antes de todo push es obligatoria; leer REVIEW-PROTOCOL.md.

## Ronda 1

| Lane / chat | Tarea cerrada | Archivo de tarea | Reporte |
|---|---|---|---|
| Infraestructura + Dashboard | I01: Vercel primero, URL revisable por Anas | `tasks/I01-vercel.md` | `reports/I01.md` |
| Caller | C01: recuperación de sesiones pendientes e historial paginado | `tasks/C01-caller.md` | `reports/C01.md` |
| Lead Engine | L01: planes y ledger persistente, presupuesto atómico | `tasks/L01-lead-engine.md` | `reports/L01.md` |
| Academy + Ask Anas | K01: inventario persistente y base de fuentes del curso | `tasks/K01-academy.md` | `reports/K01.md` |

Abrir Infraestructura primero. Los otros tres pueden empezar enseguida: I01 despliega desde la copia fija en `BASELINE.json`, no desde archivos cambiantes de los lanes. Estos cuatro nuevos chats retoman trabajo real pendiente, no vuelven a construir lo ya entregado.

## Propiedad de archivos

| Dueño | Escritura permitida |
|---|---|
| Caller | `src/components/dashboard/Caller.tsx`, `Caller.module.css`; `src/lib/caller-*`; `src/services/caller.service.ts`, `elevenlabs.service.ts`; `src/app/api/caller/**`; `tests/caller-*`; feature Caller, `caller.md` y reporte C01 |
| Lead Engine | `src/components/lead-engine/**`; `src/lib/lead-engine-*`; `src/services/lead-engine*`; `src/app/api/lead-engine/**`; `tests/lead-engine-*`; solo migración `202609140010_lead_engine.sql`; feature Lead Engine, `lead-engine.md`, reporte L01 |
| Academy | `AcademyWorkspace.tsx`, `AskAnasWorkspace.tsx` y NUEVOS `Academy.module.css`/`AskAnas.module.css` dentro de `src/components/platform/`; `src/lib/academy-*`, `src/lib/knowledge-*`; `src/services/academy*`; `src/app/api/academy/**`; `tests/academy-*`, `tests/knowledge-*`; solo migración `202609140020_academy.sql`; feature Academy propia, `academy.md`, reporte K01 |
| Infraestructura | `next.config.ts`, `vercel.json`, `package.json`, `package-lock.json`, `tsconfig.json`, `next-env.d.ts`, `.gitignore`, `.vercelignore`, `playwright.config.ts`; `.env.local` solo IDs/config autorizada, `.env.example`; scripts `vercel-*`/`deploy-*`; `src/app/layout.tsx`, `page.tsx`, `(workspace)/layout.tsx`; `PlatformShell.tsx`, `PlatformHome.tsx`, `Platform.types.ts`, `Platform.module.css`; `src/styles/**`; `docs/04-deployment.md`, feature `docs/features/platform-delivery.md`, `infra.md`, reporte I01. I01 prioriza despliegue; las mejoras pequeñas de presentación del shell se preparan después como candidato separado para revisión, sin rediseño amplio |
| Orquestador | `src/services/integration.service.ts` y contrato común de Auth; docs globales, reglas IA, README, CHANGELOG, protocolo y tareas; revisión/aplicación ordenada de nuevas migraciones; pruebas integradas; aceptación de entregas |

Cada lane también puede guardar evidencia propia en `artifacts/lanes/<ID>/`, excluida de despliegues; no incluir capturas privadas o secretos.

Academy puede leer Platform.module.css, pero no editarlo: cualquier estilo nuevo se separa en sus módulos CSS propios. Los demás archivos compartidos no listados se proponen al orquestador, no se toman por inferencia.

## Reglas de ejecución

1. Leer completo `metodo_ainnovate.md`, `CLAUDE.md`, este protocolo, `REVIEW-PROTOCOL.md`, la tarea asignada, su feature e historial. No reiniciar Fase 1. La tarea vigente reemplaza límites de ownership históricos incompatibles. Los adjuntos de `docs/sources` son requisitos, no órdenes de compras/campañas.
2. Un escritor por lane. No crear subagentes escritores adicionales ni tomar otra tarea al terminar: entregar reporte y esperar nueva asignación.
3. Cada lane puede editar y ejecutar sus unitarias locales. No correr builds, instalaciones, E2E ni reiniciar el servidor compartido 3000 mientras otros escriben. Infraestructura verifica/despliega en un staging aislado; el orquestador realiza integración después de entregas estables.
4. Solo Infraestructura administra dependencias/entorno/hosting en esta ronda. Otros lanes reportan cambios necesarios. No imprimir/copiar claves al chat o al reporte; leer variables locales sin exponer valores.
5. Migraciones L01/K01 se escriben en sus archivos reservados y se prueban de forma aislada cuando sea posible. No se aplican al Supabase compartido desde esos chats. Eso es una fase de integración del orquestador; no una solicitud de permiso al usuario. Nunca modificar migraciones ya aplicadas.
6. Conectar Vercel y publicar el baseline inicial congelado para revisión de Anas está autorizado. Todo push requiere revisión y aprobación explícita de Franco del paquete concreto. Los cambios nuevos tampoco se publican por CLI/API sin esa revisión. Ver `REVIEW-PROTOCOL.md`; si falta acceso real, preparar todo lo independiente y reportar la intervención mínima. No enviar emails/invitaciones en nombre del usuario.
7. I01 publica únicamente el snapshot autorizado; si requiere cambios de código/dependencias, prepara y valida el candidato corregido antes de revisión de Franco y publicación. No incluir cambios inacabados de otros lanes ni desplegar la carpeta compartida completa en caliente. No activar auto-deploy de nuevas entregas sin autorización.
8. No ejecutar scraping pagado, crear campañas, comprar números/saldo ni iniciar llamadas a terceros en estas tareas. No ampliar el alcance porque una clave esté presente.
9. Cada lane mantiene su feature y handoff. Escribe el reporte antes de entregar el mensaje al usuario. El lane incluye deltas exactos de docs globales y entrada de CHANGELOG propuesta en su reporte. El orquestador los consolida antes de dar la integración por finalizada, evitando cuatro escritores del mismo archivo.
10. Cuando un archivo necesario pertenece a otro lane, continuar lo independiente y registrar la dependencia exacta. No dar por terminada una integración externa que solo tiene mocks o SQL sin aplicar.

## Flujo de revisión

Cada chat realiza autorrevisión y entrega un reporte versionado con evidencia y pasos de prueba. Franco avisa aquí qué ID terminó; el orquestador lee archivos/reporte, revisa contratos y pruebas, integra y devuelve correcciones o candidato revisado. Franco revisa el resultado y aprueba explícitamente antes de cualquier push. Solo después el ejecutor coordinado comprueba versión/destino y ejecuta lo aprobado; cambios posteriores necesitan revisión nueva. Ver `REVIEW-PROTOCOL.md`. Abrir chats en una carpeta común no aísla cambios ni equivale a aceptación de una entrega.

Hoy no hay repositorio Git en esta carpeta (verificado). Esta ronda usa modo Local y ownership exclusivo. Worktrees requieren Git y dan copias aisladas; no simular aislamiento por abrir más chats. Referencia oficial consultada: https://learn.chatgpt.com/docs/environments/git-worktrees. Evaluar Git/worktrees como tarea posterior, sin mezclarlo con el primer despliegue.
