# Reporte consolidado de la conversación — Lead Engine / NBC Sales

Preparado para Franco y el orquestador el 16 de septiembre de 2026. Cubre el trabajo documentado en esta conversación, revisiones L01-r1 a L01-r9. La última validación funcional citada ocurrió el 15 de septiembre; este reporte no implica una nueva ejecución de pruebas, despliegue ni comprobación del estado remoto del 16 de septiembre.

**Resultado general.** Se pasó de una base de planificación local existente a una implementación con guardado real de planes y carpetas en Supabase, diagnóstico sin consumo, contratos de scraping, estimación/aprobación de costos y controles de presupuesto, deduplicación, supresión y reintentos. Se iteró la interfaz hasta alinearla con los demás módulos, se eliminó el login duplicado y se añadieron reglas y presentación del score de evidencia. El scraper con proveedores reales todavía no está activo; corroboración de dueño, verificación telefónica y conexión del score al pipeline Caller siguen pendientes.

**1. Punto de partida y lectura de los requisitos de Anas.**

El proyecto y el planificador local ya existían. Se retomaron sin regenerar la aplicación. Se leyeron y contrastaron método AInnovate, arquitectura, seguridad, API, esquema, contratos del lane y los dos documentos de Anas conservados en `docs/sources/owner-cell-build-spec.md` y `docs/sources/owner-cell-master-prompt-v2.md`.

Se adoptó el recorrido que aclaraste: descubrir negocios/contactos empresariales publicados, corroborar al dueño mediante fuentes independientes y verificar teléfonos por lotes. No se interpretó el objetivo de 1.000 contactos como una instrucción para consumir inmediatamente esa cantidad. La interfaz pasó a una primera búsqueda acotada, con objetivo ampliable en opciones de planificación.

Se preservaron los benchmarks del brief como referencias, separados de precios contratados o rendimientos medidos. Se documentaron contradicciones del brief y se mantuvieron pausadas las rutas B/C hasta disponer de sus propios pilotos. El primer camino es A, negocios de servicios locales. Los documentos no se ejecutaron como un master prompt ni como una campaña.

**2. Historial completo de entregas.**

| Revisión | Pedido y trabajo realizado | Alcance real de esa entrega |
|---|---|---|
| r1 — 14/09 | Entidades, estados, permisos y ownership; SQL reservado; servicios/API para crear, listar, abrir y preparar dry-run; UI de persistencia y errores recuperables. | 20 unitarias y build aislado aprobados. Guardado probado con fixtures; SQL aún propuesto. |
| r2 — 14/09 | Orientar el módulo a descubrir → investigar dueño → verificar teléfono; primera renovación de UI y Evidence workspace; reglas puras de evidencia y preparación de lotes; diagnóstico de conexiones sin consumo. | 25 unitarias; navegador escritorio/móvil. Evidencia ilustrativa, sin investigación real ni verificador conectado. |
| r3 — 15/09 | Adaptador asíncrono Apify, jobs persistentes, claim exclusivo, seguimiento de run/dataset y recuperación ante respuestas ambiguas. | 34 unitarias y build. Transporte probado con respuestas simuladas; sin llamadas pagadas ni cuenta real. |
| r4 — 15/09 | Cotización antes de ejecutar, modal de aprobación, carpetas/listas, filtros, movimiento entre carpetas e importación paginada de resultados. SQL ampliado a 16 tablas y 21 funciones. | 44 unitarias, build y browser con fixtures. Publicación posterior autorizada para revisar en Vercel; almacenamiento remoto todavía pendiente en esa fecha. |
| r5 — 15/09 | Renovación visual a pedido: tipografía y controles más legibles, jerarquía, espaciado, pasos interactivos, animación, foco y adaptación móvil/claro/oscuro. | Publicado y probado. La dirección visual fue ajustada otra vez en r6 por tu devolución. |
| r6 — 15/09 | Volver al lenguaje visual del resto de tabs: fuente compartida DM Sans, tokens NBC, tarjetas y controles redondeados; retirar Georgia, monograma y exceso editorial. | Publicado y verificado en escritorio/móvil. Es la dirección visual que se conservó. |
| r7 — 15/09 | Eliminar Operator email/password del módulo; reutilizar la sesión NBC. Retirar Connections de Lead Engine y ubicar proveedores en Settings, solo para administradores. | Sesión única y controles de rol probados. No habilitó automáticamente el consumo del scraper con créditos de alumnos. |
| r8 — 15/09 | Score 0–100 con desglose por lead, estado Not checked y ejemplo explícitamente ilustrativo. Sustituir avisos duplicados de pending integration por un aviso único con recuperación. | 53 unitarias, build, navegador y 26 checks HTTPS. Regla y UI reales; sin evidencia de contactos reales ni consumidor Caller. |
| r9 — 15/09 | Integrar de verdad Supabase; probar SQL con sesiones PostgreSQL independientes; corregir comparación de snapshots que fallaba por el orden JSONB; publicar y comprobar todo el recorrido contra la base real. | Migración aplicada y verificada. Guardado, reapertura, carpetas, export y dry-run funcionan en el entorno probado. Proveedores y verificación de contactos permanecen pendientes. |

