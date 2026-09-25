# KCAL01 — revisión1 — calendario mensual visible

2026-09-15, macOS/Chrome, Next16.3.5. LaneAcademy, un escritor, sin subagentes. Asignación directa posterior de Franco: «Aunque el calendario no tenga nada todavía, debería estar igual ahí, parecido al de Skool». Estado: PUBLICADO Y VERIFICADO POR HTTPS en el mismo Vercel. La solicitud amplía ownership solo a UI de Calendar, helper/tests propios. Sin Git/commit; candidato SHA256 y snapshot en artifacts/lanes/KCAL01.

## Resultado

/calendar muestra siempre un calendario mensual7columnas/42días, incluso con0eventos, carga pendiente, error o calendario externo sin conectar. Flechas anterior/siguiente mes, Today, fechaactual destacada y selección de día. Debajo muestra las sesiones reales del día seleccionado y sus enlaces existentes; vacío honesto sin eventosdemo. Móvil conserva la grilla y muestra cantidad de sesiones; claro/oscuro y tecladoflechas/Home/End funcionan. No se cambió sidebar: Calendar ya estaba visible.

Timezone desdefeed existente; horas se agrupan por fecha del miembro. All-day usa fechas civiles y finexclusivo; sesionesmultidía aparecen en fechas solapadas. El feed sigue siendo de sesionespróximas limitado por backend existente, no historia/calendario completo; aclarado bajo grilla. Error conserva calendario y avisa si muestra datos previos. ManageNBCsessions conserva permisos existentes; studentno gestión. Auth/API/backend intactos.

Las capturas entregadas mostraban Caller: se siguió instrucción textual sobre calendario sin tocar Caller/clonación de voz. No se agregaron clases, llamadas o integración de mentoría ficticias.

## Archivos

- src/components/members/CalendarWorkspace.tsx: mensualpersistente, navegación/selección/teclado, detalle porfecha y estados.
- src/components/members/Calendar.module.css: grillaresponsive, hoy/selección/eventos ytemas usando tokensvigentes.
- src/lib/calendar-month.ts: aritméticaUTCdecalendario y agrupación porfechaTZ/intervalos.
- tests/calendar-month.test.ts, tests/calendar-month-browser.mjs: calendario/fechas/estados/permisos/navegador.
- docs/features/calendar-view.md antes decódigo, handoffacademy y estereporte. Evidencia artifacts/lanes/KCAL01.

## Evidencia

| Comando | Entorno2026-09-15 | Resultado |
|---|---|---|
| node --experimental-strip-types --test tests/calendar-month.test.ts | Local |3/3 pasan:42días/bisiesto/año, medianoche/DST, all-day/multidía/finexclusivo; unit-tests.log|
| node artifacts/lanes/KCAL01/build.mjs | Copiaaislada |build+TypeScript exit0; build.log|
| node tests/calendar-month-browser.mjs http://127.0.0.1:3028 fixture | Chrome1440/390/320 |4registros escenarios pasan: carga/0eventos/error/calendario siemprevisible,timezone/eventos/link/teclado/student, responsiveclaro/oscuro; fixture-checks.json|
| node tests/calendar-month-browser.mjs http://127.0.0.1:3028 local | Authrealadmin/read-only |2checks pasan:calendarioreal/API401, navegación/temas/móvil; local-checks.json|
| Inspecciónvisual | Screenshotsreales |Grillavacía visible, sin overflow ni pageerrors; local-calendar-desktop.png y variantesdark/mobile|
| Integridad | SnapshotI07 |219runtime;3propios superpuestos, todoajeno idéntico abaseL01-R6verificada|

No datosdemo se escribieron enDB; fixtures de sesiones solo interceptaciónHTTP de prueba. No modificaciones/instalaciones/migracionesDB, permisos, calendarOAuth o eventoscloud. No reatribuir pruebasI07/K01 a este cambio. No pruebas de calendario externo real: sigue desconectado y fuera de esta solicitud.

## Revisión de Franco

