# C05 — Analytics personal y CRM con movimiento

2026-09-15. Diseño previo a código. Request Franco: gráficos animados/neón/curvos, más gráficos, Customize con galería de números/widgets, arrastrar y redimensionar por persona; CRM con personalidad y drag-and-drop. Se aplica a Analytics y CRM de Caller de la captura, conserva Resumen I03 y otros módulos.

## Flujo y visual

Analytics azul noche NBC con trazos cian/azul luminosos, curvas suaves que pasan por puntos reales sin exceder extremos, animación de entrada única y prefers-reduced-motion. KPIs, actividad diaria, resultados, buckets, canales, minutos diarios, actividad por hora y promedio de duración; sin ingresos ni tasas comerciales inferidas. Tooltips/tabla accesible y períodos/canal conservados; alcance son sesiones/leads cargados, Demo identificado. Customize abre galería inline, agrega/quita widgets, orden drag-and-drop, resize horizontal/vertical con tirador y controles de teclado. Save layout persiste; Cancel descarta borrador. Galería sin datos inventados. Móvil una columna, tamaños desktop preservados.

CRM: superficie cálida/clara, columnas con tintes propios, tarjetas con jerarquía/identidad/contacto/actividad, feedback de arrastre y movimientos suaves. Handles para mover leads entre etapas y reordenar tarjetas/columnas; Pointer Events para mouse/touch, alternativas teclado. Auto-scroll tablero, Escape cancela, no overlays centrales para ficha. Reutilizar PATCH details y PUT pipeline C04 (CAS, idempotencia, autor/fecha/DNC). Orden de tarjetas guardado como preferencia privada. Si movimiento se guarda pero falla orden, avisar y permitir reintento sin repetir evento. Cerrar/cambiar modo invalida escrituras tardías de UI.

## Datos y contratos previstos

Nueva migración070 aditiva: `caller_views` PK(operator_id,is_demo,scope), scope analytics/crm, config JSONB, version UUID, last_request UUID, last_payload JSONB, updated_at. RLS cerrado, grants service_role; RPC `caller_save_view` transaccional con lock, compare-version e idempotencia; primer GET devuelve default sin escritura y version null. GET/PUT `/api/caller/views/[scope]`, guard activo real, demo sólo admin, UUID owner del guard. Body≤64KB; analytics config widgets únicos de catálogo cerrado≤12 con columnas3–12 y filas2–6; CRM order UUIDs únicos≤1.000. No datos ni referencias del proveedor. Config por usuario/modo. No nuevas dependencias/env.

Archivos: CallerAnalytics + nuevos CallerCharts/CallerDashboardLayout/CallerDrag, CSS CallerAnalytics/Workbench, CallerCrm, libs caller-dashboard*, servicio caller-views, API propia, migración070, tests caller-dashboard*. Feature/handoff/reporte C05 y artifacts propios. Docs globales sólo deltas para orquestador.

## Aceptación/validación

Probar curvas sin overshoot/fechas/límites de métricas, configuración válida/duplicada/extrema, auth real/rutas owner/demo, SQL CAS/retry/RLS. Browser aislado desktop/móvil: agregar/quitar/resize drag y teclado, reorder, guardar/recargar/cancelar, error/retry, reduced-motion; CRM mover lead/orden/columna y conservar DNC/notas, respuesta tardía. Regresiones C01/C04 y build/TS aislados; preview sobre último snapshot publicado, sólo propios deltas. Verificación real con cuentas temporales limpiadas y capturas DEMO, sin llamadas/voz pagadas. Publicación preview amparada por pedido vigente de revisar en Vercel; cero push/producción, aceptación técnica/Franco pendientes.

Integración antes de build: se detectó K01-R5 publicado, que conserva L01-R4/I04/C04/Members/S01. Se toma `artifacts/lanes/K01/r5/nbc-sales-K01-R5.tar.gz` como base congelada y se superponen sólo archivos Caller. No restaurar una base C04 antigua sobre trabajo concurrente.

## Implementación C05-R1

Catálogo de12 widgets: seis números (leads, conversaciones, completadas, minutos, pendientes, promedio) y seis gráficos (actividad diaria, resultados, pipeline, canales, minutos diarios, horas). Defaults10 widgets. Curvas cúbicas con controles horizontales limitados por sus puntos, brillo cian, conteos animados, áreas/anillos/barras animados y reduced-motion. El promedio desconocido muestra —; sparklines únicamente donde existe una serie temporal correspondiente. Cambiar período/fuente usa fechas locales y excluye fechas futuras.

Grid12 columnas, tamaños3–12 columnas/2–6 filas; móvil fluye en una columna y conserva tamaños desktop. Galería muestra previews explícitamente ilustrativos. Arrastre con handles, preview flotante, autoscroll durante movimiento y Escape; teclado para ordenar/resize. Guardado explícito/Cancel/Reset y errores recuperables. Configuración Live/Demo privada separada, sin cambios en métricas reales por editar layout.

CRM reordena tarjetas y etapas, mueve entre buckets con API C04 (CAS y request UUID). Preserva autoría, notas y DNC; movimiento de etapa y orden de tarjeta son dos escrituras: si la primera termina y la segunda falla, informa que etapa quedó guardada y permite reintentar sólo la pendiente. Ficha lateral, filtros y listas continúan. Sin drag-and-drop de acciones ajenas a Caller.

SQL070 aplicada15/09 14:57:26 UTC, SHA256 bbeedb5a5747a04265dda8612545d25cf9f23d2bdb8166d806661f1a88573fc2. Build aislado aprobado,45 unitarias,5 grupos SQL,8 comprobaciones C05 desktop/móvil (pointer mouse y eventos touch),10 C04,6 C03 y3 C01 aprobados. Preview y verificación real completados:12 grupos Supabase/Chrome,3 cuentas temporales eliminadas, cero mutaciones de voz. Deployment `dpl_Ayz6LH4wxxNNMWNuNvuVcJsfdQH8`, https://nbc-sales-4f11nh9u6-nbc-sales.vercel.app/caller. Detalle en `docs/lanes/reports/C05.md`; evidencia bajo `artifacts/lanes/C05`. Revisión técnica/orquestador y visual/Franco pendientes, push no ejecutado.
