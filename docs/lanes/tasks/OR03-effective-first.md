# OR03 — Resultados funcionales y control de tokens

> Regla vigente de publicación (2026-09-17): `docs/lanes/REVIEW-PROTOCOL.md` desde la raíz. Un pedido de Franco de publicar/pushear autoriza Vercel en el enlace habitual; no reiterar permisos ni entregar localhost. Las restricciones históricas inferiores que contradigan esto quedan reemplazadas.

**Antes de la próxima asignación:** aplicar el [sistema de modelos y tokens](../MODEL-ROUTING.md). Root coordina y revisa; los lanes implementan. OR03 conserva propuestas de tareas, todavía sin iniciar una nueva ronda por esta instrucción.

Prioridad de Franco, 2026-09-16: «Don't be cute, be effective». Caller real, scraper útil con objetivo hoy y Master Tracker. Además, reporta $400 en tokens en dos días; origen y desglose aún por confirmar. Esta ronda reemplaza el orden de OR02, conservando sus hallazgos.

Encargos preparados para los chats existentes, no enviados automáticamente. Un escritor por módulo. Academy/Ask Anas y mejoras puramente visuales quedan en pausa sin descartar trabajo. No reconstruir el portal.

## Método común y uso de tokens

- Aplicar AInnovate: documentar el recorrido y aceptación antes del código; conservar arquitectura; probar; entregar evidencia y deltas documentales. Un chat nuevo lee el método y reglas; uno existente reutiliza lo ya leído y consulta cambios, sin reingestar todo el historial.
- Leer primero `docs/00-current-state.md`, luego solo feature, contratos, código y hallazgos relevantes. Buscar rutas/símbolos antes de volcar archivos. No adjuntar todos los informes a todos los chats.
- Una tarea concreta por iteración. Usar el modelo de menor costo que cumpla la tarea, tras confirmar opciones y tarifas del entorno. Reservar mayor capacidad para arquitectura difícil, fallos complejos y revisión crítica; no exigirla para documentación o cambios mecánicos.
- No duplicar revisión entre agentes ni lanzar exploraciones paralelas sobre los mismos archivos. Ejecutar pruebas afectadas y una comprobación integrada al cerrar; repetir únicamente por cambios o fallos.
- Actualizaciones breves y reporte incremental: resultado, archivos, pruebas reales, bloqueo y próximo paso. Reporte conversacional máximo orientativo de 300 palabras, enlazando evidencia técnica. No comprimir a costa de omitir riesgos o resultados fallidos.
- No inventar consumo por estimación de texto. Registrar costo/tokens solo cuando el proveedor o entorno los exponga; si faltan, indicar desconocido. Separar **desarrollo** de **operación NBC**. Los $400 reportados no son una medición auditada ni autorizan gasto adicional.
- Infra administra auth común, dependencias y configuración; orquestador consolida docs globales. Migraciones aplicadas no se reescriben. Franco revisa antes de push; preparar candidato antes de solicitar la intervención final. No activar gastos/campañas por presencia de claves.

## C08 — Caller: una llamada real recuperable

Conservar la voz de navegador y CRM actuales. Implementar telefonía y ejecución persistente: intento idempotente, estados/eventos autenticados, vínculo lead/llamada/transcripción, recuperación al recargar, Stop y límites. DNC se comprueba en servidor antes del despacho. Respuesta perdida o evento duplicado no debe originar otra llamada. Corregir C-RECOVERY en este recorrido; C-AUDIO si se usa carga de muestra. C-DRAFT queda en backlog si no bloquea.

Verificar el camino telefónico compatible con ElevenLabs antes de requerir proveedores nuevos. Voz existente sirve para el piloto; clonación no lo bloquea. Preparar número origen/destino propio, guion, límite y prueba concreta. No llamar a leads para validar implementación.

**Aceptación:** pruebas de idempotencia, autorización, DNC, eventos desordenados y recuperación; después, llamada a número propio acordado con resultado persistido y audio evaluado. Distinguir candidato probado con fixtures de piloto real. Reporte `docs/lanes/reports/C08.md`; ownership Caller existente.

## L02 — Lead Engine: primera búsqueda real útil

Corregir L-AUTH antes de acceso a DB/proveedor. Conservar planes, presupuesto y jobs existentes. La ejecución lee `APIFY_API_TOKEN`, ausente en el chequeo local de esta ronda. Verificar Actor/build/input/output y precio real; token presente no basta para activar ejecución.

Completar búsqueda acotada → job persistente → importación/deduplicación → revisión de resultados y procedencia/costo → reapertura. Probar respuesta perdida y reintentos sin doble gasto. Pedir negocio/ciudad y preparar costo máximo concreto antes de ejecución pagada; $10 del brief no es autorización de cargo.

**Aceptación:** evidencia de búsqueda real y resultados recuperables, o bloqueo exacto si falta acceso. Separar discovery de negocios de lista owner-cell verificada: teléfono empresarial publicado no demuestra celular del dueño. Mantener gates de verificación y exportación; no conectar automáticamente a llamadas. Reporte `docs/lanes/reports/L02.md`; ownership Lead existente, SQL010 inmutable.

## TR01 — Master Tracker: preguntas y fuentes

Reasignar antiguo lane Academy a definición del tracker. Esperar referencia de Anas para decidir alcance; mientras tanto inventariar datos reales existentes y cobertura. Entrega inicial documental: `docs/features/master-tracker.md` y `docs/lanes/reports/TR01.md`.

Proponer para cada métrica: pregunta, fórmula, fuente, cliente, período/zona horaria, moneda, actualización y tratamiento de faltantes. Conversaciones de navegador, intentos telefónicos y llamadas conectadas son distintas. Consumo de IA no es gasto publicitario. Faltante no es cero. Ingresos/ROAS/atribución requieren datos y definición confirmados.

Comparar carga manual/CSV y conectores como opciones, sin decidir por inferencia. Proponer un recorrido de entrada de datos a cifra verificable y su origen. GHL/Ads no se consideran conectados. Sin nuevos gráficos antes de acordar el problema y los datos. Reservar futura familia `tracker-*` y `src/components/tracker/`; Infra integra shell/auth coordinadamente.

## I10 — Infra: desbloqueos y medición de costos

Priorizar guard común para L-AUTH, T1 de typecheck y S1 de sesión; luego configuración e integración de los pilotos. No hacer rediseños ni ampliar Stripe/Members/Academy. Demás hallazgos OR01/OR02 siguen abiertos, sin exigir cerrarlos todos antes de avanzar.

Con el desglose de Franco, distinguir gasto de chats de desarrollo de APIs runtime. Preparar registro simple por proveedor/modelo/tarea, importe y origen de la medición; nada de dashboard nuevo para esto. Proponer presupuesto diario y alertas según datos reales; un límite escrito no es un corte técnico. Configurar límites del proveedor solo cuando se confirme soporte y alcance. No leer ni volcar credenciales para medir costos.

Reporte `docs/lanes/reports/I10.md`. Preparar una integración estable con una sola revisión global, mismo enlace Vercel y un publicador coordinado. No reiniciar servidores compartidos ni publicar cambios ajenos en curso.

## Entrega y revisión

Cada lane: autorrevisión → reporte incremental con evidencia y recorrido de menos de cinco minutos → revisión técnica del orquestador → revisión de Franco → push/publicación bajo autorización vigente. No generar otro resumen histórico completo. Si falta un insumo, completar primero trabajo independiente y señalar la mínima intervención necesaria.
