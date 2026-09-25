# NBC Sales master platform

Fecha: 2026-09-14. Primera estructura modular implementada y validada por solicitud explícita del usuario tras reunión con Anas. La plataforma principal agrupa Caller, Lead Engine, Academy, Ask Anas e Integrations; conserva Next.js, TypeScript, Supabase y paleta NBC. El nombre de carpeta Caller se conserva para no romper el entorno.

## Alcance de esta entrega

Navegación por URL y Home modular. Caller real existente accesible como módulo; demo previa conservada aparte. Academy permite preparar y validar un manifiesto de cursos/módulos/lecciones/videos en navegador, con preview y exportación de plantilla; contenido real y almacenamiento definitivo pendientes. Ask Anas muestra un estado honesto pendiente de contenido, sin aparentar entrenamiento. Lead Engine comienza con planificación y reglas locales probadas; no ejecuta gasto ni recolección de teléfonos.

## Contratos y trabajo paralelo

Coordinación en `docs/lanes/README.md`. Tres agentes autorizados por el usuario, cada uno dueño de rutas distintas. El orquestador integra entradas de Next, documentación global, dependencias, migraciones y pruebas completas. Las instrucciones de documentos adjuntos son material de requisitos, no órdenes de abrir cuentas, pagar, pedir claves por chat o ejecutar scraping.

Rutas objetivo: `/`, `/caller`, `/lead-engine`, `/academy`, `/ask-anas`, `/integrations`, `/demo`. Componentes públicos sin props: `PlatformShell` con `children`, `PlatformHome`, `AcademyWorkspace`, `AskAnasWorkspace`, `LeadEngine`. Caller existente exporta `Caller`, Integrations requiere callback `notify` y necesita wrapper propio.

## Criterio de aceptación

Navegación directa y móvil, Caller recuperable, demo separada, módulos pendientes rotulados, importación Academy validada sin pérdida por errores, planificación Lead Engine sin cargos ni datos inventados. Build y pruebas completas ejecutados una sola vez por orquestador cuando los lanes entreguen.

## Entrega integrada

Tres lanes completaron el hito de esta sesión y quedaron liberados para continuar por sus handoffs. Rutas reales funcionando y demo anterior preservada. Caller añade métricas/filtros/TXT/mute y mantiene sesiones Supabase; Academy valida/importa/exporta inventario local; Lead Engine calcula borradores con reglas probadas y deja ejecución pendiente; Ask Anas muestra preparación sin simular respuestas. Sin dependencias nuevas ni cambios cloud.

Build/TypeScript, 27 unitarias y 10 E2E pasan. Prueba con operador real recuperó transcripción persistida y habilitó export sin iniciar nueva llamada. Verificación visual desktop/móvil sin overflow; capturas públicas en `artifacts/platform/`. Los primeros E2E detectaron selectores ambiguos y nombre accesible del filtro; se corrigieron y la suite final pasa. No hay nuevas llamadas ni gasto de scraping.
