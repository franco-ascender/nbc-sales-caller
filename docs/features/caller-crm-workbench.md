# C04 — CRM de trabajo: ficha lateral, actividad y pipeline propio

2026-09-15. Diseño registrado antes de implementar; entrega C04-R1 implementada y verificada. Pedido de Franco: ficha dentro del costado del CRM en lugar de modal central; más contexto, notas propias con usuario/fecha y resultados manuales de llamadas; cada persona crea/ordena/renombra/elimina buckets de su embudo. Presentación más sobria y menos ornamental.

## Flujo previsto y decisiones

Mantener Caller/login/listas/demo/voz/analytics. CRM por defecto tablero compacto, sin hero comercial grande ni cuatro tarjetas vacías. Cabecera directa, métricas pequeñas, filtros y herramientas; tarjetas de lead con contacto, empresa, última actividad y estado, sin avatar grande repetido. Vista lista alternativa. Selección abre una columna lateral **dentro del tab**, sin backdrop ni modal; el tablero sigue usable. En móvil panel apilado dentro del documento, botón volver y foco; no ventana flotante. Escape cierra y restaura foco. Selección rápida invalida lecturas anteriores. Borradores de notas conservados por lead mientras se navega entre fichas.

Notas son entradas aditivas, no un textarea que sobrescribe historia. Timeline paginado fecha+UUID con texto, autor obtenido del login y fecha de servidor; alta idempotente por request UUID. Log call ofrece No answer, Connected, Voicemail, Busy, Wrong number; es un resultado **registrado manualmente**, no una llamada ejecutada/verificada. Histórico `lead.notes` conservado como contexto anterior, con etiqueta sin autor/fecha inventados. Datos contacto, origen, fecha de ingreso, bucket, bloqueo Do not call y resumen de actividad visibles.

Pipeline privado por UUID de operador y modo Live/Demo: hasta 20 buckets, nombre/color/orden editables; selección de bucket inicial para importaciones; categorías operativas Active/Won/Lost y bloqueo Do not call independiente del nombre. No inferir éxito por nombre arbitrario. Quitar bucket exige elegir destino para sus leads, transacción mueve sin borrar leads/actividad. Al menos1 bucket. Configuración tiene versión UUID para detectar edición concurrente; submit es transaccional e idempotente por request UUID. Default 8 buckets conserva organización inicial; los IDs/customización son persistidos. No renombrar enum legado `lead.stage`: se mantiene compatible como categoría canónica; bucket_id es la presentación personalizada. No se pierde DNC al mover/eliminar/renombrar buckets.

Nueva migración aditiva060 (no modificar040/050 aplicadas): pipeline config/buckets y activity; FK owner/mode, RLS cerrado, RPC service_role. Leads agregan bucket_id, do_not_call, latest_activity_at/preview para vistas rápidas. Backfill DNC desde legado. Inicialización por owner/modo idempotente; trigger asigna bucket inicial a importaciones/fixtures futuros cuando ya hay config y actualiza preview al agregar actividad. Eliminar demo cascada sobre leads elimina sólo su actividad demo; pipeline demo puede persistir como preferencias propias, sin tocar configuración Live.

## Contratos y archivos

Nuevas rutas `/api/caller/pipeline` GET/PUT, `/api/caller/leads/[id]/activity` GET/POST y `/api/caller/leads/[id]/details` PATCH. Guard `requireWorkspaceUser` real, `demo=true` sólo admin; owner/autor nunca del payload. Timeline 30 por página, cursor estable validado. PATCH details con updatedAt CAS, bucketId/doNotCall y petición idempotente; movimientos agregan actividad automática identificada. Nuevos CallerCrm/LeadDetail/PipelineEditor, módulos CSS propios; servicios/lib caller-* y tests propios. CallerSalesPanels conserva hooks/dialer/insights; CRM se extrae sin reconstruir otros módulos. Analytics usa buckets propios; AI Caller/dialer respetan do_not_call independiente.