Los conteos por revisión son fotografías históricas de una suite que fue creciendo; no deben sumarse como pruebas independientes de la versión final.

**3. Lo que quedó funcionando y verificado.**

- Planificar por industria, ciudad/estado de Estados Unidos, objetivo, presupuesto y exclusiones.
- Exportar un borrador JSON sin datos de contactos; conservarlo ante un error de almacenamiento.
- Guardar snapshots, listarlos y abrirlos después de recargar, usando la sesión general NBC.
- Repetir un guardado con la misma identidad sin duplicarlo; rechazar cambios de contenido bajo esa misma identidad.
- Crear y recuperar carpetas privadas, con prevención de nombres duplicados por operador.
- Preparar un dry-run persistente e idempotente con cero reserva, consumo y búsquedas.
- Mostrar estados de carga, vacío, éxito, error y reintento; mantener funcionamiento móvil y teclado.
- Restringir el diagnóstico de proveedores al administrador en Settings, sin pedir otra contraseña dentro de Lead Engine.

Las listas reales aún están vacías: no hubo scraping de negocios para poblarlas. La organización y el movimiento de listas con resultados se probaron con fixtures y SQL aislado, no con resultados de un proveedor real.

**4. Costos, aprobación y seguridad del presupuesto.**

El flujo implementado es guardar búsqueda → seleccionar cantidad/nombre/carpeta → Review scrape cost → revisar rango y máximo → cancelar o aprobar esa cotización exacta. El precio viene de una tarifa privada verificada del servidor; el cliente no puede elegir el saldo, precio o permisos mediante flags.

La cotización vence, conserva su identidad y se vuelve a evaluar antes de reservar/iniciar. La cancelación no inicia trabajo. Un reintento no debe despachar dos veces el mismo job. Si se pierde la respuesta de un proveedor, la reserva permanece y el trabajo requiere conciliación; no se asume costo cero ni se reenvía automáticamente.

Se implementaron montos enteros, presupuesto consumido más reservado, piloto acumulado máximo de 300 negocios/USD10, controles de proyección y reglas de stop-loss/escalado del brief. Reservas y claims se resuelven dentro de Postgres, sin sustituir atomicidad por lecturas e inserts separados en JavaScript.

La cotización actual cubre **discovery**, no todo el proceso de investigación del dueño y verificación telefónica. El costo total de esas etapas sigue pendiente. En el entorno real, Review scrape cost devuelve `pricing_pending` porque aún no se configuró una tarifa verificada. La aprobación está bloqueada sin acceso al proveedor.

**5. Datos, deduplicación y permisos.**

La migración `supabase/migrations/202609140010_lead_engine.sql` quedó aplicada el 15/09 a las 21:12:43 UTC. Incluye 16 tablas: control, planes, cuentas/saldo de proveedor, aprobaciones, lotes, costos, búsquedas, negocios, supresiones, entregas, jobs de discovery, tarifas, carpetas, cotizaciones, listas y candidatos. Todas usan el prefijo `lead_engine_`.

Se verificaron 21 funciones `SECURITY INVOKER`, RLS en las 16 tablas y denegación de acceso directo a clientes anónimos/autenticados. Los servicios comprueban propietario y no exponen los registros globales entre cuentas. El alcance sigue siendo NBC interno; no se afirma aislamiento SaaS multiempresa.

