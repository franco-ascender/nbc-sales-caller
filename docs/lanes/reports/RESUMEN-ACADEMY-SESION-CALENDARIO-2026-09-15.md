# Reporte consolidado — Academy, Ask Anas, sesión y calendario

**ID:** K01 + S01 + KCAL01 · **Revisión del informe:** 1  
**Período documentado:** 14 y 15 de septiembre de 2026.  
**Destinatarios:** Franco y orquestador de NBC Sales.  
**Estado:** interfaces y servicios publicados para revisión en Vercel; Academy mantiene dependencias de base de datos, almacenamiento y contenido real.  
**Enlace habitual:** https://nbc-sales-nbc-sales.vercel.app

Este informe reúne el trabajo realizado en este chat desde la asignación inicial K01 hasta el calendario mensual. Se basa en los reportes, logs, capturas y manifiestos conservados de cada revisión. Su elaboración es documental: no implica una nueva ejecución de pruebas, comprobación del alias ni publicación. Los resultados se atribuyen a la revisión en que se obtuvieron.

No se atribuyen a este chat las implementaciones de Caller, Lead Engine, Members, Dashboard, pagos, shell o integraciones desarrolladas por otros lanes. Esos cambios se preservaron al integrar las entregas propias.

## 1. Qué conseguimos

Pasamos de un inventario local importado como JSON a una experiencia de Academy con importación desde planillas, editor visual de cursos, módulos y clases, selección de portadas, vista previa del aula y administración restringida por rol. Preparamos servicios para inventarios versionados y fuentes trazables de Ask Anas. Después resolvimos la restauración de sesión entre pestañas durante 12 horas y añadimos un calendario mensual visible incluso sin eventos.

| Área | Resultado implementado | Límite real al cierre documentado |
|---|---|---|
| Importación | JSON, CSV/TSV y pegado desde planillas; revisión antes de reemplazar el programa | Importar reemplaza el inventario; no sincroniza automáticamente con Skool |
| Editor de programa | Crear, renombrar, ordenar y eliminar cursos, módulos y clases; editar descripción y referencia de video | Los cambios son borrador hasta un guardado confirmado; el almacenamiento real sigue pendiente |
| Portadas | Elegir imagen propia, previsualizar, reemplazar, quitar y descargar el JPEG preparado | Upload/lectura privados implementados y probados con fixtures; bucket real pendiente |
| Estructura NBC | Borrador opcional con 22 cursos identificados en las capturas aportadas | No contiene módulos, clases, videos ni permisos inferidos |
| Aula | Catálogo compacto, índice de módulos y lecciones, selección, progreso y notas por lección en preview | Demo separada; no existe todavía un catálogo real publicado para alumnos |
| Permisos | Herramientas y APIs de gestión solo para admins activos; aislamiento por propietario | Inscripciones y autorización por curso todavía pendientes |
| Ask Anas | Preparación de fuentes basada en inventarios y revisiones disponibles | Sin corpus, entrenamiento, respuestas conversacionales ni contenido atribuido a Anas |
| Sesión | Restauración durante 12 horas fijas entre pestañas y recargas del mismo navegador | No equivale a revocar globalmente los tokens de Supabase a las 12 horas |
| Calendario | Mes completo, navegación, Today, selección de día y sesiones existentes | No conecta un calendario externo ni amplía la cobertura temporal del feed existente |
| Publicación | Entregas verificadas en el mismo enlace de Vercel | Publicar código no aplica la migración de Academy ni carga cursos |

## 2. Recorrido del trabajo y correcciones

### K01-r1 — Inventario versionado y fuentes

Se documentaron flujo, contratos y aceptación antes de implementar. Se añadieron servicios y rutas para listar inventarios propios, abrir versiones, consultar historial y guardar con una revisión esperada. El propietario se obtiene de la identidad validada en servidor.

Se preparó la migración reservada `supabase/migrations/202609140020_academy.sql`, con inventarios, revisiones inmutables y fuentes pendientes. El guardado propuesto es transaccional y compara la revisión para que dos sesiones no sobrescriban silenciosamente el mismo inventario. Incluye RLS, permisos mínimos e índices.