## Validación y publicación

SQL aislado: notas idempotentes, autor/timestamp, edición concurrente, eliminación de buckets reasigna y preserva DNC, dueño/modo/FK y permisos; backward import/default y demo cleanup. Auth/rutas reales con transporte fixture: anónimo, estudiante demo, owner incorrecto, cursores/payload/revisión inválidos. Navegador aislado desktop/mobile: panel sin overlay, seleccionar otros leads, nota/resultado timestamp/autor, crear/renombrar/ordenar/eliminar buckets, error y reintento; screenshot explícitamenteDEMO. Regresiones C01/selección/voz sin nuevas llamadas. Supabase real y preview desde último snapshot congelado cuando pasen checks, bajo autorización vigente de Franco de revisar en Vercel. Cero push/producción/compras/mensajes externos. Reporte C04 con deltas globales para orquestador; no tocar shell/dependencias/docs globales.


Ajuste de integración antes del freeze: el 15/09 se detectó I03-R1 publicado después de C03. C04 parte del archivo I03 `nbc-sales-C03-I03-R1.tar.gz` (SHA256 8cc870c58f2a028a44442c2d7d19152ef6b70deabc74298abe09418847173ff6), conserva Resumen/Home/SummaryCharts/shell y superpone únicamente archivos Caller propios. No se modifica el código de I03. Resumen conserva su lectura de categorías canónicas; el CRM/Analytics Caller muestra buckets personalizados.

## Entrega y evidencia C04-R1

Reporte completo `docs/lanes/reports/C04.md`; preview https://nbc-sales-3b3uvhbln-nbc-sales.vercel.app/caller, deployment `dpl_BSC8agEsjBX8fw9iGwTk97xbwHh7`. Runtime136 archivos/18 deltas sobre I03; manifiesto canónico SHA256 `1b4b077fc721241c23a779b3b051cba55cdf22c4408a7c2af935bb6cad54fd97`. SQL060 aplicada 15/09 14:27 UTC y verificada con usuarios temporales reales.

39 unitarias,11 grupos SQL aislado,10 checks browser C04 desktop/móvil,6 regresiones C03,3 E2E C01 y11 grupos Supabase/preview real aprobados. Build/TS aislados y Vercel READY; capturas DEMO en `artifacts/lanes/C04/browser/`. Las tres cuentas de prueba y sus registros se eliminaron; sin nuevas conversaciones ni mutaciones de voz.

Ajustes implementados antes del freeze: bloquear importación concurrente con edición de etapas mediante mismo lock por operador; categoría Won/Lost se refleja en stage canónico también para nuevas importaciones; callbacks antiguos de notas/listas/config no repueblan Live tras salir de Demo. Timeline usa hora de servidor y autor del guard, no payload. Borradores sobreviven al cambiar de lead durante la sesión CRM, no a recarga. El editor usa controles de orden, no drag-and-drop.

Alcance visible: CRM conserva hasta1.000 leads recientes y selección hasta500; filtros/conteos se calculan sobre cargados. Activity hasta30 por página; Analytics Caller usa buckets propios, sesiones cargadas y filtros existentes; Resumen conserva categorías canónicas. Preferencias del pipeline Demo permanecen al remover mockdata; su actividad sí se elimina por cascada. Notas antiguas continúan etiquetadas sin fecha/autor inventados.

Revisión técnica del orquestador y aceptación de Franco pendientes. Publicación preview autorizada por instrucción de revisar en Vercel; push/producción no ejecutados. Deltas globales exactos y bloque CHANGELOG en reporte, consolidación exclusiva del orquestador pendiente.

## Continuidad C05

Franco pidió después drag-and-drop y nueva presentación. `caller-personal-dashboard.md` y reporte C05 documentan el tablero con arrastre de leads/columnas y orden privado persistido. Conserva API060, ficha lateral, notas/autor/hora, DNC y CAS. La restricción anterior «sin drag-and-drop» describe C04, queda superada por C05.
