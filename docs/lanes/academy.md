# Handoff vigente K01-R6 — editor del programa NBC — 2026-09-15

**Único enlace de revisión:** https://nbc-sales-nbc-sales.vercel.app/academy. Mantenerlo; no enviar URLs nuevas a Franco.

Edit program solo admin: índice porcurso, nombre/descripción, elegir/reemplazar/quitar portada, módulos/clases editables, mover arriba/abajo y eliminarconfirmando. Bulkimport queda plegado. Use NBC outline crea22títulos/descripciones de las capturas, sin módulos/clases/imágenes/progreso/permisos inventados. Pinturasr5 retiradas delworkspace yruntime. Previewstudent anterior queda muestra separada, sinstockart.

Manifiestov1 intacto; nuevo v2 agrega description/coverId y100cursos (resto límites igual). BlobJPEGseparado, noFile/base64enmetadata. SelectorJPG/PNG/WebP→previewJPEG16:9; Saveprogram sube primero y guarda revisiónCAS después;503/409preserva draft/cover. APIsadmin POSTcovers y GETcovers/:id validan binario yownerverified; bucketprivadoacademy-covers. **SQL/bucketreal siguen pendientes**: APIreal503storage_pending, no afirmar que portada elegida está persistida. ExportJSONyDownloadselectedcover separados. No aplicar migración compartida por este lane.

Integración final: baseverificadaL01-R5 incluyeI05-R1/C05-R1/S01+I05/Members.197archivos,26runtimepropios superpuestos y5assetspropios retirados. Conservar `artifacts/lanes/K01/r6/nbc-sales-K01-R6.tar.gz`, runtime-manifest.json y runtime-archive.json en futuraspublicaciones; no volver a snapshotsque omitan cambios ya publicados. El workspace mutable no se subió.

CandidatoVercel `dpl_C1GiSTZ9S4Jfh5WbXHWHckCJf6Hn`, READYstaging.30unitarias, build/TypeScript,5escenariosprogramabrowser+5classroom,4checksadminrealeditor+4classroomlocal aprobados. HTTPS en el mismoalias:8checksconAuthreal aprobados; capturas y resultados r6/vercel-*.json/png. Servidoraislado3027detenido. Reporte `docs/lanes/reports/K01.md`, hashespropios `r6/candidate-r6.sha256`. Revisiónorquestador/Franco pendientes; publicación autorizada vigente, pushNOEJECUTADO. NoGit/migraciónaplicada/dependencias/envnuevas.

Deltasglobales exactos enreporte: DB_SCHEMApropuesto(bucket/v2), APIcovers, arquitectura/lookup, seguridadbinary/owner y CHANGELOG. Soloorquestador consolida. Próxima tarea sugerida sin iniciar: DB/Storageaislado, pruebasSQL/RLS/CAS reales, revisión de configuración compartida y originales de portadas/contenido autorizado.

---

## Historia r5 y anteriores — no usar como base vigente

# Handoff vigente K01-R5 — 2026-09-15

**Único enlace de revisión:** https://nbc-sales-nbc-sales.vercel.app/academy. No enviar URLs nuevas a Franco.

Classroom compacto con portadas demo CC0, tarjetas redondeadas, índice de módulos/lecciones, selección amarilla y progreso calculado desde Mark complete. Preview solo admin, notas/muestras conservadas y límites explícitos. Manage courses/Import your program/inventarios solo admin; servidor requireAcademyAdmin sobre requireWorkspaceUser intacto. Borrador particionado por identidad. Academy usa login del portal; student/coach ven aula vacía honesta sin gestión ni inventarios. Ask Anas también oculta fuentes internas.

**Backend pendiente:** catálogo publicado, inscripciones, progreso/notas persistentes y videos reales. La migración K01 sigue sin aplicar; inventarios reales503 storage_pending. No presentar metadata ni preview como cursos disponibles a alumnos.

**Publicación integrada:** deployment `dpl_J6oDdh6d8ZP2XdpyzBZrNkk96ZtN`, READY staging.181 archivos. Base congelada L01-R4 incluye I04-R1, C04-R1, Members y S01-R1 exacto; solo23 archivos Academy superpuestos. Primera base C04 fue desplazada por publicación concurrente y se rebasó/reprobó antes de asignar alias. No se editaron archivos de otros lanes.

**Próximas publicaciones:** partir de `artifacts/lanes/K01/r5/nbc-sales-K01-R5.tar.gz` o preservar byte a byte módulos ya publicados. `runtime-manifest.json`, `runtime-archive.json` y `staging.json` registran origen/hashes. No desplegar workspace mutable ni volver a un snapshot antiguo que omita Academy, sesión12h o Dashboard/Lead Engine nuevos.

