# Handoff — Infraestructura + Dashboard

## Vigente I10-R1 — matriz de conexiones y preparación de integración

2026-09-17. Infra pasa a soporte de Caller C08, Lead Engine L03 y Master Dashboard TR01; no diseña otro dashboard. Se creó `docs/features/integration-readiness.md` y el registro sin secretos `docs/lanes/connection-registry.md`. Estado local: ElevenLabs configurado; Twilio, Apify, BatchData, Google Calendar y GHL no configurados; `outcrawler` bloqueado hasta confirmar si significa Outscraper. La única conexión Google preparada es Calendar de solo lectura para un calendario fijo, pero faltan destino, permiso lector de identidad dedicada y OAuth server-side. Una cuenta Google no habilita ElevenLabs, Ads, GHL ni Calendar por sí sola.

`tsc --noEmit --incremental false` pasa y `workspace-session-storage.test.ts` pasa4/4. S1 sigue pendiente: el logout remoto lento puede borrar un login posterior. Por ser auth común, su corrección requiere fase Sol/alto antes de editar `WorkspaceAccess`; no se inició bajo Terra/medio. No se editó `.env.local`, variables Vercel, auth, SQL, proveedores ni se publicó. Reporte: `docs/lanes/reports/I10.md`; evidencia/hash de documentos en ese reporte. Siguiente dependencia: Franco confirma el destino de la cuenta Google y cambia a Sol/alto para S1 cuando quiera iniciar esa fase.

## Vigente I09-R1 — Mock en Your Roadmap, ruta /members

2026-09-15. Corrige ubicación de I08 tras screenshot de Franco. La pantalla Your Roadmap muestra directamente ejemplo completo de5 fases, objetivos, coaching focus y progreso40% ficticio, marcado DEMO. Sustituye Roadmap charging después de onboarding completado. Formulario incompleto, review/coach assignment y Overview conservados. Selección de fase en memoria, cero escrituras de dominio.

Deployment `dpl_Hb6nrHcYHuiCAnekixRLfF1obKZC` READY, https://nbc-sales-nbc-sales.vercel.app/members. Snapshot230 archivos sobre L01-R7,3 propios, SHA256 `39891caae999e9c8a6b69d4284a0400794e6c782fcf67ce82eb57ff65c67e4e6`. Build y4 viewports fixture con temas/selección/no-writes/onboarding PASS; verificación HTTPS final en [I09](reports/I09.md). [Feature](../features/member-roadmap-preview.md), artifacts/lanes/I09/. Sin SQL/API/auth/keys/dependencias/push. Aceptación de Franco pendiente.


## Vigente I08-R1 — Mock roadmap para revisión visual

2026-09-15. Widget vacío de Overview muestra DEMO ROADMAP con5 etapas y40% de progreso ficticio. View my roadmap vuelve a hitos personales; Preview example abre el mock. No escribe datos ni reemplaza progreso real.3 archivos runtime,226-file snapshot sobre C07-R1/KCAL01/L01-R6/I07; archive SHA256 `226643ccbfad03135ed118bed2e5248a9f5d289598e3ceb12615105380d93035`. Deployment `dpl_8ihS9xubfANPiZoMx2kTmAzCEiov` READY en https://nbc-sales-nbc-sales.vercel.app/. Build y4 tamaños fixture PASS; comprobación HTTPS registrada en [I08](reports/I08.md). [Feature](../features/roadmap-preview.md), evidencia artifacts/lanes/I08/. Sin SQL/API/auth/cobros/llamadas/push. Aceptación de Franco pendiente.


## Vigente I07-R1 — Overview sin huecos y Academy proporcionada

2026-09-15. Corrige captura rechazada por Franco en I06: filas completas con altura compartida, orden preservado, Academy responsive16:9 con texto/acciones visibles, default Roadmap4/Academy8 y migración solo de pareja default anterior. No borra contenido personal. Resize redistribuye la fila y ajusta altura de vecinos para mantener bordes alineados. NBC palette y módulos ajenos conservados.

Publicado https://nbc-sales-nbc-sales.vercel.app/, deployment `dpl_22X3VfQSZ7yiYRKvXzi1rMdrjGDY` READY. Snapshot218 archivos,4 deltas sobre I06-R1; SHA256 `cd2edfbb0eed4dd656cffd86b7969c2347645bb20071360368f165634d76495f`. Build/11 unitarias/editor desktop-mobile/6 anchos+player+título largo PASS. Comprobación HTTPS en [reporte I07](reports/I07.md). [Feature](../features/overview-balanced-layout.md), evidencia `artifacts/lanes/I07/`. Sin DB/API/dependencias/secretos nuevos. Push no ejecutado; aceptación de Franco pendiente.


