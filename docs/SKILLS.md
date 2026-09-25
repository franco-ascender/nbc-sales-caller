# Registro de skills y capacidades

Actualizado: 2026-09-12. Catálogo visible en la sesión inicial; no equivale a dependencias del producto ni acredita acceso a cuentas externas.

## Skills disponibles

| Skill | Uso relevante / ejemplo |
|---|---|
| imagegen | Crear recursos gráficos originales cuando se diseñe la marca o interfaz |
| openai-docs | Consultar documentación oficial si se evalúan productos de OpenAI |
| plugin-creator | Crear un plugin si se solicita |
| skill-creator | Crear instrucciones reutilizables si se solicita |
| skill-installer | Instalar una skill solicitada |
| google-drive:google-drive | Buscar o leer material que el usuario tenga en Drive |
| google-drive:google-docs | Crear o editar un Google Doc solicitado |
| google-drive:google-drive-comments | Comentar documentos cuando exista autorización para ello |
| google-drive:google-sheets | Analizar métricas en una hoja conectada |
| google-drive:google-slides | Trabajar sobre una presentación nativa existente |
| plugin-management:plugin-management | Resolver necesidades de acceso a herramientas externas |

## Uso en esta fase

En la fase documental inicial no se aplicó ninguna skill. En la actualización de marca/infraestructura se leyó plugin-management para comprobar posibles conexiones. El usuario eligió tokens API; no se instaló ningún plugin. Los dos documentos fuente son archivos Markdown locales y se leyeron directamente. AInnovate es el método local del proyecto, no una skill instalada.

## Integraciones y herramientas

Lectura/escritura local disponible. Supabase Auth y base de datos verificados. Desde el 2026-09-14, ElevenLabs Agents configurado y conversación de navegador con audio sintético validada. GoHighLevel, telefonía y datos de clientes pendientes. Los plugins recomendados por el entorno no se consideran instalados.

## Historial

2026-09-12: registro inicial de capacidades visibles; cero instalaciones.

2026-09-14: API y SDK oficiales de ElevenLabs consultados directamente; sin nuevos plugins ni skills aplicados. Se usa el LLM gestionado del proveedor, no una integración directa OpenAI/Anthropic.

2026-09-14, plataforma: trabajo paralelo con tres agentes autorizado explícitamente por el usuario. Capacidades de coordinación del entorno, sin instalar plugins ni nuevas skills. Se consultaron guías locales Next.js para grupos de rutas/layouts y tipos SDK de ElevenLabs para mute. Los adjuntos se usan como requisitos y no se ejecuta su master prompt.

## Uso para coordinación — 2026-09-14

Se leyó y aplicó `openai-docs` para consultar la documentación oficial de entornos y worktrees de Codex: https://learn.chatgpt.com/docs/environments/git-worktrees . Worktrees requieren repositorio Git; esta carpeta aún no lo tiene. La ronda usa chats Local con ownership explícito, no aislamiento automático entre conversaciones. No se instalaron skills ni plugins.
