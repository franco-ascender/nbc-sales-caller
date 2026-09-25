# Plataforma de miembros NBC — I02, revisión 1

## I02-R4 — navegación de la mentoría

**Publicado y verificado:** https://nbc-sales-nbc-sales.vercel.app/, deployment `dpl_CvvZZYvjp8nx84xQqvujyk3mrJER` READY. Build y seis escenarios reales locales/HTTPS pasan (desktop/móvil, borrador, completar, icono/label, rutas, créditos fijos, revisión staff y auth). Dos cuentas temporales por ejecución eliminadas con sus datos. Snapshot de 109 archivos conserva C02-R1 + K01-R3. Evidencia final `artifacts/lanes/I02/navigation/vercel-checks.json`, capturas y reporte I02-R4. Sin cambios a respuestas, saldos o credenciales de Anas/Elias.

Franco solicita reemplazar Members por Start Here (icono de comienzo), con dos preguntas provisionales y transición a Your Roadmap (icono de mapa) al completar. Sin roadmap cargada se muestra exactamente “Roadmap charging”. Las respuestas no constituyen una roadmap. Calendar y Mentor Chat pasan a rutas laterales independientes; Support queda como acceso junto al pie NBC workspace, también accesible en móvil. NBC Credits pasa al extremo derecho de la cabecera, saldo real del usuario conectado y enlace a historial/asignación; desaparece de los tabs internos. Se conserva control de estudiantes por staff en un bloque secundario.

Se reutiliza onboarding existente sin migración ni preguntas/formulario definitivo inventados. Resumen autenticado de solo usuario actual (completed y available) para shell, evitando mezclar saldos/perfil del estudiante inspeccionado con el del admin. Actualizar resumen tras guardados y navegación, limpiar al salir. Sin roadmap simulada o generación pagada. Publicar corrección dentro de autorización vigente; preservar snapshots de otros lanes ya publicados y verificar flujo desktop/móvil, persistencia real, navegación y login general.

## I02-R3 — inicio de sesión en el enlace principal

**Publicado y verificado:** https://nbc-sales-nbc-sales.vercel.app/, deployment `dpl_7pUFo2MZ8vm5jLKEM1ifX7nRBuGi` READY. 19 checks locales y los mismos 19 sobre HTTPS pasan con cuentas reales, sin interceptar requests. Login requerido en raíz y rutas directas; ambos admins conservan acceso y Members no pide un segundo login. Capturas/evidencia en `artifacts/lanes/I02/login/`. No cambios de DB ni contraseñas; push no ejecutado.

Franco pide que el enlace normal de Vercel muestre login y que no se entre directamente al dashboard. Se integran de forma acotada los componentes WorkspaceAccess ya preparados localmente: raíz envuelta en acceso, validación Auth/membresía vía API de servidor, Members usa la misma sesión, shell con logout. Se elimina la excepción de demo para que toda página muestre login sin sesión. Sesión solo en memoria: nueva pestaña/recarga vuelve a pedir login; navegación interna conserva sesión. APIs privadas mantienen sus verificaciones de servidor y no se publican datos privados en HTML. No se modifica autorización de Caller ni de otros módulos.

Publicación autorizada como corrección de la entrega activa: snapshot I02-R2 desplegado más archivos de login/shell revisados y congelados explícitamente, sin incorporar funcionalidades C02/Academy/Lead Engine concurrentes. Pruebas de acceso anónimo por rutas, contraseña incorrecta, ambos admins, Members sin segundo login, logout y nueva pestaña; build aislado y repetición HTTPS en Vercel. Evidencia `artifacts/lanes/I02/login/`.

## Activación autorizada — revisión 2

**Completada:** Members publicado en https://nbc-sales-nbc-sales.vercel.app/members, deployment `dpl_GyLb1ocx3PZksRSW2nvE7GTn8RDi` READY. Migración aplicada, ocho tablas RLS verificadas y dos membresías admin activas. Login real Anas/escritorio y Elias/móvil; 14 checks navegador y 12 de persistencia/Auth/DB, incluidos créditos por PostgREST concurrente. Tres cuentas de prueba y sus datos eliminados. Evidencia en `artifacts/lanes/I02/activation/`; [reporte revisión 2](../lanes/reports/I02.md). No emails ni cargos. Estados parciales debajo son historia de la revisión 1.