La deduplicación contempla búsquedas, teléfono, negocio/ciudad y placeId. La supresión se comparte transversalmente y vuelve a comprobarse al leer/entregar. Mover una lista de carpeta no reinicia esas protecciones. Los resultados descartados y los claims conservan historial para evitar volver a pagar por el mismo trabajo.

La migración aplicada debe conservarse sin reescritura. Cambios futuros requieren otra migración. La consolidación de estos contratos/estado en los documentos globales sigue asignada al orquestador.

**6. Evidence workspace y score de cada lead.**

Se aclaró la función de Evidence workspace: explicar qué fuentes y verificaciones respaldan el vínculo negocio → dueño → teléfono. Se añadió un componente reutilizable en las filas de Lead Engine para abrir el desglose del score, sin exigir ir a una pantalla separada para entenderlo.

Regla inicial `owner-phone-v1`:

| Evidencia | Puntos máximos |
|---|---:|
| Contacto directo del dueño en la web oficial del negocio | 40 |
| Corroboración del mismo dueño en un registro independiente | 25 |
| Verificación de teléfono activo | 20 |
| Verificación de línea móvil | 15 |

Las fuentes repetidas no se cuentan como independientes; datos vencidos, inconsistentes o de recepción impiden una puntuación alta. Sin comprobaciones se devuelve `Not checked`, no un score inventado. **100/100 significa máxima evidencia bajo esa regla, no 100% de certeza ni una probabilidad calibrada.** El ejemplo de 75/100 está rotulado como ilustrativo.

El contrato del score existe en los registros de Lead Engine. Sigue pendiente recolectar/persistir evidencia real, conectar BatchData y mapear el resultado al detalle del lead en Caller. No se presenta esa integración como terminada.

**7. Pruebas, problemas detectados y correcciones.**

Última entrega r9:

| Verificación | Resultado registrado |
|---|---|
| Unitarias del lane | 55 aprobadas |
| SQL en PostgreSQL17.10 aislado | 22 aprobadas, ninguna omitida; incluye procesos psql concurrentes |
| Build/TypeScript en snapshot aislado | Aprobado |
| Navegador con fixtures | Aprobado: costos, cancelación, carpetas, recuperación, JSONB, escritorio/móvil |
| Recorrido HTTPS con Supabase/Auth reales | 15 comprobaciones aprobadas, sin mocks |
| Ownership usando stores y registros reales | 7 comprobaciones aprobadas |
| Permisos de Supabase17.6 | 16 tablas y 21 funciones comprobadas |

Se detectó y corrigió un fallo que los mocks iniciales no capturaban: JSONB devuelve las claves en otro orden. La comparación por JSON.stringify trataba un plan guardado como modificado, dejando dry-run/costo deshabilitados. Se sustituyó por una huella basada en valores y se añadieron pruebas con claves reordenadas.

También se corrigió el harness SQL local para conectar por los parámetros correctos de libpq. Los fallos iniciales y resultados posteriores quedaron preservados; no se ocultaron detrás del resultado final.

Tras aplicar el SQL, la API administrativa de Supabase entró en mantenimiento temporal. Auth/PostgREST siguieron funcionando y permitieron terminar las pruebas reales. Un intento de retirar el primer borrador de prueba fue rechazado; quedaron dos borradores Roofing/Charlotte, una carpeta rotulada de revisión y un dry-run. No contienen contactos ni equivalen a resultados de scraping.

**8. Publicación y trazabilidad.**

A partir de tu indicación de que revisás en Vercel, se publicaron los candidatos por el mecanismo existente. Cada entrega se construyó sobre el snapshot publicado del resto de módulos, comprobando hashes para conservar el trabajo de los otros lanes. No hubo push, merge ni tag de Git desde este lane.

Último candidato verificado en esta conversación: `L01-r9`, deployment `dpl_yCUAVQPNyp4nySasyLosVRSUBpCC`, READY/staging. URL habitual: https://nbc-sales-nbc-sales.vercel.app/lead-engine . URL inmutable: https://nbc-sales-h5lr2lszp-nbc-sales.vercel.app/lead-engine .

La corrección r9 cambió dos archivos runtime y conservó los otros 232. El manifiesto runtime tiene SHA256 `5ea870e31eb3cbe0009064526f24d57a63a7e02595a56777b33704100ba7c131`; el SQL aplicado, `6b723634fa61743ca8119b04333b74db483e752b5cb54755c5cc851012bb134e`.

