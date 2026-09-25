# NBC Sales — reglas de trabajo

## Instrucciones vigentes de Franco

- El orquestador siempre usa Astra y coordina/revisa; los lanes implementan. Tres productos: Caller, Lead Engine y Master Dashboard con trackers. Conexiones/Integración es soporte.
- **Cuando Franco pide «pushealo», «publicalo» o «quiero verlo en Vercel», autoriza publicar ese trabajo en https://nbc-sales-nbc-sales.vercel.app.** No pedir la misma aprobación otra vez ni entregar localhost como sustituto. Leer docs/lanes/REVIEW-PROTOCOL.md: prevalece sobre restricciones históricas de tareas/reportes.
- Franco revisa en ese enlace. El equipo prepara y prueba antes de publicar. Mantener login/roles/RLS NBC; el dominio habitual debe ser accesible sin pertenecer al equipo Vercel. Verificarlo después de cada publicación.
- Coordinar una publicación a la vez y preservar avances ajenos. La coordinación es responsabilidad de agentes; no exigir a Franco administrar snapshots o conseguir permiso de otro lane. Si falta un acceso real, comprobarlo y pedir solo ese dato.
- «Push» en este contexto significa entrega visible en Vercel. Git explícito se gestiona con el repositorio existente, sin inventar commits o crear remotos innecesarios. Deploy CLI/API es válido.
- Elegir modelo por tarea según docs/lanes/MODEL-ROUTING.md. Solicitar cambio solo si se necesita y volver al base tras fase costosa. Nunca afirmar que escribir un prompt cambió el selector. Root queda Astra.

## Publicación: comando listo para todos los lanes

Desde la raíz, usar `node scripts/vercel-project.mjs --check` para comprobar acceso y `node scripts/vercel-project.mjs --deploy` para publicar el trabajo autorizado. El wrapper usa las credenciales NBC de `.env.local`, el proyecto y su equipo explícitos; no depende de la sesión predeterminada de Vercel. Estos comandos y las pruebas habituales tienen permisos persistentes en `.claude/settings.json`. Ejecutarlos directamente desde la raíz; no reemplazarlos por heredocs, `node -e` ni cadenas nuevas de exports para publicar, porque son invocaciones distintas que vuelven a requerir autorización. No imprimir secretos. No derivar a Infra solo por ser Claude. Ver `docs/04-deployment.md` para preparación y verificación.

## Ejecución

Aplicar metodo_ainnovate.md al proyecto existente, sin regenerarlo. Instrucciones recientes del usuario prevalecen. Leer estado actual y feature/contrato relevante; no reingestar todos los reportes en cada tarea. Documentar antes del código y entregar evidencia breve y verificable.

Usar Next.js + TypeScript + Supabase y CSS Modules existentes, UI en inglés y comunicación en español. Consultar docs locales de Next cuando se modifique ese framework. Tipado estricto, sin any. Proteger secretos y datos privados; no imprimir .env. No debilitar auth/RLS para una demo. Distinguir fixtures de integraciones reales.

Un escritor por módulo; no revertir archivos ajenos. Preservar migraciones aplicadas. Coordinar contratos compartidos con su dueño y resolver trabajo independiente mientras falta un insumo. La autorización de publicar no equivale a comprar números, lanzar campañas o hacer cambios destructivos ajenos al encargo.

Cada lane mantiene feature y reporte incremental; root consolida globales. Pruebas pertinentes, sin repeticiones sin motivo. Resultado al usuario: qué quedó listo, enlace comprobado y bloqueo real si existe.

## Lecturas de entrada

- docs/00-current-state.md: estado y límites reales.
- docs/lanes/ACTIVE-LANES.md y tasks/OR04-start-2026-09-17.md: ownership y encargos.
- docs/lanes/REVIEW-PROTOCOL.md: publicación sin permisos redundantes.
- docs/04-deployment.md: operación del proyecto existente, sin ejecutar scripts de snapshots históricos a ciegas.

## Tabla de lookup

| Archivos o tema | Lectura previa |
|---|---|
| Reglas de IA, `.gitignore`, `.env.example`, documentación base | `metodo_ainnovate.md`, `docs/01-project-overview.md`, `docs/02-architecture.md` |
| Alcance y decisiones | `docs/01-project-overview.md`, `docs/05-product-decisions.md` |
| Dashboard, integración de prueba, `src/`, `tests/`, `supabase/migrations/`, configuración y README | `docs/features/dashboard-ghl-test.md`, `docs/02-architecture.md`, `docs/API_DOCS.md`, `docs/DB_SCHEMA.md` |
| Plataforma, `src/components/platform/`, rutas de módulos, Academy | `docs/features/master-platform.md`, `docs/lanes/platform.md`, `docs/02-architecture.md` |
| Lead Engine, `src/components/lead-engine/`, `src/lib/lead-engine-*` | `docs/features/lead-engine.md`, `docs/sources/README.md`, `docs/lanes/lead-engine.md` |
| Trabajo paralelo, entregas y aprobación de push | `docs/lanes/README.md`, `docs/lanes/START-HERE.md`, `docs/lanes/REVIEW-PROTOCOL.md`, `docs/lanes/REPORT-TEMPLATE.md`, tarea y handoff del lane |
| Entrega inicial Vercel I01 | `docs/features/platform-delivery.md`, `docs/lanes/tasks/I01-vercel.md`, `docs/04-deployment.md` |
| Caller, sesiones reales, ElevenLabs, `config/`, `scripts/setup-caller.mjs` | `docs/features/caller-live-tests.md`, `docs/API_DOCS.md`, `docs/DB_SCHEMA.md`, `docs/03-security.md` |
| ISA, voz, texto, agenda, CRM y reportes iniciales | `docs/features/isa-speed-to-lead.md` |
| Datos y migraciones futuras | `docs/DB_SCHEMA.md`, `docs/03-security.md` |
| Endpoints e integración futura | `docs/API_DOCS.md`, `docs/features/isa-speed-to-lead.md` |
| Seguridad y permisos | `docs/03-security.md` |
| Despliegue, `.vercelignore`, `scripts/check-cloud-access.mjs` | `docs/04-deployment.md`, `docs/03-security.md`, `README.md` |
| Academy, fuentes y portadas | `docs/features/academy.md`, `docs/lanes/reports/K01.md`, revisión `docs/lanes/reports/OR01-ACADEMY-REVIEW-2026-09-15.md` |
| WorkspaceAccess y workspace-session-storage | `docs/features/workspace-session.md`, `docs/lanes/reports/S01.md`, `docs/03-security.md`, revisión OR01 |
| CalendarWorkspace y calendar-month | `docs/features/calendar-view.md`, `docs/lanes/reports/KCAL01.md`, revisión OR01 |
| Skills | `docs/SKILLS.md` |
| Estado integrado y correcciones OR02 | `docs/00-current-state.md`, `docs/lanes/reports/OR02-PLATFORM-REVIEW-2026-09-16.md`, `docs/lanes/tasks/OR02-next-round.md` |
| Contratos runtime y migraciones aplicadas | `docs/reference/runtime-contract-index.md`, `docs/DB_SCHEMA.md`, `docs/API_DOCS.md` |
| Guard Lead Engine y cierre L-AUTH/T1 local | `src/services/lead-engine-auth.ts`, `docs/lanes/reports/L02.md` |
| Selección de modelos, costos y encargos | `docs/lanes/MODEL-ROUTING.md`, `docs/lanes/model-routing-policy.json` |
| Historial | `CHANGELOG.md` y documentación afectada |