Franco instruyó explícitamente publicar en Vercel y hacer lo necesario para activar ambos accesos. Esta instrucción posterior autoriza aplicar la migración de Members, activar las dos membresías admin y desplegar el candidato I02 probado, sin esperar otra aprobación. Se comprobarán permisos y persistencia sobre Supabase real y acceso por HTTPS. Se preservan los módulos ajenos y el snapshot aislado. Evidencia nueva bajo `artifacts/lanes/I02/activation/`; no se enviarán emails ni se expondrán contraseñas en artefactos públicos.

La inspección remota detectó C01-R1 publicado después de I01 (`dpl_FPv9BGxD1u8eukenxRV3YSLXp1iW`). Para conservarlo se construirá desde su archivo congelado verificado `ae073f13ac5ff86b23f9c4eb99a19be88de7b8aafaab48e434049e495701a3e6` más los nueve archivos runtime I02 previamente probados. No se copia el workspace mutable de otros lanes. Se repite build del conjunto y comprobación de APIs públicas/privadas.

## Historial de alcance y revisión 1

Estado histórico antes de autorización de publicación: **PARCIAL CON DEPENDENCIA**, 2026-09-14. Amplía I01 para membresía, roles, onboarding, créditos y calendario/comunicación. Los pendientes de migración/activación/publicación de esta sección fueron resueltos en revisión 2 según el bloque superior.

## Objetivo y flujo

Una persona con acceso al programa inicia sesión → completa perfil, negocio, objetivos y preguntas → accede a su espacio de miembros → consulta sesiones, habla con su coach y abre tickets → consulta créditos y movimientos. Admin gestiona acceso/asignación; coach acompaña únicamente estudiantes asignados; estudiante accede únicamente a su información. Se conservan las herramientas existentes y su autorización del operador hasta integración explícita por sus propietarios.

## Alcance del candidato

Nuevos archivos `src/lib/member-*`, `src/services/member-*`, `src/components/members/**`, `src/app/(workspace)/members/**`, `src/app/api/members/**`, `scripts/deploy-member-*`, `tests/member-*` y migración nueva `202609140030_members.sql`. Shell añade enlace a Members, sin modificar módulos de Caller/Academy/Lead Engine ni `integration.service.ts`. Documentación propia I02, handoff infra y evidencia `artifacts/lanes/I02/`. No escribir docs globales del orquestador.

API valida Bearer mediante Supabase Auth getUser; luego membresía activa persistida en tabla del servidor. Nunca confía en rol/owner/email del cliente. Roles: admin, coach, student. Sin matrícula automática por signup. Estudiante tiene un coach asignado; coach ve solo sus estudiantes. Admin puede supervisar soporte y asignaciones. Sin datos privados cargados antes de login ni selector de rol que cambie permisos. Sesión de navegador en memoria; UI se limpia al salir.

Onboarding: nombre visible, empresa, zona horaria IANA, objetivo y preguntas. Guardar borrador y completar son acciones distintas. Preguntas son datos privados, no prompts ejecutables. Visibilidad: miembro, coach asignado y admin.

Calendario: carga manual por admin/coach de sesiones grupales o individuales, fecha UTC, zona horaria para visualización, URL HTTPS de reunión; estudiante solo recibe grupo o sus sesiones. No integración automática Google/Zoom ni creación de reuniones. Links privados solo se retornan tras autorización. No agenda ficticia.

Mensajes: conversación persistente estudiante/coach asignado, con lectura por admin; texto plano, límite de tamaño, historial paginado y actualización manual. No reemplazo completo de Slack: canales, adjuntos, notificaciones y tiempo real pendientes. Tickets: título, descripción y estado open/resolved; estudiante crea y lee los suyos, coach los asignados, admin todos. Sin emails automáticos.