La interfaz conserva el borrador y su exportación cuando una importación es inválida, falla el backend o hay conflicto. Ask Anas proyecta procedencia, IDs, referencias y motivos concretos: metadata registrada, contenido pendiente y transcripción todavía no disponible. Las URLs del manifiesto no se descargan automáticamente ni se ejecutan como HTML.

**Límite desde esta primera entrega:** la migración quedó propuesta y sin aplicar a la base compartida. Las pruebas HTTP controladas no demostraron persistencia ni RLS en PostgreSQL real.

### K01-r2 — Importación fácil y vista previa

Ante el tamaño del programa, se añadió importación por CSV/TSV y pegado desde Excel o Google Sheets. Una tabla puede repetir curso y módulo por cada lección; la referencia de video es opcional. El paso de revisión muestra estructura, conteos y errores por fila antes de aceptar el reemplazo. También se añadió edición visual para no depender de escribir JSON.

Se creó **Preview student experience**, con cuatro cursos, ocho módulos y 24 lecciones ilustrativas, separado del borrador real. Incluye navegación de aula, transcripción de ejemplo, muestra de subtítulos, recurso descargable y notas independientes por lección.

Las descargas de muestras funcionan, pero su contenido es demo. Las notas viven en memoria y se pueden descargar; no están persistidas en una cuenta de alumno. Se documentó el backend necesario para convertir esa experiencia en producto real.

### K01-r3 y r4 — Tipografía, Vercel y reparación de regresión

Se retiraron las fuentes serif de Academy y se alinearon Academy y Ask Anas con Manrope y DM Sans ya disponibles en la plataforma. Se ajustaron jerarquía, tamaños y legibilidad sin modificar las fuentes globales.

Tras tu instrucción de poder revisar en Vercel, se publicó la entrega. Cuando indicaste que seguías viendo lo anterior, se comprobó que una publicación concurrente había movido el alias a una versión que omitía los cambios de Academy. Se integró nuevamente Academy sobre la base publicada correspondiente, preservando Caller y el resto de los módulos.

Fue una regresión de integración comprobada; no se asumió que era caché del navegador. Desde tu aclaración sobre los enlaces, se mantuvo como dirección de revisión el mismo alias habitual. Los identificadores internos de despliegue quedaron únicamente como trazabilidad técnica.

### S01-r1 — Sesión de 12 horas

Se cambió la restauración de sesión para que un login explícito abra una ventana fija de 12 horas, compartida entre pestañas del mismo origen, navegador y perfil. Recargar o renovar el token no extiende esa ventana. La contraseña no se almacena.

Al abrir otra pestaña se restaura la sesión y se valida identidad y membresía en servidor antes de permitir acceso. Cerrar sesión se propaga entre pestañas. Una respuesta tardía de renovación no debe recuperar una sesión cerrada o vencida. Los fallos temporales permiten reintentar; un rechazo de acceso elimina la sesión persistida.

Son 12 horas desde el login, no hasta medianoche. Otro dispositivo, navegador o sesión incógnita requiere su propio acceso. La expiración se comprobó con reloj controlado; no se esperaron 12 horas reales. Mejoras posteriores de recuperación de sesión hechas por Infraestructura se preservaron, sin atribuirlas a S01.

### K01-r5 — Aula inspirada en Skool y gestión solo admin

Se reemplazó la presentación de grandes bloques promocionales por un catálogo compacto de tres columnas, tarjetas más suaves y botones simplificados. Dentro del curso se mantiene un índice lateral de módulos y lecciones, una selección clara y checks de completado.

El progreso de la demo empieza en cero y se calcula a partir de acciones explícitas de completar o desmarcar lecciones. Se refleja en el curso y su tarjeta; permite volver a la última lección dentro de la preview. No simula reproducción de un video inexistente.

Se restringieron importación, edición, inventarios y preview a admins activos, tanto en interfaz como en servidor. Academy reutiliza la sesión del portal, eliminando el login adicional. Student y coach no acceden a borradores, herramientas internas ni inventarios de admins. Hasta que exista contenido publicado para ellos, ven un aula vacía con un estado claro. Ask Anas también oculta la preparación interna a esos roles.

En esta iteración se usaron cuatro pinturas de dominio público como portadas demo. Tu siguiente corrección aclaró que querías facilidad para cargar portadas propias: esas imágenes se retiraron en r6. No forman parte de la entrega actual documentada.

### K01-r6 — Editor visual y programa NBC de las capturas

