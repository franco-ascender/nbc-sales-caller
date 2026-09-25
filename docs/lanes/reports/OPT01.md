# OPT01 — selección de modelos y optimización de tokens

2026-09-16. Listo para revisión. No inicia tareas de producto.

## Resultado y autoría

- Root: política de selección por tarea/riesgo, fuentes de precios, coordinación y revisión; sin implementar código del producto.
- Luna/low: inventario local y defaults de proyecto. Codex global estaba Astra/high; se preserva configuración global y se añade override local Terra/medium. Claude local Sonnet/medium. Directorios excluidos de Vercel.
- Terra/medium: selector ESM local, contratos y pruebas. No ejecuta modelos ni APIs. Clasifica tareas; exige motivo para escalar, exige excepción explícita para Astra y replanteo tras dos intentos fallidos; Claude requiere declaración de acceso/facturación. Root pidió y revisó correcciones de validación y lenguaje de costos.

Guía: [MODEL-ROUTING](../MODEL-ROUTING.md). Política JSON y plantilla de costo disponibles en el mismo directorio. Rol de root y requisito de selección incorporados a reglas espejo y entrada de lanes.

## Validación

- 6 pruebas del selector aprobadas; incluyen múltiples casos adversariales, escalación, política inválida, cuota desconocida y CLI desde otro cwd.
- `node --check scripts/route-lane-task.mjs`: exit0.
- Typecheck global `tsc --noEmit --incremental false`: exit0.
- Matriz ejecutada sobre política real: inventory→Luna/low; integration y orchestration→Terra/medium; auth→Sol/high; Claude incluido confirmado→Sonnet; escalación crítica sin excepción bloqueada.
- Configuración local JSON/valores TOML verificados; reglas espejo idénticas. Manifiesto en `artifacts/orchestrator/OPT01/manifest.json`.

## Límites y siguiente paso

Selección inicial basada en guías/riesgo/precios; no se afirma óptimo empírico ni porcentaje ahorrado. Los créditos Codex no se comparan directamente con USD API. Modelos efectivos, consumo real y cuota Claude deben registrarse al usar cada chat. Los subagentes de esta tarea consumen tokens; sus costos no fueron expuestos, quedan desconocidos, no cero. Los $400 son el gasto reportado por Franco, no una factura auditada.

Los defaults no fuerzan el modelo de chats abiertos ni overrides del IDE. El selector es local y consultivo, no cambia automáticamente esos chats ni impone límites monetarios. No hubo inferencias de prueba vía CLI, cambios de cuentas, llamadas de negocio, push ni deploy. El trabajo anterior L02/T1 se conserva.

Franco pidió cerrar primero este sistema; la nueva asignación de prioridades/lanes queda para después de su revisión. Comprobar modelo elegido en cada chat antes de iniciarlo. Root permanece coordinador/revisor.