Se preservaron reportes, snapshots, logs, capturas de escritorio/móvil y manifiestos en `artifacts/lanes/L01/`. Los servidores locales de prueba fueron detenidos al cerrar r9. No se modificaron secretos ni dependencias npm; PostgreSQL se instaló como herramienta local para ejecutar las pruebas reales. No se afirma revisión técnica externa del orquestador si aún no está documentada.

**9. Qué falta para tener el scraper completo en funcionamiento.**

| Dependencia | Estado al último chequeo y próximo paso |
|---|---|
| Apify | Sin credenciales configuradas. Obtener cuenta existente o nueva, token API dedicado, Actor/build acordados, acceso a tarifa, límites y saldo; validar el adaptador con esa cuenta. |
| BatchData | Sin credenciales configuradas. Obtener acceso a Phone Number Verification API, documentación, tarifa y límites por lote; implementar y probar su adaptador. |
| Investigación del dueño | Hay reglas puras; falta adquisición y contraste real de fuentes empresariales, revisión de conflictos y persistencia de evidencia. |
| Costo completo | Discovery tiene contrato/modal; falta tarifa real, costo de investigación/verificación y conciliación automática de los cargos finales. |
| Score en pipeline Caller | Falta identidad canónica del lead, evidencia real y consumidor del contrato en el pipeline compartido. |
| Estudiantes y NBC Credits | Settings ya oculta proveedores a esos roles; falta integrar autorización, reserva/débito de créditos y uso comercial del scraper. Hoy persiste requireOperator. |
| Piloto real | Elegir industria/ciudad, validar fuentes y cotización con límite de gasto y aprobar ese consumo concreto. No se lanzó. |

Supabase y Vercel ya existen. Si Anas tiene Apify/BatchData, se reutilizan sus cuentas. El brief original mencionaba Outscraper; si ya lo tiene contratado, conviene comunicarlo antes de duplicar proveedores. La implementación actual usa Apify. Accesos privados, tarifas y permisos se documentaron para Anas, pero no se envió ningún mensaje a terceros desde esta sesión.

No se realizaron compras, scrapes pagos, enriquecimiento pagado, campañas, SMS, exportaciones de listas para marcar ni conexión automática a Caller. Tampoco se recolectaron teléfonos personales privados. El control de ejecución sigue deshabilitado en el último estado comprobado.

**10. Recorrido para revisar lo entregado.**

1. Entrar a `/lead-engine` con la sesión NBC existente.
2. Guardar un plan; recargar y abrirlo desde Your saved research.
3. Preparar el dry-run: debe mostrar cero reserva/consumo y los requisitos de proveedor pendientes.
4. Descargar el plan: es un borrador JSON, sin contactos.
5. Crear una carpeta en Lead lists, recargar y seleccionarla. No debe aparecer el antiguo aviso de integración de almacenamiento.
6. Revisar el costo: mientras no exista tarifa verificada, debe explicar esa dependencia y no iniciar gasto.
7. Con administrador, abrir `/settings` y revisar Lead providers. Los proveedores estaban `missing` en el último diagnóstico real.
8. Revisar el ejemplo de evidencia y distinguirlo de un contacto verificado; no hay leads reales ni score poblado en Caller todavía.

**Referencias internas del reporte.**

- Reporte técnico de la entrega final: [L01.md](L01.md).
- Feature e historial de decisiones: [lead-engine.md](../../features/lead-engine.md).
- Handoff vigente: [lead-engine.md](../lead-engine.md).
- Fuentes originales: [README](../../sources/README.md).
- Solicitud de accesos preparada: [ACCESOS-PARA-ANAS.md](../../../artifacts/lanes/L01/r9/ACCESOS-PARA-ANAS.md).
- Contrato del score para Caller: [PIPELINE-CONFIDENCE-CONTRACT.md](../../../artifacts/lanes/L01/r8/PIPELINE-CONFIDENCE-CONTRACT.md).
- Evidencia final: `artifacts/lanes/L01/r9/` — `sql-result.json`, `migration-applied.json`, `database-permissions.json`, `unit-tests-final.log`, `browser-tests.log`, `live-checks.json`, `live-ownership.json`, `capture-checks.json`, `final-integrity.json` y `manifest.sha256`.

Este documento consolida el historial; no modifica el candidato r9, sus manifiestos ni el estado de revisión técnica, y no inicia la próxima tarea.