Se añadió **Edit program**, exclusivo de admin, con índice de cursos y edición contextual. Permite crear cursos, módulos y clases; cambiar nombres y descripción; editar referencias HTTPS; mover elementos arriba o abajo; y eliminar con confirmación. El guardado recoge los cambios pendientes de nombre y descripción; un elemento nuevo sin terminar conserva su texto y bloquea el guardado hasta resolverlo.

**Use NBC outline** prepara 22 títulos y las descripciones legibles de tus capturas, en el orden visible: desde Start Here! y Mindset Mastery, pasando por Fast Track y las etapas del proceso comercial, hasta Team Hiring y What is Inner Circle?. No se copiaron porcentajes, permisos privados, clases o videos que las capturas no permiten conocer. Tampoco se recortaron las capturas para usarlas como portadas.

Se incorporó selección de JPG, PNG o WebP propios, recorte central 16:9 y preparación de un JPEG de 1280 × 720. Se puede previsualizar, reemplazar, quitar y descargar. Una imagen inválida conserva la anterior. Los archivos binarios se mantienen separados del manifiesto: no se guardan objetos File, base64 ni data URLs como metadata.

Para admitir los 22 cursos y las portadas se documentó e implementó manifiesto **v2**, con hasta 100 cursos, descripción y `coverId` opcionales. **v1 mantiene sus límites y compatibilidad originales**, incluido el máximo de 20 cursos. Ambas versiones conservan validación de jerarquía, IDs, referencias y límite de 2.000 lecciones totales. No se hace una conversión a v1 que descarte información silenciosamente.

Se implementaron rutas de upload y lectura de portadas privadas con propietario derivado del servidor, validación de imagen y errores seguros. La propuesta de migración contempla el bucket privado. **El guardado real de inventarios y portadas sigue pendiente de SQL/Storage:** las lecturas reales documentadas devolvieron `503 storage_pending`. Exportar el JSON y descargar la portada por separado permite conservar el trabajo local.

### KCAL01-r1 — Calendario visible aunque esté vacío

Se amplió la vista existente de Calendar con una grilla mensual de siete columnas y 42 días. Permanece visible durante carga, cuando no hay eventos y ante errores. Incluye mes anterior/siguiente, **Today**, fecha actual y selección de día; debajo aparecen las sesiones reales disponibles para esa fecha.

Se contemplaron zona horaria, cambios de horario, eventos de día completo y eventos de varios días. Se verificaron teclado, móvil de 320/390 px y temas claro/oscuro. Se conservaron los permisos existentes de gestión y el backend de Calendar.

No se añadieron eventos ficticios ni se conectó un calendario externo. El feed actual sigue siendo de próximas sesiones, con sus límites de cobertura; navegar a otro mes no significa que exista un histórico completo cargado. El botón Calendar del sidebar ya existía: el cambio propio fue su experiencia mensual.

## 3. Backend, contratos y seguridad

| Método y ruta implementados | Contrato principal |
|---|---|
| GET `/api/academy/inventories` | Lista paginada de inventarios propios |
| GET `/api/academy/inventories/:id` | Inventario actual o revisión solicitada |
| GET `/api/academy/inventories/:id/revisions` | Historial paginado propio |
| PUT `/api/academy/inventories/:id` | `{expectedRevision, name, manifest, origin}`; crea o guarda una revisión |
| POST `/api/academy/covers` | JPEG binario validado; devuelve un `coverId` generado por servidor |
| GET `/api/academy/covers/:id` | Lectura privada de portada propia, sin URL pública |

El contrato vigente exige Bearer e identidad admin activa validada en servidor. No admite `owner_id` del cliente como autoridad. Los inventarios de otro propietario no se exponen; una revisión desactualizada produce `409 revision_conflict`. Hay errores saneados para acceso, validación, tamaño, tipo de contenido y almacenamiento pendiente/no disponible. Las respuestas privadas no se cachean.

La migración reservada contempla `academy_inventories`, `academy_revisions`, `academy_sources`, la función `academy_save_inventory` y el bucket privado `academy-covers`. **Estado: PROPUESTA, NO APLICADA por este lane y NO PROBADA en PostgreSQL aislado.** No se debilitó auth/RLS ni se aplicó SQL a la base compartida.