## Vigente I06-R1 — Settings, Usage y base de créditos

2026-09-15. Publicado y verificado HTTPS en https://nbc-sales-nbc-sales.vercel.app/, deployment `dpl_FQWyUpDwXu1aQ7yN7fSjDoQwQmFT` READY. Avatar/nombre abre Settings con perfil/onboarding persistentes. Usage exclusivo admin incluye automáticamente todas las membresías, tokens reportados/duración/costo parcial/saldos; registro Caller idempotente y wallets0 automáticos. Tarifas en borrador, pagos Stripe preparados pero inactivos, sin descuento automático. Academy16:9 más alto; animación drag/resize corrige scroll y medición de transformaciones. Colores NBC globales conservados.

Snapshot218 archivos sobre C06-R2 preserva K01-R6/L01-R5/S01/I05,23 propios. Archivo SHA256 `48b930e8f490ccb20b9b6abdc84d727f2cbbea74317e11bd90fc860c8a3e28f3`. Migración `202609150060_usage_settings.sql` APLICADA Y VERIFICADA; no reaplicar. Build/16 unit/SQL, desktop+mobile fixtures,7 grupos HTTPS con3 roles, sesión real reload/nueva pestaña/logout pasan. Pagos probados contra Stripe HTTP simulado+SQL real, nunca cobro externo.24 assets cliente sin secretos,4 rutas privadas404.

Faltan calendarID y conexión OAuth; usar lector de cuenta dedicada NBC compartida por dueño, no su password. Pendientes de negocio: cuenta Stripe/configuración real, tarifa definitiva, costos completos/adaptadores de otras herramientas, débitos automáticos y reembolsos/disputas. Avatar iniciales/color, no photo upload. [Reporte I06](reports/I06.md), [feature](../features/account-usage.md), evidencia `artifacts/lanes/I06/`. Sin Git/push; revisión del orquestador y Franco pendientes.


## Vigente I05-R1 — NBC glass y edición directa

2026-09-15. Publicado y comprobado HTTPS en https://nbc-sales-nbc-sales.vercel.app/, deployment `dpl_46gSjX4JyRKbysXe52Ho9VXAy1AE` READY. Sustituye el Overview negro/turquesa de I04: claro NBC por defecto, tema oscuro global persistente, vidrio sutil y editor de11 widgets (4 métricas independientes), galería con datos reales, arrastre del bloque y resize ancho/alto desde esquina. Done/Cancel/Restore, teclado y mobile320–390 comprobados. Sesión12h conserva renovación/validación y resuelve respuestas obsoletas sin borrar un token más nuevo; reload/nueva pestaña real comprobados en Vercel. Agenda NBC real y adaptador Google read-only preparado; **calendario de mentoría todavía no conectado**, pendiente proveedor/ID/cuenta y OAuth servidor.

Snapshot196 archivos sobre C05-R1 preserva K01-R5/L01-R4/S01;31 deltas propios, principalmente compatibilidad visual global. SHA del archivo `a80c2a6b32de479b6247d096032ab6b8b5d30381581476e552cfce5dfbe5307e`. Build,13 unitarias,7 escenarios de sesión simulados, editor desktop/mobile y22 visitas HTTPS de apariencia pasan.35 assets cliente sin secretos, APIs anónimas401 y archivos privados404. Preferencias/progreso personal locales por cuenta; combinaciones arbitrarias pueden dejar huecos residuales de packing. Sin Git/push, llamadas, campañas ni migraciones. Entrar en Caller ejecuta su reconciliación automática existente, registrada en pruebas. [Reporte I05](reports/I05.md), [feature](../features/glass-platform.md), [calendario](../features/calendar-connection.md), evidencia `artifacts/lanes/I05/`.


## Vigente I04-R1 — Overview personalizable

2026-09-15. Publicado y verificado HTTPS desktop/móvil en https://nbc-sales-nbc-sales.vercel.app/. Deployment `dpl_EMHgAQ81sUFdL59T6piDcFEehAjD` READY. Overview en inglés, tema oscuro/neón, ocho widgets con galería, drag mouse/táctil/teclado, tamaños y grilla compactada; Save/Cancel/Reset, preferencias por cuenta en navegador. Roadmap de hitos personales, selección/reproducción de lección Academy, sidebar ocultable. 142 archivos congelados integran C04-R1 y restauran S01-R1 de sesión12h, más once archivos propios. Build y13 unitarias,4 grupos fixture y2 recorridos HTTPS reales aprobados; cero escrituras de dominio. [Reporte I04](reports/I04.md), [feature](../features/customizable-overview.md), evidencia `artifacts/lanes/I04/`. Personalización/progreso local no sincronizan entre dispositivos ni reemplazan roadmap asignada por coaches. Push no ejecutado; UI publicada bajo autorización vigente.

