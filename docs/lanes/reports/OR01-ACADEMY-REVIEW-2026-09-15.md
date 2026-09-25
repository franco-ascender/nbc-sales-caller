# OR01 — Revisión del orquestador: Academy, sesión y calendario

Fecha: 2026-09-15. Entrada: reporte consolidado K01-r6 + S01-r1 + KCAL01-r1 recibido de Franco. **Estado: REVISADO CON CORRECCIONES; integración funcional de Academy pendiente.** No equivale a aprobación de push ni publicación. Esta revisión no modifica runtime ni aplica migraciones.

## Hallazgos concretos

Todos son P2 (corregir antes de cerrar la entrega). Los tres recorridos UI se identificaron por inspección del código; no se afirma haberlos reproducido en navegador durante OR01.

| ID / responsable | Problema | Ubicación y reproducción | Corrección y validación solicitadas |
|---|---|---|---|
| A1 / Academy | Una acción visual puede borrar JSON avanzado sin aplicar | `src/components/platform/AcademyWorkspace.tsx:195`, `:297–316`. Use NBC outline → editar título de otro curso en JSON sin Apply → Move course down o Update course details. `replace()` regenera el editor desde draft.manifest y borra el texto pendiente; controles no comprueban editorChanged. | Aplicar/validar cambios pendientes o bloquear la acción preservando texto. Probar JSON válido e inválido combinado con reordenar, detalles y portada. |
| A2 / Academy | Validador de portada acepta un archivo no decodificable | `src/lib/academy-cover.ts:6–26`, `src/services/academy-covers.ts:16`, `tests/academy-covers.test.ts:6`. El fixture de 23 bytes con SOI/SOF/EOI pasa validación y la prueba de upload sin contener imagen comprimida. | Validación de imagen real en servidor; JPEG genuino para pruebas positivas y fixture truncado negativo. No presenta XSS ni acceso ajeno: es un fallo de validez de portada. Dependencias nuevas se coordinan con Infra. |
| S1 / Infra, coordinado con autor S01 | Logout lento permite un nuevo login que el cierre anterior termina borrando | `src/components/workspace/WorkspaceAccess.tsx:29–31`, `:99–109`. Retener respuesta logout, pulsar Sign out y volver a enviar credenciales: ending no bloquea login, verify retorna y el finally anterior limpia la sesión nueva. El SDK instalado también elimina sesión después de esperar logout remoto. | Coordinar salida e inicio, propagación local sin depender de latencia remota y aislamiento de intentos; prueba browser con logout retenido/nuevo login/otra pestaña. |
| CAL1 / Calendar-Academy | Renovar el token reinicia el mes seleccionado | `src/components/members/CalendarWorkspace.tsx:18–26`. Con zona no UTC, navegar a otro mes; token nuevo invalida feed, zona pasa a UTC y el efecto devuelve a hoy; al recuperar feed vuelve a inicializar. | Conservar selección/zona para la misma identidad durante renovación; reiniciar solo ante cambio real pertinente. Probar refresh con feed demorado y cambio real de usuario. |
| T1 / Infra + Academy | El chequeo TypeScript del workspace actual falla | `tsconfig.json:20–21` incluye archivos históricos de artifacts. Además `tests/academy-covers.test.ts:16–17` usa Uint8Array<ArrayBufferLike> como BodyInit y no tipa correctamente. | Infra acota entradas/exclusiones conservando src y tests activos; Academy corrige tipos sin any/ts-ignore. Repetir chequeo completo. No borrar artefactos ni excluir los tests activos para silenciar errores. |

## Verificación nueva de OR01

