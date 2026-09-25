# Calendario mensual visible — KCAL01

2026-09-15. Request explícito de Franco: «Aunque el calendario no tenga nada todavía, debería estar igual ahí, parecido al de Skool». Las capturas adjuntas muestran Caller; se sigue el requerimiento textual Calendar. Esta asignación habilita cambios acotados a CalendarWorkspace.tsx/Calendar.module.css y helper/tests propios; no editar feed/API/auth ni módulos ajenos. Feature antes de código.

Objetivo: /calendar siempre muestra grilla mensual de7columnas/42días, encabezado mes/año, Previous/Next month y Today. Seleccionar día muestra sus sesiones reales y enlacesexistentes o estado vacío; marcarhoy y día seleccionado. Calendario permanece en vacío/carga/error/conexiónexternapendiente. No inventar eventos/clases/conexiones. Mantener gestiónNBCsegúnrole y sidebarCalendar existente. Sin cambios de DB/env/dependencias.

Contrato: GET/api/calendar existente, Bearermember, eventosupcoming limitado250/60d; UI no hace fetch deURLs arbitrarias ni escribeeventos. Fechaslocales con timezone del feed; all_day conserva fecha civil y finexclusivo, eventos a medianoche/DST se agrupan correctamente. Eventosmultidía aparecen en días solapados. No presentar mesesanteriores/futuros como agenda completa: aclaración de que muestra sesionespróximasdisponibles. Error conserva grilla con reintento y distingue datosprevios de fallo.

Archivos: src/components/members/CalendarWorkspace.tsx y Calendar.module.css; src/lib/calendar-month.ts; tests/calendar-month.test.ts y calendar-month-browser.mjs; feature/handoff/reporte/artifactpropiosKCAL01. Publicar en el mismoaliasVercel autorizado, desde copiaaislada sobre snapshotvigente con verificación de hashes, sin alterar cambiosconcurrentes. No push ni migraciones.

Aceptación: calendario visiblecon0eventos,carga503yGooglependiente; navegaciónmes/año/today; tecladoflechas/Home/End; día/evento real con horaTZyjoinURLseguro; student noadminmanagement; desktop/móvil claro/oscuro; AuthrealHTTP y cuenta vacía. Unitariasfechas/DST/all_day ybrowserconfixtures; buildaislado, reporte y deltas globales para orquestador.

Integración: primera copiaI07 compiló/publicó, peroL01-R6 desplazó alias mientrascompilaba. El controlconcurrencia impidióreponerbasevieja. Se rebasa sobre tarL01-R6verificado conI07/C06/K01/I06/sesión y únicamente3archivosCalendar propios. Repetirbuild ybrowser antes de cierre enaliashabitual. No cambiosfuncionales trasprimera prueba.

## Cierre

Publicado/verificado en https://nbc-sales-nbc-sales.vercel.app/calendar, deployment `dpl_7ze1Pm3bx5ci5QZtwNg5SCTtuEGs` READYstaging.219archivos, baseL01-R6integrada.3unitarias,4escenariosfixture,2checkslocalesAuthreal y2HTTPS aprobados; capturas/móvil/oscuro. Servidoraislado3028detenido,0escriturasDB/eventoscloud, feedexternopendiente sinocultarcalendario. ReporteKCAL01 contienehashes/deltasglobales; pushnoejecutado.
