> Handoff histórico de la primera entrega. Este lane se divide ahora en [Infraestructura + Dashboard](infra.md), tarea I01, y [Academy + Ask Anas](academy.md), tarea K01. Leer el [protocolo vigente](README.md) antes de editar; los permisos históricos no amplían el ownership actual.

# Lane Plataforma — NBC Sales

Fecha: 2026-09-14. Estado: implementación entregada al orquestador; build y navegador integrados pendientes de su validación. Este documento se creó antes del código. Responsable exclusivo durante esta sesión: agente platform; coordinación e integración por conversación principal.

## Alcance autorizado

Shell NBC con navegación por URL a Home, Caller, Lead Engine, Academy, Ask Anas e Integrations; home de módulos con estado real. Academy prepara la migración mediante un manifiesto JSON versionado de cursos, módulos y lecciones; importación local validada, preview y exportación. Ask Anas explica contenido pendiente y recorrido de preparación sin simular respuestas ni entrenamiento.

## Contrato

Exportaciones nombradas en `src/components/platform/`: `PlatformShell({children})`, `PlatformHome()`, `AcademyWorkspace()`, `AskAnasWorkspace()`. Shell aporta un único main. Orquestador crea rutas. Estilos CSS Modules, tokens NBC existentes, sin dependencias nuevas.

Manifiesto v1: `version: 1`, `courses: [{id,title,modules:[{id,title,lessons:[{id,title,videoUrl?:string}]}]}]`. IDs únicos globalmente, campos conocidos, títulos acotados, máximo 20 cursos / 100 módulos por curso / 200 lecciones por módulo y 2000 lecciones totales, archivo máximo 1 MiB. Video es referencia HTTPS sin credenciales, no iframe ni reproducción automática. Campo ausente significa pendiente; el contenido no se migra ni se envía al servidor. Borrador solo en memoria; exportar JSON antes de salir.

## Validación prevista

Tests unitarios del contrato: protocolos y credenciales, duplicados, estructura incompleta, tamaños y límites; fallos no reemplazan el borrador. Build y navegador a cargo del orquestador.

## Próximo paso

Recibir inventario real de Skool y archivos o referencias de videos, acordar almacenamiento y permisos de alumnos antes de migrar. Corpus con fuentes y transcripciones para Ask Anas.

## Entrega implementada

- `src/components/platform/PlatformShell.tsx`, `Platform.types.ts`, `Platform.module.css`: navegación Next por URL, indicador activo, menú móvil desplegable sin overlay, foco inicial en primer enlace y Escape devuelve foco al botón; enlace saltar al único main. Sidebar NBC navy, tarjetas blancas y acento oro, diagrama CSS decorativo en portada.
- `PlatformHome.tsx`: portada de cuatro módulos con estados reales y enlace Integrations, sin métricas demo ni actividad inventada.
- `AcademyWorkspace.tsx`: descarga de plantilla JSON, importación local, inventario contado desde datos validados, preview por curso expandible, referencias de video como texto y exportación del inventario. Un error no reemplaza el inventario válido anterior. No hay llamadas de red, persistencia localStorage ni contenido migrado. El estado vive en memoria de la página; la interfaz indica exportar antes de salir.
- `AskAnasWorkspace.tsx`: estado pendiente, material requerido y enlace al inventario Academy. Sin conversación simulada ni afirmación de clonación/entrenamiento.
- `src/lib/academy-types.ts` y `academy-manifest.ts`: tipos separados, validación pura y cómputo de inventario. Solo se acepta metadata conocida; no HTML ni campos arbitrarios. Videos no se abren/embeben ni se verifican remotamente.
- `tests/academy-manifest.test.ts`: cinco pruebas unitarias ejecutadas, 5/5 pasan. Validan inventario válido y orden, IDs duplicados entre niveles, URLs ejecutables/credenciales/campos extra, jerarquía/versiones inválidas, tamaño en bytes y límites de lecciones.

## Integración / handoff

Orquestador integra rutas y documentación global. Componentes listos sin nuevas dependencias ni modificaciones de datos/API/env. `PlatformShell` contiene el único `<main>`; los módulos hijos no deben crear otro. Navegación aria-label `Platform navigation`; botón móvil `Open platform navigation` / `Close platform navigation`. Academy input aria-label `Course inventory JSON`; botones `Import JSON` / `Replace inventory`, `Download template`, `Export inventory`; heading preview `Your course inventory`.

Siguiente lane Plataforma: importar un inventario real, diseñar revisión de videos/permisos de alumnos y definir almacenamiento antes de agregar reproducción o publicación. No se debe afirmar que existe migración de Skool ni Ask Anas entrenado por disponer de estas pantallas. Lane libre tras entrega, sujeto a coordinación en README de lanes.

## Cierre del orquestador

Integrado y liberado. Build/TypeScript, 27 unitarias y 10 E2E pasan en conjunto. Navegación por URL y móvil verificadas; Caller recuperó datos reales del operador sin iniciar otra conversación. El orquestador ajustó nombres accesibles/selectores de tests y alineó el padding Lead Engine con el shell. Leer `START-HERE.md` para abrir el próximo lane. Las pruebas E2E interceptadas no se presentan como ejecución de proveedores reales.
