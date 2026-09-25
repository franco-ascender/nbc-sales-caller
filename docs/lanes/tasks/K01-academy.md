# K01 — Inventario persistente de Academy y base de fuentes

> Actualización vigente: leer completo `metodo_ainnovate.md` y `docs/lanes/REVIEW-PROTOCOL.md`. Antes de todo push, Franco revisa y autoriza la entrega concreta. Preparar implementación, pruebas y reporte versionado primero. La revisión técnica del orquestador no sustituye su aprobación.

Lane: Academy + Ask Anas. Herramienta: Codex, modo Local. Estado: preparada, sin ejecutar. Este es el cuarto lane elegido por el orquestador: comparte la materia prima del curso con el futuro Ask Anas.

Leer CLAUDE.md, docs/lanes/README.md, docs/lanes/platform.md (histórico), docs/features/master-platform.md, DB_SCHEMA/API_DOCS/03-security y plantilla de reporte. Academy ya importa/exporta manifiestos JSON v1 con IDs únicos, cursos/módulos/lecciones y referencias HTTPS como texto. Ask Anas todavía no tiene corpus ni responde.

## Tarea cerrada

Preparar el guardado versionado de inventarios y las referencias de origen que necesitará la migración del curso. El operador debe poder guardar y recuperar su estructura; no perder un borrador al importar datos inválidos ni sobrescribir silenciosamente una revisión concurrente.

1. Crear `docs/features/academy.md` antes del código. Mantener compatibilidad de manifiesto v1; definir versión nueva/migrador solo si hacen falta campos adicionales. No usar títulos ficticios como contenido real de Anas.
2. Escribir solo `supabase/migrations/202609140020_academy.sql`: inventarios/revisiones o entidades necesarias, dueño operador, procedencia del curso/lección, estado video pendiente y futuras referencias de transcript. RLS, permisos mínimos y optimistic concurrency para que dos sesiones no sobrescriban versiones. No aplicar al Supabase compartido: entregar al orquestador.
3. Rutas bajo `/api/academy/**` y `src/services/academy*`, con autorización requireOperator existente y validación del servidor. Guardar metadata, no objetos File/base64. No aceptar owner_id del cliente como autoridad. Respuestas limitadas, errores seguros y pruebas de acceso cruzado/conflicto de revisión.
4. UI de guardar/listar/abrir inventario y estado de guardado real, conservando importación/exportación local. Si el backend aún no tiene migración aplicada, explicar almacenamiento pendiente y conservar borrador/export. Separar estilos nuevos en Academy.module.css/AskAnas.module.css; Platform.module.css pertenece a Infra y se lee sin editar.
5. Ask Anas debe mostrar preparación real de fuentes basada en inventario disponible, sin inventar transcripciones, respuestas o un porcentaje de entrenamiento. No conectar todavía chat/LLM/voz ni descargar automáticamente URLs de los manifiestos.
6. Pruebas: import inválido conserva draft, owner incorrecto rechazado, version conflict no pisa, referencias no ejecutan HTML/fetch, persistencia cuando DB de prueba disponible. Documentar límites y qué falta de Skool: inventario real, videos/transcripciones, permisos y almacenamiento de video.
7. Crear handoff `docs/lanes/academy.md` y reporte `docs/lanes/reports/K01.md`. Detallar migración/contratos y pruebas ejecutadas vs pendientes; orquestador integra DB y docs comunes. No empezar siguiente tarea sin reporte.

No modificar shell, tokens globales, manifiesto del deploy o `.env`. No intentar sortear acceso a Skool, copiar contenido no autorizado, subir videos a un proveedor nuevo ni declarar curso migrado por guardar metadata. El despliegue I01 puede avanzar independientemente de esta persistencia.

Entrega AInnovate: completar `docs/lanes/reports/K01.md` con revisión, evidencia en `artifacts/lanes/K01/`, entrada propuesta de CHANGELOG y deltas exactos de esquema/API/arquitectura/lookup para el orquestador. No marcar una integración pendiente como completada.