- `node --experimental-strip-types --test tests/academy-*.test.ts tests/knowledge-*.test.ts tests/workspace-session-storage.test.ts tests/calendar-month.test.ts`: **37/37 pasan**, cero fallos. Log: `artifacts/orchestrator/academy-review-20260915/unit-tests.log`. Son pruebas locales; los tests de rutas usan transporte controlado.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: **exit 2**, errores T1; log `typecheck.log` en la misma carpeta. No es una nueva falla de despliegue: el comando incluye tests y artefactos que las copias runtime históricas no incluyen.
- Reproducción ejecutada A2: validador acepta los 23 bytes, decoder real `sharp` ya instalado rechaza la imagen. No se instaló ni añadió dependencia al producto. Evidencia `cover-reproduction.json`.
- Snapshot KCAL01 tar coincide con SHA256 `d53f916dc53c99d72c36588474e014723e2b3769b64095506e552f540fcf8202`. Hash canónico del manifiesto calculado como `JSON.stringify(manifest)` coincide con `cddb9514b75c87b8f2fe34f3afd72615f96322edff9a8d91c5b054e7f33a63d5`; el hash de bytes del JSON formateado es distinto por formato, no una discrepancia del candidato.
- Los 33 archivos runtime del alcance Academy/Ask Anas/sesión/calendario identificados en el manifiesto coinciden con la copia local. Otros 17 archivos del manifiesto cambiaron posteriormente; ver `integrity.json`. **No usar todo el workspace actual como si fuera el candidato publicado KCAL01.**
- No ejecuté build ni pruebas de navegador nuevas, no consulté alias actual, cuentas, DB/Storage ni facturación. Capturas y verificaciones HTTPS citadas por los lanes son evidencia histórica de sus candidatos, no pruebas nuevas de OR01. La revisión de código fue asistida por dos revisores de solo lectura sin cambios de archivos.

## SQL y backend

La lectura de la migración propuesta y servicios no encontró un defecto concreto en el bloqueo/CAS de revisión, transacción, owner o grants. Las APIs exigen admin activo y derivan owner en servidor. Storage usa rutas ownerUUID/coverUUID.jpg y bucket privado. Esto no acredita PostgreSQL, RLS ni Storage reales: no se ejecutaron las pruebas aisladas ni se aplicó la migración.

Academy permanece **parcial**: programa/portadas locales, inventarios y API implementados, pero guardado real e inscripciones pendientes. Ask Anas prepara fuentes; no hay respuestas ni corpus. La ventana de sesión es de restauración en navegador, no revocación global. Calendar es una vista del feed próximo limitado, no integración externa ni histórico completo.

## Consolidación AInnovate realizada

Actualizados DB_SCHEMA y API_DOCS con propuesta Academy/Storage y contratos actuales; arquitectura, seguridad, decisiones y overview con esta entrega y sus límites; lookup y reglas espejo; deployment con trazabilidad histórica; CHANGELOG y mapa de lanes con enlace a revisión. No se declara revisada toda la plataforma ni se incorporan por atribución los avances ajenos de Caller/Lead Engine/Members/pagos. El reporte consolidado original y reportes de autor permanecen intactos.

## Siguiente trabajo asignable

Ver `docs/lanes/tasks/OR01-review-corrections.md`: devoluciones A1/A2/T1 a Academy, S1/T1 a Infra y CAL1 a Calendar. Son encargos para los chats externos existentes, no se iniciaron automáticamente. Primero regresiones y chequeo limpio; después pruebas de persistencia/Storage aisladas antes de habilitar Academy en la base compartida. No se exige nuevamente permiso para preparar código/pruebas dentro del alcance ya asignado.

## Revisión de Franco

El enlace habitual reportado sigue siendo https://nbc-sales-nbc-sales.vercel.app; no se verificó su versión actual en OR01. No reemplazarlo por un enlace distinto. Para revisar A1: usar únicamente un borrador de prueba exportado. S1/CAL1 necesitan fixtures de latencia/renovación, no cuentas o cursos reales. La prueba SQL pendiente requiere ambiente descartable, nunca usar datos de alumnos como prueba.

Revisión técnica: CON CORRECCIONES. Aceptación de persistencia: PENDIENTE. Aprobación de push por Franco: NO INFERIDA. Push, merge, tag, deploy y SQL compartido ejecutados en OR01: NINGUNO.