## Vigente I03-R1 — Resumen premium

2026-09-15. Publicado y verificado en https://nbc-sales-nbc-sales.vercel.app/. Deployment `dpl_9visgTD5qoYc6Ef5rqnbcEYe3h64` READY; nombre raíz Resumen, métricas reales, actividad 7/30 días, pipeline interactivo y animaciones accesibles. Conserva C03-R1, K01-R3 e I02-R4 mediante snapshot congelado de 126 archivos y cinco archivos seleccionados. Login real desktop/móvil HTTPS aprobado; 3 unitarias, 4 escenarios de fixtures y build aprobados. [Reporte I03](reports/I03.md), [feature](../features/premium-summary.md), evidencia `artifacts/lanes/I03/`. Sin migraciones, nuevas dependencias ni escrituras. Push no ejecutado; corrección del portal publicada bajo autorización vigente.

## Vigente I02-R4 — navegación de mentoría

Portal https://nbc-sales-nbc-sales.vercel.app/, deployment `dpl_CvvZZYvjp8nx84xQqvujyk3mrJER`, inmutable https://nbc-sales-5ljr7c2nt-nbc-sales.vercel.app/, READY. Start Here/huellas con dos preguntas temporales y guardado real; completar cambia a Your Roadmap/mapa con “Roadmap charging”. Calendar y Mentor Chat laterales; Support junto a NBC workspace al pie; créditos reales del actor en cabecera fija y acceso a historial. Rutas `/calendar`, `/mentor-chat`, `/support`, `/credits`; `/members` conserva journey. Summary privado nuevo sin migración. Revisar [I02-R4](reports/I02.md).

Snapshot de 109 archivos integra C02-R1 + K01-R3 ya publicados, verificados contra base común I02-R3, más catorce archivos propios. Sin copiar trabajo mutable. Build, recorrido real con cuentas temporales desktop/móvil y limpieza registrados en `artifacts/lanes/I02/navigation/`; pruebas HTTPS/capturas en el mismo directorio. No cargos ni cambios de cuentas reales. Push no ejecutado, corrección publicada bajo autorización vigente. Formulario definitivo/roadmap son pendientes de contenido; no se generó roadmap ficticia.

## Vigente I02-R3 — login en raíz

Corregido a pedido de Franco: **https://nbc-sales-nbc-sales.vercel.app/** exige login antes de mostrar el dashboard y navegación; rutas directas y demo también. Members comparte sesión; logout disponible en shell; nueva pestaña/recarga requiere login. Deployment `dpl_7pUFo2MZ8vm5jLKEM1ifX7nRBuGi`, inmutable https://nbc-sales-knuttd71b-nbc-sales.vercel.app/, READY. Dos admins existentes sin cambios. Runtime I02-R2 más integración acotada de WorkspaceAccess/CSS/layout/tipos/API/shell/MemberWorkspace, doce archivos seleccionados y revisados; no se incorporó Caller C02. Fuente congelada de 75 archivos y build/pruebas en `artifacts/lanes/I02/login/`; [reporte I02-R3](reports/I02.md). Push no ejecutado. Los enlaces `/members` de revisiones anteriores ya no son necesarios para iniciar sesión.

## Vigente: I02-R2 publicado y activo — 2026-09-14

Franco autorizó expresamente hacer toda la activación y subirla a Vercel. **Completado**: https://nbc-sales-nbc-sales.vercel.app/members, URL inmutable https://nbc-sales-kopfa2980-nbc-sales.vercel.app/members, deployment `dpl_GyLb1ocx3PZksRSW2nvE7GTn8RDi` READY. Migración Members aplicada en Supabase real, ocho tablas RLS verificadas; Anas y Elias admin activos y login real comprobado en navegador. No localhost necesario, no invitaciones enviadas. Credenciales privadas entregables a Franco fuera del proyecto; referencia sin secretos en `activation/credential-handoff.json`.

