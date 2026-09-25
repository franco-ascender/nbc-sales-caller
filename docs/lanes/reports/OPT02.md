# OPT02 — orquestador Astra y cuatro prompts

2026-09-16. Instrucciones listas para compartir; no enviadas automáticamente a chats externos.

Franco fija orquestador Astra siempre. Root actualizó política, protocolos y cuatro prompts; Terra modificó selector y regresiones. Ningún código de producto modificado.

Continuidad: Caller e Infra actuales en Codex. Transferencia: antiguo Lead Engine Codex pasa a consulta, nuevo escritor Claude tras handoff/pausa. Academy/Ask Anas pausado, nuevo Claude Master Tracker. Índice y mensaje de pausa: docs/lanes/ACTIVE-LANES.md.

Cada prompt contiene modelos por fase, solicitud explícita de cambio a Franco, regreso al base, ownership, alcance, entrega/pruebas y revisión antes de push. Claude deriva revisión Astra al orquestador. Default de proyecto Terra se conserva para lanes; no fuerza modelo de root ni modifica sesiones abiertas.

Validación: 7 pruebas del selector PASS, node --check PASS, typecheck global exit0, enlaces/prompts y reglas espejo comprobados. Política real --task orchestration devuelve gpt-6-astra/high. Gate de dos intentos conserva replanteo. Reporte OPT01 anterior conserva resultados históricos.

Sin nuevos gastos de negocio, campañas, cuentas, push ni deploy. Costos de agentes no expuestos, no se declara ahorro medido. Próximo paso: compartir prompts, confirmar pausas y modelos efectivos; luego asignar encargos concretos sin duplicar escritores.
