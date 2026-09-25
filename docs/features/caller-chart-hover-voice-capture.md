# C07 — explorar gráficos y grabar una muestra de voz

2026-09-15. Diseño antes de código. Request de Franco: hover con información en gráficos Caller, mayor presencia de amarillo NBC; grabó12s y no entiende por qué no puede clonar; reproductor/download/selector actuales poco claros; guion para leer.

## Objetivo y recorrido

Gráficos muestran un tooltip legible junto al puntero y el punto seleccionado; hover sobre trazado/área completa, barras, segmentos y celdas. Fecha/categoría, cantidad/unidad y proporción cuando corresponde, usando exactamente datos cargados. Teclado/foco y tap móvil equivalentes; Escape/salir cierra, portal acotado a viewport para evitar clipping. Curvas siguen valores reales, sin inventar precisión. Amarillo NBC en puntos seleccionados, curva de duración/acumulado, celdas y acentos; azul/navy conservados. No cambio de métricas/filtros/DB.

Voz: diagnóstico19:46UTC local sigueFree, IVCfalse,3cupos; comprobar endpoint remoto con cuenta temporal. Nunca confundir grabación local con clon creado. Nombre de clon se rellena realmente con nombre del usuario (antes solo placeholder, causa adicional del botón deshabilitado). Checklist visible y acción explican muestra/nombre/consentimiento/capacidad faltantes; revalidar conexión sin borrar audio. Grabación corta muestra recomendación1–2min, no bloqueo artificial por duración;12s no se presenta como calibración suficiente ni como causa del bloqueo del plan.

Guion original en inglés, ~1–2min: conversación natural con saludo, preguntas, números/horarios y cierre, volumen/tono consistentes. Visible mientras graba, párrafos fáciles de seguir. No promete identidad verificada, voz calibrada ni calidad garantizada. Guía basada en [ElevenLabs IVC](https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning): una persona, audio limpio, evitar eco y música, grabación consistente.

Recorder compartido Caller: nueva interfaz propia con botones Record/Stop/Record again/Upload audio/Save recording, nombre/tamaño/duración, Play/Pause y seek accesible. Input file nativo oculto detrás de botón con label; audio real nativo sin controles visuales. Duración medida al grabar y/o decodificada localmente para corregir WebM sin metadata. Waveform solo si se obtiene de muestras de audio reales; nunca inventada. Reemplazo inválido conserva grabación anterior; selección del mismo archivo y cancelación recuperables. Micrófono se detiene al salir; sample terminado se conserva al revalidar cuenta/subir; URLs y AudioContext se liberan. Sin carga automática ni nuevo consumo. Modalidad Dialer mantiene límite de micrófono local.

## Archivos/contratos

CallerCharts + CallerCanvas y nuevo tooltip/CSS; CallerAudioRecorder + nuevo CSS/player/guion, CallerOwnVoice/Voices/VoiceStudio, helpers caller-audio y/o caller-voice-capture, tests caller-capture*. Props existentes del recorder compatibles; metadatos opcionales duración para UI. Backend clone/idempotency/auth sin cambios. Sin migraciones/env/dependencias/shell; no activar cuenta/proveedor ni generar voz para probar. Cambios globales propuestos al orquestador.

Base publicación I06-R1 `dpl_FQWyUpDwXu1aQ7yN7fSjDoQwQmFT`, incluye C06-R2+Settings/Usage/créditos. Staging aislado desde archive48b930e8f490ccb20b9b6abdc84d727f2cbbea74317e11bd90fc860c8a3e28f3; overlay explícito propio. Guard de alias antes de publicar preview autorizado; sin push/producción.

## Aceptación y evidencia prevista

Hover puntos/barras/anillo/heatmap/números, teclado/touch/Escape, bounds mobile y datos correctos; gold visible. Recorder con micrófono sintético y WAV fixture: stop/play/seek/upload/download/reset, archivo inválido no destruye muestra, salida libera tracks, metadata/duración honesta. Nombre real precargado, checklist de bloqueo y refresh preservan audio. Plan habilitado + inputs permite POST una vez (transporte fixture; sin proveedor real). Auth/rutas/idempotencia existentes siguen probadas; adaptar fixtures C01 al hook usage de I06 sin eliminarlo. Build/TypeScript/browser aislados, preview HTTPS con cuentas temporales limpias y capturas identificadas. Calidad del clon/audio humano permanece pendiente mientras IVC no esté habilitado.

## Ajuste de integración antes de publicar

20:02UTC: el guard detectó una publicación concurrente y rechazó publicar sobre I06. Base actual KCAL01-R1 (incluye I07-R1 y L01-R6), `dpl_7ze1Pm3bx5ci5QZtwNg5SCTtuEGs`, archive `d53f916dc53c99d72c36588474e014723e2b3769b64095506e552f540fcf8202`. Rebasar snapshot aislado, conservar todos los archivos ajenos y verificar que los11 propios no tengan cambios concurrentes. Repetir build y navegador sobre la base integrada. No modificar otras entregas.

CallerAnalytics marca previews de galería/drag como inert: los nuevos controles de exploración no deben entrar en el orden de foco dentro de una miniatura. Fixture caller-routes reconoce el RPC real de registro de uso añadido en I06; no sustituye autorización ni elimina registro del servicio.

## Implementación y evidencia

C07-R1 implementado, snapshot224 archivos/11 deltas sobre KCAL01-R1. Tooltip común en portal; foco reposicionado tras scroll, Escape limpia selección de tooltip; previews inert. Recorder/player propios con onda del audio, duration fallback medido, botón Stop protegido ante doble clic y archivo inválido no destruye muestra. Guion propio, nombre real y checklist/recheck.

Build/TS y55 unitarias aprobados;6 grupos C07 navegador escritorio/móvil,6 regresiones C03,10 C04 y3 C01. Ver `docs/lanes/reports/C07.md` y `artifacts/lanes/C07/` para publicación/capturas/validación HTTPS y límites reales. Ningún clon humano ni llamada iniciados. API/DDL sin cambios; consolidación docs globales pendiente del orquestador.

Verificación final HTTPS C07:4 grupos PASS con auth real y UI escritorio/móvil,2 cuentas temporales limpias,0 llamadas/clones. Capabilities de deployment confirma Free/cloneAllowedfalse. Preview `dpl_EGN55sjUjXKs6t9UBSLn4aF2Gxuf`; captura/formulario funciona, clon real pendiente de capacidad externa.