Pruebas propias:25 unitarias, build/TypeScript aislado,5 escenarios browser con fixtures y4 checks Auth real local, repetidos después de integración. HTTPS en el mismo alias:4 checks con Auth real aprobados; capturas escritorio/móvil y resultado en r5/vercel-checks.json. Servidor aislado3026 detenido. Reporte `docs/lanes/reports/K01.md`, manifiesto propio `r5/candidate-r5.sha256`. Revisiones técnica orquestador y visualfinal Franco pendientes; despliegue autorizado por pedido vigente de mismoVercel. Push NO EJECUTADO; no Git/SQL aplicado.

Deltas globales pendientes de consolidación por orquestador: guard admin de endpoints Academy, feature/lookup de progreso/assets, snapshot actualizado y CHANGELOG de r5; detalles exactos en reporte. Próxima tarea sugerida, sin iniciar: publicar un curso real con inscripción y progreso persistente por alumno.

---

## Historia anterior — no usar como base vigente

> Preferencia vigente de Franco (2026-09-15): **un solo enlace de usuario, https://nbc-sales-nbc-sales.vercel.app**, Academy en /academy. No enviar enlaces de deployment nuevos. Alias I02-R4 conserva Academy/Caller; comprobado con login real hoy, evidencia artifacts/lanes/K01/link-check/result.json. Mantener URLs históricas solo como trazabilidad técnica. No nuevo despliegue en este seguimiento.

# Handoff vigente K01-R4 — reparación de publicación

**Publicado/verificado:** https://nbc-sales-2kkjzj5sj-nbc-sales.vercel.app/academy
**Alias:** https://nbc-sales-nbc-sales.vercel.app/academy
**Deployment:** `dpl_DninTFi6UNL2TPbWHeCLZHnGoFDH` READY staging, 103 archivos.

Causa: C02-R1 sustituyó el alias usando I02-R3 sin Academy nueva. Reparación combina C02-R1 publicado +16 archivos exactos K01-R3. **Próxima publicación: partir de artifacts/lanes/K01/r4/nbc-sales-C02-R1-plus-K01-R4.tar.gz o verificar preservación de runtime-manifest.json; no volver a snapshots I02/C02 que omiten K01.**

Build aislado aprobado, 12 registros de checks local/HTTPS con Auth real y desktop/móvil; Academy nueva y Caller C02 visibles. Capturas/results en artifacts/lanes/K01/r4. Nada de código funcional nuevo ni migraciones. Backend Academy real pendiente. Autorización Vercel vigente cumplida; push no ejecutado. Reporte K01 r4 vigente, revisiones técnica/visual pendientes y deltas globales para consolidar allí.

---

## Historia r3

# Handoff vigente K01-R3 — 2026-09-14

Franco pidió corregir fuentes y publicar todo Academy en Vercel para poder revisar. Autorización explícita posterior cumplida; no se pidió otra aprobación. Se retiró serif Academy, se usa Manrope/DM Sans existente en CSS propios (Academy y Ask Anas). Sin cambios shell/dependencias/auth/SQL.

**URL:** https://nbc-sales-nbc-sales.vercel.app/academy
**Inmutable:** https://nbc-sales-5w8xaht4b-nbc-sales.vercel.app/academy
**Deployment:** `dpl_J4rSB2ZyeDc9HRLKD6eBa6Uozcct`, READY staging. Base I02-R3 login/Members/C01 + 16 archivos runtime K01 = 89 archivos; no publicar el workspace mutable. Para futuras publicaciones usar este snapshot como base o incorporar sus hashes, evitando volver a una Academy anterior.

Runtime: `artifacts/lanes/K01/r3/runtime-manifest.json`, archivo `nbc-sales-K01-R3.tar.gz` y runtime-archive.json. Build local/cloud aprobados, 23 unitarias pasan, UI desktop/móvil en HTTPS comprobada con Auth real y diez registros de checks; capturas `vercel-*`. Escaneo cliente de secretos: 0. Excepción de protección Vercel solo deployment, login NBC intacto. No push ni SQL aplicado ni videos migrados. Notas/transcript/captions/resources de demo explícitos. Backend real pendiente según feature.

Reporte: docs/lanes/reports/K01.md. Revisión técnica del orquestador y aceptación visual final de Franco pendientes; deploy autorizado/publicado. Consolidar deltas globales del reporte, especialmente docs/04-deployment.md. Fuentes y código propios congelados en candidate-r3.sha256. Próxima tarea sugerida sin iniciar: una lección real autorizada con archivos y notas persistentes tras validar DB/permisos.

---

## Handoff anterior — historia r2, no estado de publicación vigente

# Handoff — Academy + Ask Anas / K01

Fecha: 2026-09-14. **Revisión 2**, solicitada directamente por Franco: importación fácil, diseño premium y preview del programa cargado con materiales/notas. Estado: **CANDIDATO LOCAL / PARCIAL CON DEPENDENCIAS DE BACKEND**. No publicación. Un solo escritor, sin subagentes.

## Recorrido nuevo