Mismo host: https://nbc-sales-nbc-sales.vercel.app/calendar. Abrir Calendar en sidebar, ver mes completo aunque esté vacío. Cambiar mes con flechas, volver con Today y seleccionar un día. Probar ancho móvil y temaoscuro. Con student no apareceManageNBCsessions. No esperar eventosde muestra ni nuevas conexiones.

## API, configuración y dependencias

GET/api/calendar existente Bearermember: events/timezone/externalStatus/checkedAt; privado/no-store,401anónimo. No cambio de contrato, queryparams, APIsmutantes, SQL/RLS ni variables. Semántica de fechas y distribución por días en cliente. NativeNBC+adaptador externo pendiente siguenexactamente igual. Conexión realde mentoría depende del lane Infraestructura y credencialesautorizadas; esta UI no larequiere para mostrarse.

Snapshotbase final L01-R6 `dpl_5GhTL4de25wzGsW68TDiFgxwjdh6`, tarSHA256 `2642d1b17075fe181f78af678d5009b1deb6791872df6d8d66a4ce822506ca4f`. Preserva C06-R2, K01-R6, L01-R6, I06/I07 y sesiónS01+I05. La publicación concurrente deL01desplazóprimera baseI07; guarddealiasimpidiósobrescribirla, se rebasóyrecompiló/reprobó. Evidenciaprimera base en superseded-i07-*. Runtime/archive/manifiestos en artifacts/lanes/KCAL01. No subirworkspacemutable ni volver a versionesprevias.

## AInnovate y consolidación pendiente

Featurecalendar-view y handoffactualizados. CHANGELOGpropuesto2026-09-15 CHANGED: calendario mensualvisible aun sin eventos, controlesmes/today/selección yfechasTZaccesiblesresponsive; archivos arriba; request «Aunque el calendario no tenga nada todavía, debería estar igual ahí, parecido al de Skool».

Deltasparaorquestador: arquitectura/lookup agregarcalendar-month→calendar-view; calendar-connection enlazar nuevaUI mensual y recordarfeedpróximoacotado; DB_SCHEMA/API_DOCS sin delta contractual; deployactualizar snapshot/alias. Consolidación global NO EJECUTADA por lane.

Aceptación: grilla vacía/carga/error, navegaciónmes/today/día, responsive/temas, roles ynoeventosficticios cumplidoslocalmente. Revisión técnicaorquestador y visualFranco PENDIENTES; deployautorizado por ordenvigente de mismoVercel. PushNOEJECUTADO, noGit/producción/migración compartida. Próxima tarea sugerida no iniciada: conectar calendarioautorizado de mentoría y confirmar cobertura temporal del feed antes de prometer mesescompletos.

## Candidato integrado de publicación

Deployment `dpl_7ze1Pm3bx5ci5QZtwNg5SCTtuEGs` READYstaging,219archivos. Runtime manifest SHA256 `cddb9514b75c87b8f2fe34f3afd72615f96322edff9a8d91c5b054e7f33a63d5`; tarSHA256 `d53f916dc53c99d72c36588474e014723e2b3769b64095506e552f540fcf8202`. MismaURL /calendar. El primer intento de acceso recibió302 mientras propagaba excepciónVercelpreviamenteautorizada; authdeaplicación no cambia. VerificaciónHTTPS final abajo. En herramientaslocales se corrigió un NameError delscriptdocumental(importPath); snapshotycompilación no afectados.

### Verificación final

2026-09-15T19:58:36.537Z: `node tests/calendar-month-browser.mjs https://nbc-sales-nbc-sales.vercel.app vercel` exit0,2checks Authreal/noescrituras/API401 + desktop/móvil320/390/claro/oscuro. Cero pageerrors/overflow. Capturas vercel-calendar-desktop.png, vercel-calendar-mobile.png y variantesdark. Calendario real vacío visible inspeccionado por navegador. MismoaliasHTTP200; orquestador/Franco pendientes de revisión, publicación autorizada vigente. Servidor aislado3028 detenido; compartido intacto. Candidato fuente `artifacts/lanes/KCAL01/candidate-r1.sha256`. PushNOEJECUTADO.
