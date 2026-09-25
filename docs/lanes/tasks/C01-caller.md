# C01 — Recuperación de pruebas pendientes e historial paginado

> Actualización vigente: leer completo `metodo_ainnovate.md` y `docs/lanes/REVIEW-PROTOCOL.md`. Antes de todo push, Franco revisa y autoriza la entrega concreta. Preparar implementación, pruebas y reporte versionado primero. La revisión técnica del orquestador no sustituye su aprobación.

Lane: Caller. Herramienta: Codex, modo Local. Estado: preparada, sin ejecutar.

Leer CLAUDE.md, docs/lanes/README.md, docs/lanes/caller.md, docs/features/caller-live-tests.md, docs/API_DOCS.md, docs/DB_SCHEMA.md, docs/03-security.md y la plantilla de reporte. No reconstruir el Caller existente: ya tiene voz real ElevenLabs, login, resultados persistidos, filtros, métricas recientes, export TXT y mute.

## Tarea cerrada

Hacer que un operador pueda recuperar resultados de pruebas que quedaron pendientes al salir de la página y consultar más de las últimas treinta sesiones. Mantener compatibilidad del endpoint existente y del inicio idempotente.

1. Documentar antes de código la extensión en la feature Caller. Inspeccionar servicios actuales y consultar docs oficiales si hay cambios de proveedor.
2. Agregar paginación de historial por cursor estable (fecha + ID), validada en servidor y siempre filtrada por UUID del operador. Mantener respuesta inicial compatible; un cursor manipulado nunca permite acceder a otra cuenta. No duplicar/omitir filas cuando hay timestamps iguales o se inicia otra sesión.
3. Agregar una acción autenticada de recuperación de pendientes, con lote acotado (máximo cinco) y respuestas por sesión, sin abrir conversaciones nuevas. Puede ser POST /api/caller/sessions/reconcile. Reusar la vinculación fija con agente/conversation ID. Recuperar al volver al workspace o con una acción explícita; no simular un worker permanente. Manejar 404 temporal, processing, expired y fallo parcial sin retroceder estados finales ni perder transcripciones.
4. UI: cargar más historial, indicar qué cubren las métricas/filtros y cuáles resultados siguen procesando. Evitar dobles peticiones simultáneas y selección atrasada. Conservar export TXT solo para resultados verificados, mute y controles actuales.
5. Tests significativos: rechazo anónimo/otro propietario, cursor inválido/timestamps iguales, recuperación parcial/terminales, ninguna llamada a creación de voz durante reconcile. Tests propios en este lane. Build/E2E globales quedan al orquestador.
6. Reportar archivos, nuevos contratos, evidencia y pasos de prueba en docs/lanes/reports/C01.md y actualizar handoff/feature. No modificar helper común integration.service.ts ni .env; reportar cambios comunes requeridos.

No es parte de C01: telefonía, voz clonada, GHL write, campañas, nuevas llamadas pagadas, cambio de proveedor o nueva política de retención. No comprar nada ni desplegar: I01 se ocupa de hosting. Si detectás configuración ausente, continuar con lo independiente y detallar el dato necesario sin pedir claves por chat.

Entrega AInnovate: completar `docs/lanes/reports/C01.md` con revisión, evidencia en `artifacts/lanes/C01/`, entrada propuesta de CHANGELOG y deltas exactos de esquema/API/arquitectura/lookup para el orquestador. No marcar una integración pendiente como completada.