Variables existentes relevantes, sin valores: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NBC_OPERATOR_EMAIL`. Herramientas de publicación utilizaron la configuración existente de Vercel. No se añadieron dependencias, proveedores de video, compras ni cambios de plan. No se consultó facturación.

## 4. Evidencia de pruebas

Estas cifras corresponden a las revisiones indicadas. No se suman ejecuciones históricas como si fueran cobertura adicional del código actual.

| Entrega | Pruebas documentadas | Qué demuestran y qué no |
|---|---|---|
| K01-r6 | 30 pruebas unitarias; 10 registros de escenarios browser con fixtures; 8 checks con Auth real local y 8 por HTTPS; build/TypeScript aprobados | Editor, importación, v1/v2, portadas locales, roles, borrador, demo y errores. Guardado/owner/conflictos SQL y upload remoto se ejercitan con transporte controlado |
| S01-r1 | 4 unitarias; 6 checks browser con fixtures; 4 checks con Auth real local y 4 por HTTPS; build aprobado | Restauración entre pestañas/recarga, logout y ventana fija. Expiración con reloj de prueba, no 12 horas reales transcurridas |
| KCAL01-r1 | 3 unitarias; 4 registros de escenarios con fixtures; 2 checks con Auth real local y 2 por HTTPS; build/TypeScript aprobados | Fechas, calendario vacío/carga/error, navegación, roles, móvil y temas. No prueba una conexión de calendario externo |

Comandos de referencia efectivamente registrados en sus reportes:

```sh
node --experimental-strip-types --test tests/academy-*.test.ts tests/knowledge-*.test.ts
node --experimental-strip-types --test tests/workspace-session-storage.test.ts
node --experimental-strip-types --test tests/calendar-month.test.ts
node artifacts/lanes/K01/r6/build.mjs
node artifacts/lanes/S01/build.mjs
node artifacts/lanes/KCAL01/build.mjs
node tests/academy-program-live.mjs https://nbc-sales-nbc-sales.vercel.app vercel
node tests/academy-classroom-live.mjs https://nbc-sales-nbc-sales.vercel.app vercel
node tests/workspace-session-live.mjs https://nbc-sales-nbc-sales.vercel.app vercel
node tests/calendar-month-browser.mjs https://nbc-sales-nbc-sales.vercel.app vercel
```

Las pruebas y builds se hicieron en macOS con Chrome y copias aisladas; no se reinició el servidor compartido. Las capturas documentadas muestran escritorio/móvil sin overflow ni errores de página en los recorridos finales. Se corrigieron durante el trabajo desbordamientos móviles, labels accesibles, un error de tipado y selectores desactualizados; se repitieron las pruebas afectadas. Los fallos iniciales están registrados en los reportes individuales.

**Pendiente de ejecutar:** `psql "$ACADEMY_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/academy-isolated-db.sql`, con una base desechable preparada; RLS real; carrera de dos conexiones SQL; upload y lectura en bucket real. No había PostgreSQL/psql/Docker ni DB aislada configurada para esa verificación. No se usó la base compartida como sustituto.

## 5. Publicación y candidato trazable

Las publicaciones se realizaron dentro de tu autorización de aplicar los cambios en Vercel, conservando **https://nbc-sales-nbc-sales.vercel.app** como enlace de revisión. Se usaron archivos congelados y manifiestos de hashes para no publicar el workspace compartido mientras otros lanes escribían.

Cuando otra publicación cambió la base durante el trabajo, se reconstruyó la integración sobre la nueva base y se repitieron las verificaciones afectadas. El candidato final de Calendar contiene 219 archivos runtime; los tres propios de Calendar se superpusieron y el resto se conservó igual a la base integrada L01-R6, que ya incluía Academy K01-r6 y la sesión.

**Último despliegue registrado por este chat:** `dpl_7ze1Pm3bx5ci5QZtwNg5SCTtuEGs`, READY staging. Verificación HTTPS de Calendar: **2026-09-15T19:58:36.537Z**. Esto identifica el cierre documentado, no garantiza que ningún otro lane haya publicado después.

