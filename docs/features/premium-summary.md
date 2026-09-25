# Resumen premium — I03

2026-09-15. Franco pide renombrar Workspace a **Resumen** y mejorar mucho la pantalla con gráficos y animaciones. Se conserva ese nombre literal solicitado; el resto de la interfaz continúa en inglés.

Alcance: PlatformHome, CSS propio, pequeños componentes de gráficos, derivación de métricas con contratos existentes, etiqueta del enlace raíz en shell. Dashboard con cabecera editorial, acción principal, métricas reales, gráfico interactivo de actividad 7/30 días, distribución de pipeline y accesos próximos. Movimiento sutil de entrada/trazado/hover, accesible por teclado y reduced-motion. Gráficos SVG/CSS nativos; no añadir librerías, precios, métricas inventadas ni contenido externo.

Datos: GET autenticado Caller leads (hasta 1.000) y sessions (hasta 30), más estado de onboarding ya disponible en MemberNavigation. Excluir filas is_demo de métricas reales. Periodo de actividad por fecha UTC de creación de sesiones completadas, no prometer totales históricos; pipeline refleja snapshot y etapas manuales, no ingresos/conversión inferidos. Manejar por separado fallo CRM/sesiones y preservar estados de carga, cero y error con retry. Datos de prueba de gráficos serán interceptados solo en E2E, rotulados en evidencia; ninguna escritura de datos reales ni llamadas.

Snapshot base: C03-R1 ya publicado, `dpl_5jNRuzybdqUpxkFRyXXTyMeND7po`, archivo SHA256 `362493e3957d94c8985c2314b4a5a137973f838ae2fd2b04833c55300792defe`. Congelar únicamente archivos propios encima y conservar Caller/Academy/Members y login. Build/navegador en copia aislada, publicación Vercel bajo autorización vigente, revisar HTTPS y desktop/móvil. Documentar en I03 e infra; no escribir docs globales ajenos.

Entregado 2026-09-15: build/TypeScript, 3 unitarias, 4 escenarios de fixtures y login real escritorio/móvil tanto local como HTTPS aprobados. Publicado como I03-R1; ver `docs/lanes/reports/I03.md`. Capturas fixture diferenciadas de live; sin escrituras.
