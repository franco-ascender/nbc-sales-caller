# OR02 — Próxima ronda de correcciones por lane

**Orden sustituido por [OR03](OR03-effective-first.md)**. Este documento conserva el backlog técnico; no iniciar todas las correcciones ni Academy antes de los pilotos funcionales.

Tareas listas para asignar; no iniciadas automáticamente. Mismo proyecto, un escritor por archivo. Leer método AInnovate, CLAUDE, docs/00-current-state.md, revisión OR02 y REVIEW-PROTOCOL. Documentar antes de código, preservar cambios ajenos, probar y entregar reporte con hashes/recorrido/deltas. No hacer push/deploy/SQL compartido sin integración y autorización vigentes. Corregir localmente no requiere volver a pedir permiso del encargo.

## Lead Engine — prioridad P1 L-AUTH

Sos el lane Lead Engine. Leé docs/lanes/reports/OR02-PLATFORM-REVIEW-2026-09-16.md y corregí L-AUTH en los adaptadores propios de autorización. Exigí membresía activa y rol autorizado conservando el alcance interno actual; no habilites estudiantes, coaches u otros admins por inferencia. Coordiná con Infra si hace falta contrato común, sin editarlo simultáneamente. Cubrí todas las familias de rutas Lead Engine: planes, carpetas/listas, dry-run, quotes, aprobación, jobs/status/dataset y conexiones según sus guards. Probar que suspensión/degradación/identidad ajena se rechazan antes de DB/proveedor; propietario y presupuesto siguen vigentes. Usá transporte controlado, sin activar execution_enabled ni scraping. No reescribas la migración010 ya aplicada. Reporte: docs/lanes/reports/OR02-LEAD-FIXES.md.

## Caller — C-RECOVERY, C-DRAFT, C-AUDIO

Sos el lane Caller. Corregí limpieza de estado recovery ante renovación/logout sin respuestas viejas; preservación de layouts Analytics ante renovación del mismo usuario; y conservación de audio anterior hasta validar una nueva muestra. Revisá validación servidor de clone antes de consumo. Preservá permisos, idempotencia y bloqueo de telefonía Live. Probar función/rutas reales y browser con token renovado durante request/editor; muestras válidas/corruptas y doble submit. No llamar, clonar ni generar voces pagadas para probar. Si necesitás dependencias, acordalas con Infra; no edits package/lock concurrentes. Reporte: docs/lanes/reports/OR02-CALLER-FIXES.md.

## Infraestructura — I-ONBOARD, I-EVENT, I-DRAFT y OR01 S1/T1

Sos el lane Infra. Corregí onboarding concurrente para que un draft atrasado no borre completed_at y creación de sesión Calendar para reintentos idempotentes bajo respuesta perdida/duplicada. Preservá permisos actor/estudiante. Si requiere SQL, proponé nueva migración reservada con el orquestador y probala aislada; no modifiques030/060 ya aplicadas. Preservá borrador Settings durante refresh y Save concurrente. Cerrá logout lento S1 y tsconfig T1 de OR01 en coordinación con Academy para sus tipos de tests. No excluir src/tests vigentes ni borrar snapshots para hacer pasar typecheck. Reporte: docs/lanes/reports/OR02-INFRA-FIXES.md. Infra es el único escritor de auth común; Lead consume el contrato acordado.

## Academy + Calendar — pendientes OR01

Sos el lane Academy. Retomá docs/lanes/tasks/OR01-review-corrections.md: A1/A2, parte propia de T1 y CAL1. Coordiná auth compartido con Infra, no edites WorkspaceAccess en paralelo. Prepará pruebas reales de inventarios/CAS/RLS y Storage en entorno descartable después de las correcciones: L01 ya documenta PostgreSQL17 local, comprobá disponibilidad antes de repetir el bloqueo antiguo. No presupongas que Postgres equivale a Supabase Storage. No aplicar020 a la base compartida en este encargo ni crear cuentas pagadas. Reporte de correcciones OR01 existente; para ampliación aislada, adjuntar evidencia específica y estado de cada dependencia.

## Output y revisión

Usar docs/lanes/REPORT-TEMPLATE.md. Enumerar IDs corregidos, archivos, comandos y resultados reales, cobertura pendiente, pasos para Franco y siguiente hito. Pruebas pagadas no son necesarias para estos defectos. Orquestador consolida y ejecuta integración; Franco revisa antes del push/publicación del candidato. La siguiente publicación tiene un único ejecutor coordinado y verifica alias/base vigente para no perder otros módulos.
