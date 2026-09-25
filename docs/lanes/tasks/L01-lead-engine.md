# L01 — Backend de planes y ledger con presupuesto atómico

> Actualización vigente: leer completo `metodo_ainnovate.md` y `docs/lanes/REVIEW-PROTOCOL.md`. Antes de todo push, Franco revisa y autoriza la entrega concreta. Preparar implementación, pruebas y reporte versionado primero. La revisión técnica del orquestador no sustituye su aprobación.

Lane: Lead Engine. Herramienta: Codex, modo Local. Estado: preparada, sin ejecutar.

Leer CLAUDE.md, docs/lanes/README.md, docs/lanes/lead-engine.md, docs/features/lead-engine.md, docs/sources/README.md y ambos briefs, API_DOCS/DB_SCHEMA/03-security, plantilla de reporte. El planificador y reglas puras ya existen y están probados; no reescribirlos ni ejecutar el MASTER PROMPT de fuentes.

## Tarea cerrada

Convertir el plan local en un backend preparado para persistir y recuperar planes, prevenir trabajos duplicados y reservar presupuesto antes de cualquier operación futura de proveedor. Aún no ejecutar scraping ni enriquecimiento.

1. Documentar el modelo/contratos en tu feature. Alcance inicial NBC interno, un operador autorizado; preparar ownership claro sin afirmar que ya hay SaaS multiempresa. El ledger compartido entre industrias no debe devolver registros de otro cliente.
2. Escribir únicamente la nueva migración reservada `supabase/migrations/202609140010_lead_engine.sql`: planes, lotes/costos reservados y consumidos, búsquedas, negocio procesado, entregas y supresiones según contrato revisado. RLS y permisos mínimos, índices únicos e idempotencia. No modificar ni ejecutar migraciones aplicadas. No aplicar esta migración al Supabase compartido: se entrega al orquestador para revisión/integración.
3. La reserva de presupuesto y claim de búsqueda/contacto deben ser atómicos en Postgres; una comprobación seguida de insert en JS no evita carreras. Reintentos del mismo job no duplican reserva/cargo, y fallo parcial tiene transición explícita. No usar SECURITY DEFINER sin necesidad/autorización; limitar cualquier función a roles de servidor correspondientes.
4. Implementar servicios y rutas bajo `/api/lead-engine/**` para crear/listar/recuperar plan y preparar un piloto dry-run, con requireOperator existente, validación real de payload y nombres de campos/versionado. El cliente no define saldos, supresiones ni permisos del servidor. Gate de piloto300/$10, hard budget, confirmación y stop-loss verificadas contra estado autoritativo.
5. Conectar guardar/recuperar en UI con estados vacíos/error claros. Si falta la migración, indicar almacenamiento pendiente; nunca fingir guardado ni activar Pilot. Mantener export del borrador y benchmarks rotulados como no verificados.
6. Probar idempotencia, concurrencia de reservas, ownership, supresión transversal y fallos. Si no hay Postgres aislado disponible, entregar tests ejecutables y señalar exactamente qué quedó sin ejecutar. No sustituir prueba SQL de atomicidad por solo mocks y llamarla validada.
7. Entregar feature/handoff y `docs/lanes/reports/L01.md` con esquema, endpoints, comandos y dependencias de integración. No editar docs globales ni aplicar DB compartida; el orquestador registra y aplica cambios después de revisar.

No proveedores pagados, cuentas nuevas, compra de saldo, números personales privados, appends, export de lista para marcar, SMS ni llamadas automáticas en L01. La entrega es backend y SQL revisables; no afirmar pipeline de scraping conectado. Siguiente tarea sugerida: adaptadores verificados y piloto autorizado sobre contactos empresariales publicados, después del ledger.

Entrega AInnovate: completar `docs/lanes/reports/L01.md` con revisión, evidencia en `artifacts/lanes/L01/`, entrada propuesta de CHANGELOG y deltas exactos de esquema/API/arquitectura/lookup para el orquestador. No marcar una integración pendiente como completada.