`/academy` abre Library. `Preview student experience` abre una demo independiente: 4 cursos/8 módulos/24 lecciones, búsqueda, aula con índice, Overview/Transcript/Resources/My notes. Permite descargar samples TXT/VTT, mostrar subtítulos de ejemplo y escribir/exportar notas distintas por lección. Banner DEMO permanente; sin videos, progreso ni respuestas de Anas inventados. Salir conserva el draft real; salir con notas advierte que se perderán al cerrar la demo.

`Curriculum & imports`: cargar CSV, pegar desde Excel/Sheets o crear la jerarquía con Add course/Add module/Add lesson. Cada fila contiene Course, Module, Lesson, Video URL opcional. Review import valida y cuenta; Use this curriculum cambia el draft solamente tras confirmar si hay cambios. Editor visual conserva IDs; una reimportación de planilla es reemplazo completo con IDs derivados de jerarquía/títulos, no sync incremental. Advanced JSON e import/export v1 continúan disponibles. Guardar/listar/abrir mantiene optimistic concurrency de r1.

Código nuevo: `academy-import.ts`, `academy-demo.ts`, `academy-import.test.ts`, `academy-experience.spec.ts`. AcademyWorkspace/Academy.module.css y tests de navegador r1 adaptados. Ask Anas conserva fuentes y revisiones; no se cambió su contrato. Feature antes del código y actualizada: `docs/features/academy.md`.

## Backend / integración

K01 r1 conserva API y migración `202609140020_academy.sql` **PROPUESTA, NO APLICADA POR ESTE LANE**. GET lista/actual/histórico/revisiones y PUT `{expectedRevision,name,manifest,origin:{label,url?}}` con requireOperator. No cambios SQL/API en r2; ninguna escritura cloud.

Para alumnos reales: catálogo publicado/snapshot, inscripciones por curso, media autorizada (Vimeo si se confirma), assets privados TXT/VTT/SRT/recursos y descargas autorizadas, notas con PK alumno/lección y expectedRevision, progreso separado. Los contratos/modelos propuestos completos están en feature. Nueva migración debe coordinarse; no editar/aplicar SQL compartido aquí. Reutilizar `requireMember` y `nbc_members` que aparecieron en el lane concurrente, agregando autorización por curso; no duplicar alumnos ni dar notas privadas a coaches por defecto.

Todavía faltan inventario real Skool, archivos/acceso autorizado, permiso/acceso Vimeo, videos/tracks y reglas de alumnos/descargas. El botón demo no habilita usuarios reales ni implica cursos migrados. No se accedió a URLs de manifiestos o Vimeo de ellos; solo documentación técnica oficial.

## Verificación y revisión

Evidencia actual en `artifacts/lanes/K01/r2/`. Tests lógica/API con HTTP fixture, import de 2000 lecciones, TypeScript/build aislados y Chrome con capturas. Resultados y comandos exactos en `reports/K01.md`. El tsc de workspace detectó archivos incompletos del snapshot L01 en artifacts: proponer al orquestador/Infra excluir artifacts del chequeo global; no corregir archivos ajenos. PostgreSQL real continúa pendiente porque no hay motor/psql/Docker local; no reutilizar mocks como evidencia SQL.

Candidato actual: `artifacts/lanes/K01/r2/candidate-r2.sha256`. R1 queda histórico en `artifacts/lanes/K01/r2/previous-report-r1.md` y hashes anteriores (ya no describen el workspace r2). Revisión técnica del orquestador y aprobación de Franco **pendientes**, sin transferir aprobaciones entre candidatos. Push/deploy **NO EJECUTADOS**, conforme a la instrucción de Franco.

Próxima tarea sugerida: con el acceso Vimeo/Skool confirmado y coordinación de Members, publicar un solo curso de prueba en DB aislada con una lección, track, recurso y notas privadas de dos alumnos; validar aislamiento antes de importar el programa entero. No iniciada.

## Seguimiento KCAL01 — calendario mensual (2026-09-15)

Asignación directa de Franco: Calendar visible aunque no tenga eventos, similar a Skool. UI de /calendar ahora mensual permanente, flechas/Today/día, detalle real y vacío/carga/error sin ocultar grilla. Cambio acotadoCalendarWorkspace/Calendar.module.css+calendar-month; feed/API/authno cambian. Feature docs/features/calendar-view.md, reporte docs/lanes/reports/KCAL01.md, evidencia artifacts/lanes/KCAL01. BasefinalL01-R6 incluyeI07-R1/K01-R6/C06-R2/I06/sesión. DeploymentKCAL01 `dpl_7ze1Pm3bx5ci5QZtwNg5SCTtuEGs`. Mantener snapshotintegradoKCAL01en siguientesdeploys; mismoaliasVercel. HTTPS verificado conAuthreal,móvil/desktop/claro/oscuro; servidor3028detenido. Detalle final de publicación enreporte. Conexiónexterna pendiente, sincrear eventos ni tocar DB. Pushnoejecutado.