Créditos: unidades enteras NBC, saldo inicial cero, libro de movimientos inmutable. Solo admin puede otorgar crédito con razón e idempotency key; reservas/liquidación/liberación por funciones de servidor para integración futura. Wallet bloqueada transaccionalmente: no saldo negativo ni doble cobro por retry. Sin conversión USD, compra, expiración o créditos incluidos inventados. Ninguna herramienta existente empieza a cobrar en esta entrega. Precios/catálogo, proveedor de checkout, packs y hooks de consumo por lane requieren contrato posterior.

## Datos propuestos

`nbc_members`: auth.users PK, role, status, coach_id, display_name. `nbc_onboarding`: miembro, campos del perfil, completed_at. `nbc_calendar`: creador, destinatario opcional, título, comienzo/fin y URL. `nbc_messages`: estudiante, autor y cuerpo. `nbc_tickets`: miembro, título, cuerpo y estado. `nbc_credit_wallets`, `nbc_credit_entries`, `nbc_credit_operations`: saldos, movimientos y operaciones idempotentes. RLS en todas; sin acceso SQL directo anon/authenticated. Service role tras autorización de API. Funciones SECURITY INVOKER con EXECUTE revocado a PUBLIC/anon/authenticated.

No aplicar la migración al Supabase compartido desde este lane: entregar al orquestador para revisión/aplicación ordenada. Franco proporcionó Anas Daoud y Elias Castañeda, ambos admin. Se crearon dos cuentas Auth reales y se comprobó login; cero membresías activadas, sin invitaciones enviadas. Credenciales iniciales guardadas solo en archivo privado 0600. Script de activación preparado para después de la migración. Crear Auth por sí solo no da acceso al baseline actual, que sigue restringido por NBC_OPERATOR_EMAIL; API Members local devuelve 503 mientras falta esquema.

## Criterios de aceptación

Roles y límites verificados en tests; APIs rechazan anónimo y acceso cruzado; onboarding guarda/recupera y completitud validada; calendario respeta destinatario; mensajes/tickets con paginación y aislamiento; crédito con idempotencia/atomicidad probada o dependencia SQL explícita. UI inglés con estados vacío/carga/error/éxito y diseño NBC, móvil sin overflow, sin proveedores/modelos/prompts visibles. Build/E2E en snapshot aislado con hashes propios, no interferir con puerto 3000. No push/deploy ni cargos.

## Reglas todavía necesarias

Créditos incluidos por programa, precio por acción, recargas/expiración, proveedor de cobro y señal confiable de compra; horarios/enlaces reales y coach asignado por alumno; comportamiento esperado que hoy depende de Slack. La primera base permite avanzar sin afirmar esas integraciones. El branding NBC se aplica al nuevo espacio: ocultar proveedores/prompts en todos los módulos y conectar sus permisos/consumo requiere integración por sus lanes. No es una plataforma multiempresa ni un reemplazo completo de Slack.

### Validación SQL aislada

No hay PostgreSQL/Docker nativo en el entorno. Se comprobó sintaxis, restricciones y funciones con PGlite (PostgreSQL WASM) instalado solo como herramienta efímera bajo `/private/tmp`; no se añadió al package.json ni lockfile de NBC. Pasaron asignación/reintento, rechazo de créditos insuficientes, reserva/liquidación/liberación y permisos. Esta prueba de una conexión no acredita concurrencia entre sesiones ni integración real con PostgREST/Auth. La prueba nativa concurrente y aplicación compartida siguen pendientes del orquestador.

### Resultado de validación

Build de producción y TypeScript en baseline congelado + archivos propios; 9 unitarias de validación, 8 de servicio con transporte simulado; 13 comprobaciones navegador desktop/móvil y 2 de staff. Datos autenticados de navegador interceptados e identificados DEMO; no prueban persistencia remota. Anónimo GET/POST Members rechazado por API real local. Corregidos durante validación: sintaxis CASE en PL/pgSQL, ID de ticket al cambiar estado, y envío prematuro del onboarding al avanzar al último paso. Manifiesto y logs finales en `artifacts/lanes/I02/`.
