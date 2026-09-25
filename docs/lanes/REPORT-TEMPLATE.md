# Reporte <I01 / C01 / L01 / K01> — revisión <1>

Regla actual: cuando Franco pide publicar, entregar Vercel comprobado; no exigir otra aprobación ni usar localhost como entrega. Si hay un fallo real, describirlo y corregirlo. Ver docs/lanes/REVIEW-PROTOCOL.md.

Fecha y entorno:
Estado de implementación: LISTO PARA REVISIÓN / PARCIAL CON DEPENDENCIA / BLOQUEADO POR ACCESO REAL
Lane y herramienta:
Modelo efectivo y esfuerzo:
Cambios de modelo solicitados/confirmados por fase y modelo al que volver:
Modalidad de facturación y fuente de uso (o desconocida):
Costo/tokens reportados, intentos y retrabajo: ver `docs/lanes/TASK-COST-TEMPLATE.json`; no inventar cero.
Objetivo asignado:
Candidato: commit si existe o manifiesto/hashes de archivos propios; no inventar Git.

## Resultado

Qué cambió y para quién. Distinguir funcionalidad real, fixtures/demo, integración externa y trabajo pendiente. Explicar el resultado observable y su límite.

## Archivos

Rutas creadas/modificadas y motivo. Señalar cualquier archivo fuera del ownership y el acuerdo que lo habilitó. No incluir archivos ajenos en el candidato.

## Evidencia y autorrevisión

| Comando / comprobación | Entorno y fecha | Resultado real | Evidencia / pendiente |
|---|---|---|---|
| Completar | | | |

Registrar pruebas de éxito, fallo, autorización y regresiones pertinentes. Señalar checks no ejecutados y por qué. Distinguir pruebas mock de cuentas/DB reales. No atribuir al cambio actual las pruebas del baseline. Revisar código propio antes de entregar. Capturas públicas de escritorio/móvil en artifacts/lanes/<ID>/ cuando se verificó navegador; no adjuntar datos privados.

## Cómo lo revisa Franco

1. URL o ruta local exacta y requisitos de acceso sin credenciales.
2. Acción concreta y resultado esperado.
3. Caso de error/recuperación significativo y qué debe observar.
4. Capturas disponibles y límites que debe conocer antes de aprobar.

Para I01: URL/deployment ID, snapshot SHA, acceso sin login Vercel, qué puede ver Anas y qué sigue reservado al operador. Guía de presentación de 2–3 minutos. Nunca enlaces con tokens de bypass o credenciales.

## Datos, APIs y configuración

Migraciones con estado PROPUESTA / PROBADA AISLADA / APLICADA Y VERIFICADA. Tablas, campos, relaciones, SQL de políticas, permisos, índices, constraints, funciones y riesgos aplicables. Endpoints con método, auth, request/response y errores. Variables requeridas: solo nombres. Operaciones cloud/costo observado si existió; indicar cuando no hubo o no se verificó facturación.

## Documentación AInnovate

Feature y handoff actualizados:

### Entrada propuesta para CHANGELOG

Fecha/hora, tipo ADDED/CHANGED/FIXED/etc., archivos afectados, descripción detallada y extracto textual del request. El orquestador consolida este bloque, no cuatro escritores concurrentes.

### Deltas exactos pendientes de consolidar

- DB_SCHEMA: contenido y estado de migraciones, o no aplica.
- API_DOCS: contratos completos o no aplica.
- Arquitectura y lookup: nuevos archivos/decisiones o no aplica.
- Otros docs globales afectados: contenido a actualizar o no aplica.

No marcar estas actualizaciones globales como completadas antes de consolidación por el orquestador.

## Criterios de aceptación y dependencias

| Criterio de la tarea | Cumplido / pendiente | Evidencia o dependencia |
|---|---|---|
| Completar | | |

Qué falta, quién lo resuelve y error saneado si hay bloqueo. Distinguir acceso externo, datos ausentes, integración pendiente, decisión de producto y trabajo no terminado.

## Estado de revisión y publicación

- Autorrevisión del lane:
- Revisión técnica del orquestador: PENDIENTE / CON CORRECCIONES / REVISADO; evidencia si ya ocurrió.
- Revisión de Franco: PENDIENTE / CAMBIOS SOLICITADOS / APROBADO; candidato y referencia explícita si ya ocurrió.
- Push: NO EJECUTADO por defecto. Solo registrar ejecutado tras autorización explícita de Franco del candidato/destino.
- Deploy: NO EJECUTADO por defecto. Para baseline I01 autorizado, registrar versión exacta/URL y comprobaciones; para cambios nuevos, autorización previa.
- Candidato y destino que se proponen para revisión: especificar solo cuando estén listos.

No inventar aprobaciones ni completarlas en nombre de Franco. La regla de revisión previa al push proviene de su instrucción explícita y de REVIEW-PROTOCOL.md.

## Correcciones tras revisión

Si se solicitaron cambios: quién los pidió, revisión anterior/nueva, ajustes efectuados, pruebas repetidas y pendientes resueltos. No sobrescribir la historia de aprobación de un candidato con otro distinto.

## Próxima tarea sugerida

Una tarea pequeña y verificable. No empezarla sin nueva asignación.

---

Cerrar el chat con resumen, pasos de revisión y: «Reporte guardado en docs/lanes/reports/<ID>.md. Listo para revisión del orquestador y de Franco; push no ejecutado». Adaptar estado si es parcial o bloqueado. No claves, passwords, signed URLs ni enlaces con tokens de bypass.
