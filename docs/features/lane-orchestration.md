# Feature: Coordinación de lanes con AInnovate y revisión de Franco

**Actualización 2026-09-16:** [OR03](../lanes/tasks/OR03-effective-first.md) prioriza Caller real, scraper útil y definición de Master Tracker, con Infra de apoyo. Academy/estética en pausa. Se añaden encargos y reportes incrementales, lecturas dirigidas y revisión única para contener gasto de tokens. El flujo inicial Vercel inferior es histórico.

Estado: actualización documental implementada y validada. No modifica la aplicación.

## Contexto y objetivo

Franco dirige NBC Sales AI y quiere cuatro conversaciones trabajando en paralelo sobre este proyecto. El orquestador define tareas, revisa contratos y valida la integración. La prioridad es una plataforma presentable a Anas hoy, empezando por conectar Vercel. El usuario solicita prompts completos y establece: «Antes de pushear cualquier cosa, yo reviso y ahí pushean».

## Flujo

1. Cada chat lee el método completo, contexto, arquitectura, tarea y ownership.
2. Documenta el cambio antes de implementar, trabaja dentro de su módulo y comprueba su entrega.
3. Guarda reporte, evidencia y documentación pendiente de consolidación global.
4. El orquestador revisa código/contratos y realiza la validación integrada; Franco revisa comportamiento y presentación.
5. Solo una aprobación explícita de Franco del paquete concreto habilita su push. La revisión técnica por sí sola no lo autoriza.

Conectar Vercel y preparar el despliegue están autorizados. La publicación inicial de la versión congelada de I01 conserva la autorización previa para revisión; esta excepción no permite publicar cambios nuevos sin revisar, hacer push ni promover una nueva entrega a producción. Si hacen falta cambios de código para publicar el baseline, entregar el candidato corregido y validado para revisión antes del upload.

## Archivos

`docs/lanes/START-HERE.md`: cuatro prompts completos. `docs/lanes/README.md`: ownership. `docs/lanes/REVIEW-PROTOCOL.md`: validación, revisión y autorización de push/publicación. `docs/lanes/tasks/`: criterios técnicos por tarea. `docs/lanes/REPORT-TEMPLATE.md`: entrega reproducible. Reglas IA compartidas: referencia al protocolo vigente.

## Restricciones

No ejecutar los lanes al redactar estos prompts; no cambiar runtime, credenciales, fuente original del método ni snapshot. No tratar el método como reinicio de la Fase 1. Documentación global consolidada por el orquestador para evitar cuatro escritores; cada lane entrega los cambios exactos requeridos en su reporte. Estado real, fixtures y pendientes deben ser distinguibles.

## Validación prevista

Comprobar cuatro prompts completos, rutas de lectura existentes, coherencia de reglas de push/deploy, ownership y reglas IA. No hacen falta tests runtime para esta modificación documental.

## Validación realizada

Cuatro bloques completos de prompts verificados con tarea, alcance, método, revisión y output por ID. Enlaces locales de coordinación/README comprobados y reglas IA espejo coincidentes. SHA256 del baseline sin cambios. Sin código de aplicación, cloud, push ni deploy modificados; no se ejecutan tests runtime para esta entrega documental.


## Selección por tarea — corrección de rol del 2026-09-16

Franco reafirma root como orquestador, con implementación delegada. La nueva política MODEL-ROUTING y selector local definen nivel por tarea/riesgo, escalación justificada, consumo separado y límites reales del control. Configuración de proyecto Terra/medium y Sonnet/medium evita Astra como default para nuevas sesiones compatibles; selección efectiva de chats abiertos requiere verificación. Después de cerrar este sistema se reasignan prioridades, no antes. La implementación del selector fue delegada a Terra y el inventario/configuración a Luna; root redacta política y revisa.


## Simplificación solicitada por Franco — 2026-09-17

Problema: reglas acumuladas exigían revisar antes de publicar el lugar donde Franco revisa y generaban pedidos de aprobación repetidos; localhost se ofrecía como sustituto del enlace y Vercel imponía una barrera de acceso. Corregir precedencia, retirar prompts iniciales de la entrada activa y fijar una regla de publicación breve. Pedidos explícitos de publicar autorizan el deploy del trabajo solicitado al enlace habitual, previa verificación técnica interna, sin otro ciclo de permiso. Preservar login y datos NBC; reparar protección Vercel es parte de entregar el enlace. No reconstruir ni mover alias para reparar acceso.