- Snapshot: `artifacts/lanes/KCAL01/nbc-sales-KCAL01-R1.tar.gz`.
- SHA256 del archivo: `d53f916dc53c99d72c36588474e014723e2b3769b64095506e552f540fcf8202`.
- SHA256 del manifiesto runtime: `cddb9514b75c87b8f2fe34f3afd72615f96322edff9a8d91c5b054e7f33a63d5`.
- Candidatos propios: `artifacts/lanes/K01/r6/candidate-r6.sha256`, `artifacts/lanes/S01/candidate-S01-R1.sha256` y `artifacts/lanes/KCAL01/candidate-r1.sha256`.

No existe un repositorio Git en el workspace según las comprobaciones registradas. **Push, merge y tag: NO EJECUTADOS.** No se inventan commits. No se incluyen secretos ni credenciales en este informe.

## 6. Qué falta para una academia real

| Pendiente | Insumo o trabajo necesario |
|---|---|
| Persistencia verificable | Revisión del SQL por el orquestador, DB/Storage aislados, pruebas de guardado/lectura/RLS/concurrencia y posterior autorización de integración compartida |
| Programa completo | Inventario real de módulos y clases, orden y descripciones; las capturas aportan cursos, no todo el contenido |
| Portadas definitivas | Archivos originales autorizados; las referencias visuales no reemplazan esos archivos |
| Videos | Confirmar dónde están, acceso autorizado y reglas de reproducción; Vimeo fue señalado como probable, no se conectó ni se verificó su cuenta |
| Transcripciones y subtítulos | Archivos o tracks autorizados por lección, idioma, versiones, almacenamiento, descarga y reproducción sincronizada |
| Recursos | Archivos por lección, límites y permisos de descarga; implementar almacenamiento privado y entrega autorizada |
| Alumnos | Catálogo publicado, inscripciones, reglas por curso/rol, progreso persistente y notas privadas por alumno/lección |
| Ask Anas conversacional | Corpus autorizado, ingestión/indexado, trazabilidad a fuentes y una futura implementación de respuestas fundamentadas |
| Calendario externo | Conexión autorizada de mentoría y cobertura temporal del feed; dependencia de Infraestructura |

No se descargó automáticamente contenido de Skool/Vimeo ni se sortearon accesos. No se subieron cursos, se conectó un LLM o se produjeron respuestas atribuidas a Anas. Guardar títulos o referencias no equivale a migrar videos ni habilitar alumnos.

Riesgos concretos: borradores, notas y progreso de preview son temporales; exportar antes de recargar o cerrar. El JSON no incluye una portada local pendiente: descargar también la imagen. El import masivo reemplaza el inventario. Un upload exitoso seguido de conflicto podría dejar un asset huérfano cuando se habilite Storage; su limpieza y retención requieren una política posterior.

## 7. Recorrido de revisión

1. Entrar al mismo portal, abrir una segunda pestaña y recargar: dentro de la ventana de sesión debe restaurar acceso sin otro formulario. Sign out debe cerrar las pestañas relacionadas.
2. En `/academy`, como admin, abrir **Edit program**. Usar el outline opcional o crear un curso; añadir módulo y clase, renombrar, reordenar y probar una portada propia.
3. Exportar el inventario y descargar la portada. Una importación inválida debe conservar el borrador. Si Save program muestra almacenamiento pendiente, no debe mostrar un guardado exitoso ni borrar cambios.
4. Abrir **Preview student experience**, entrar a un curso y navegar los módulos. Completar/desmarcar una lección debe cambiar el progreso. Probar notas y descargas sabiendo que son demo.
5. Comprobar que student/coach no ven importación, edición ni inventarios internos. Hoy su aula real está pendiente de publicación de contenido.
6. En `/ask-anas`, revisar preparación de fuentes como admin: metadata y pendientes con razones; no respuestas inventadas.
7. En `/calendar`, comprobar el mes aunque esté vacío, cambiar de mes, usar Today y seleccionar un día. Revisar móvil y modo oscuro.

El conflicto real entre dos sesiones guardando en PostgreSQL queda para el entorno aislado pendiente; no puede aprobarse mediante la demo.

## 8. Documentación, archivos y evidencia

