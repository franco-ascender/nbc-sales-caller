# Publicar NBC Sales en Vercel

Franco revisa en **https://nbc-sales-nbc-sales.vercel.app**. Su pedido de publicar/pushear autoriza entregar ahí el trabajo solicitado. Cualquier lane puede ejecutar la publicación; Infra ayuda cuando hace falta. No pedir nuevamente permiso ni entregar localhost como sustituto.

## Comando del proyecto

Desde la raíz del proyecto, comprobar acceso:

```sh
node scripts/vercel-project.mjs --check
```

Después de preparar y probar los cambios pedidos, publicar:

```sh
node scripts/vercel-project.mjs --deploy
```

El wrapper usa la CLI Vercel disponible y lee privadamente `.env.local`: `VERCEL_TOKEN`, `VERCEL_TEAM_ID` y `VERCEL_PROJECT_ID`. Pasa también `VERCEL_ORG_ID` y el scope del equipo. No depende de la cuenta predeterminada del CLI ni imprime el token. Publica en producción del proyecto existente; no crea otro proyecto ni modifica permisos de Claude.

**Causa del error del 17/09:** la CLI recibía `VERCEL_PROJECT_ID` sin `VERCEL_ORG_ID` y rechazaba la operación. El token existente sí tiene acceso al equipo NBC. Un `forbidden` de Vercel no demuestra un bloqueo del sandbox. Ver [diagnóstico y comprobación](lanes/reports/CLAUDE-DEPLOY-BLOCK-2026-09-17.md).

## Permisos de Claude Code

`.claude/settings.json` permite de forma persistente los comandos exactos del wrapper y las pruebas habituales del proyecto; fija `acceptEdits` como modo inicial para las ediciones. Las conversaciones ya abiertas conservan su modo seleccionado, pero Claude recarga las reglas de permisos al cambiar el archivo. No se usa `bypassPermissions` ni se modifica la política administrada.

Además del error anterior del CLI, los logs mostraron rechazos de auto mode `[Production Deploy]`: escribir autorización en CLAUDE.md no configuraba permisos efectivos. La regla allow del comando concreto corresponde al deploy NBC ya autorizado. Usar el wrapper directamente evita pedir aprobaciones nuevas para variantes improvisadas de la misma operación.

Referencia: [permisos oficiales](https://code.claude.com/docs/en/permissions) y [recarga de configuración](https://code.claude.com/docs/en/settings#when-edits-take-effect).

## Preparación y comprobación

- Coordinar una publicación a la vez entre agentes. Preservar cambios de los demás y verificar el estado actual antes de publicar. No ejecutar scripts históricos con snapshots/deployments fijos.
- Revisar el candidato y ejecutar las pruebas pertinentes. `.vercelignore` excluye secretos, artifacts y documentación; no subir `.env.local` ni credenciales administrativas.
- Verificar variables runtime en **production**. Las públicas de Supabase deben existir antes del build; agregarlas después exige reconstruir. No copiar todos los secretos locales a Vercel.
- Esperar READY y comprobar el dominio habitual sin sesión Vercel. Debe mostrar login NBC, nunca “You Need Access”. Mantener protección del proveedor compatible con ese dominio; no desactivar login, roles ni RLS de NBC.
- Comprobar login completo con acceso autorizado existente y el recorrido cambiado. Las APIs privadas deben rechazar anónimos. `/200` por sí solo no demuestra que el usuario pueda entrar.
- Entregar a Franco el enlace habitual y el resultado comprobado. Si una prueba no pudo hacerse, explicarlo sin presentar una compilación como validación del recorrido.

Las operaciones de scrapers, llamadas y compras mantienen su autorización propia: publicar no las ejecuta. GitHub se conecta cuando se confirme la cuenta u organización destino; no bloquea este deploy por CLI.

## Referencias

[Reglas de revisión](lanes/REVIEW-PROTOCOL.md) · [Reparación del login](lanes/reports/LOGIN-REPAIR-2026-09-17.md) · [Reparación del acceso Vercel](lanes/reports/ACCESS-REPAIR-2026-09-17.md).

[Historial anterior de despliegues](lanes/archive/DEPLOYMENT-before-command-fix-2026-09-17.md): archivo de la guía anterior, con rutas relativas originalmente referidas a `docs/`. Sus instrucciones antiguas no sustituyen este procedimiento.