Se preservó el C01-R1 ya publicado tomando su snapshot congelado más los nueve archivos runtime I02. Build combinado aprobado, 14 checks navegador reales y 12 de persistencia/Auth/DB incluidas reservas concurrentes PostgREST; tres cuentas temporales y datos eliminados al terminar. Evidencia, manifiesto y archivo reproducible en `artifacts/lanes/I02/activation/`. [Reporte I02-R2](reports/I02.md). Push no ejecutado; deploy por API dentro de autorización nueva. Los bloques parciales siguientes son historia. Quedan política comercial/consumo de herramientas y consolidación documental global, no activación de estos dos admins.

## Actualización I02 — 2026-09-14

Franco amplió la tarea a roles, onboarding, calendario, chat con mentor, tickets y créditos NBC, y suministró datos de Anas y Elias como admins. **PARCIAL CON DEPENDENCIA**, candidato local revisable: [I02](reports/I02.md), [feature](../features/member-platform.md), manifiesto `artifacts/lanes/I02/candidate-manifest.json`.

Código nuevo aislado de C01/L01/K01; único cambio de shell es enlace Members. Build/TypeScript, 17 pruebas de validación/servicio, SQL PGlite y 15 comprobaciones navegador aprobados. Navegador autenticado usa DEMO; no evidencia persistencia real. Migración `202609140030_members.sql` probada aislada, no aplicada al Supabase compartido; concurrencia nativa pendiente. Dos cuentas Auth reales creadas y login comprobado; membresías admin aún no activadas. No emails. Credenciales solo en archivo privado, nunca en el candidato.

Revisar entrada local `http://127.0.0.1:3102/members` y capturas `artifacts/lanes/I02/browser/`; no esperar panel autenticado real hasta integración SQL. Orquestador: revisar/aplicar migración coordinadamente, probar concurrencia/PostgREST, ejecutar modo `--apply-memberships`, conectar autorización de módulos y consolidar docs globales. Luego revisión de Franco antes de publicar este candidato. Créditos no conectados a compras ni consumo. I02 no desplegado, push no ejecutado; baseline I01 publicado conservado. La sugerencia histórica de I02 visual de abajo queda sustituida por esta asignación explícita.

## Historial I01

Estado: **I01 — revisión 1, implementada, lista para revisión**, 2026-09-14. Baseline publicado y comprobado por HTTPS. Revisión técnica del orquestador y aprobación de Franco: pendientes. Push: NO EJECUTADO.

Revisar https://nbc-sales-nyqgilywg-nbc-sales.vercel.app en incógnito. Proyecto `nbc-sales`, deployment `dpl_GcbgSqSuDQrvhBbWiacPh34CjYzr`, preview `target: staging`. SHA256 baseline `bfec999cee4d87329b42e45ed54fcbe1fcea0deefbc0deb24fa28cc131489283`, 57 archivos intactos. Staging `/private/tmp/nbc-i01-wopbxul2` con dependencias aisladas. No se tomaron cambios de C01/L01/K01.

Conexión: creación HTTP 200; seis variables runtime configuradas exclusivamente en preview. IDs locales conservados/agregado VERCEL_PROJECT_ID. El primer deploy inferido como production fue cancelado; no omitir `target: staging` en siguientes llamadas. Ningún proyecto Git ni auto-deploy vinculado.

Acceso: excepción de protección aplicada al deployment del baseline; URL inmutable y alias actual abiertos sin Vercel. Protección general del proyecto intacta, auth de aplicación intacta. Anas ve presentación, planificador local y preparación Academy/Ask Anas; sesiones privadas requieren cuenta autorizada, no creada aquí. Sin invitaciones, llamadas ni consumo de voz.

Validación: npm ci, build Node 24.21.0/Next 16.3.5 local y build Vercel Node 24.x; TypeScript; 12 rutas desktop/móvil, 13 checks navegación, 7 API; import/export/error Academy demo y export/presupuesto Lead Engine. Cero secretos encontrados en 25 assets de cliente. Único error consola observado: favicon 404. Capturas públicas en `artifacts/lanes/I01/public-rerun/`. Fallo inicial del selector del test móvil corregido y repetido; no cambió runtime.

Reporte completo y guía de 2–3 minutos: [I01](reports/I01.md). Candidato documental/script: `artifacts/lanes/I01/candidate-manifest.json`. Feature: `docs/features/platform-delivery.md`; despliegue: `docs/04-deployment.md`. El orquestador debe consolidar entrada CHANGELOG y deltas globales propuestos en el reporte; no están consolidados.

Mejoras de shell separadas: no implementadas ni publicadas. Sugerir I02 acotado para legibilidad móvil de Home y favicon, previa asignación y ownership del asset. Mantener el baseline publicado durante la revisión. No iniciar nueva tarea sin el orquestador.