| Grupo de archivos propios | Responsabilidad |
|---|---|
| `src/components/platform/AcademyWorkspace.tsx`, `Academy.module.css` | Biblioteca, editor, importación, aula y gestión |
| `src/components/platform/AskAnasWorkspace.tsx`, `AskAnas.module.css` | Preparación de fuentes y acceso por rol |
| `src/lib/academy-*`, `src/lib/knowledge-*`, `src/services/academy*`, `src/app/api/academy/**` | Contratos, validación, borradores, importación, portadas y servicios |
| `supabase/migrations/202609140020_academy.sql` | Propuesta única de inventarios, versiones, fuentes y bucket |
| `src/components/workspace/WorkspaceAccess.tsx`, su CSS y `src/lib/workspace-session-storage.ts` | Sesión de 12 horas; ampliación de alcance pedida directamente por Franco |
| `src/components/members/CalendarWorkspace.tsx`, `Calendar.module.css`, `src/lib/calendar-month.ts` | Calendario mensual; ampliación de alcance pedida directamente por Franco |
| Tests `academy-*`, `knowledge-*`, `workspace-session-*`, `calendar-month*` | Evidencia por área |

Reportes técnicos vigentes: [K01-r6](K01.md), [S01-r1](S01.md) y [KCAL01-r1](KCAL01.md). Features: [Academy](../../features/academy.md), [sesión](../../features/workspace-session.md) y [calendario](../../features/calendar-view.md). Handoffs: [Academy](../academy.md) y [sesión](../session.md).

La historia K01-r1 a r5 está preservada en los archivos `previous-report-rN.md` de `artifacts/lanes/K01/r2` a `r6`. Logs, JSON de comprobaciones, capturas y hashes están en `artifacts/lanes/K01/`, `artifacts/lanes/S01/` y `artifacts/lanes/KCAL01/`. No se sustituyen esos reportes con este resumen.

### Bloque AInnovate para consolidación

**2026-09-14 a 2026-09-15 — ADDED / CHANGED / FIXED / SECURITY — K01, S01 y KCAL01.** Implementados inventario versionado y fuentes trazables con SQL pendiente; importación por planilla; editor visual y portadas privadas; compatibilidad v1/v2; aula demo y gestión solo admin; restauración de sesión de 12 horas; calendario mensual visible sin eventos. Corregidas tipografía, presentación de aula, uso de imágenes no deseadas y regresiones de integración en Vercel. Archivos y evidencia según las tablas y reportes enlazados. Requests: «Que sea fácil de importar el programa», «solo los admins», «editar programa», «por 12 horas» y «Aunque el calendario no tenga nada todavía, debería estar igual ahí».

El orquestador consolida, sin duplicar entradas ya incorporadas:

- **DB_SCHEMA:** tablas/RPC de Academy, manifiestos v1/v2 y bucket privado `academy-covers`; estado propuesto, sin afirmar aplicación.
- **API_DOCS:** seis operaciones de Academy, auth admin, owner de servidor, contratos binarios/JSON y errores; sesión y calendario sin endpoints nuevos por estas entregas.
- **Arquitectura/lookup:** servicios y helpers Academy/knowledge, adapter de sesión y helper de fechas, enlazados a sus features.
- **Seguridad:** aislamiento por propietario, validación, referencias inertes, portadas privadas, sesión persistida con ventana fija y validación de membresía; distinguir fixtures de pruebas DB pendientes.
- **Deployment/CHANGELOG:** candidato integrado, alias habitual, fechas y entradas por revisión.

Esta consolidación global no fue realizada ni se da por completada por este lane. Los contratos completos y deltas detallados permanecen en los reportes individuales.

## 9. Estado de revisión y siguiente paso

Autorrevisión de las implementaciones: ejecutada según la evidencia y límites de cada candidato. Revisión técnica del orquestador: pendiente en los reportes de cierre. Franco solicitó y orientó las correcciones, autorizó la publicación en el mismo Vercel y respondió «perfecto» después del calendario; ese comentario no se convierte en una aprobación formal de push del paquete completo.

La instrucción de Franco «Antes de pushear cualquier cosa, yo reviso y ahí pushean» sigue siendo el requisito para un futuro push. El candidato integrado y sus hashes ya están identificados para esa revisión. Este informe no solicita ni ejecuta una publicación nueva.

**Próxima tarea sugerida, no iniciada:** validar inventarios y portadas en una base y bucket aislados: guardar, leer, rechazar acceso cruzado y provocar un conflicto real entre dos sesiones. Ese resultado permitiría revisar con evidencia la habilitación posterior del almacenamiento compartido.
