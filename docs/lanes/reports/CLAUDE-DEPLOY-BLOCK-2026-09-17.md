# Diagnóstico de publicación Claude/Vercel — 2026-09-17

## Evidencia verificable

La primera inspección por CLI devolvió `forbidden` con la referencia `support-7375`. Esa señal no identifica un scope ajeno: las consultas posteriores con la misma credencial obtuvieron HTTP 200 para el proyecto NBC Sales y para los deployments `dpl_xc27FA6GSuyuQ3kK18vfDa1PZ7Nr` y `dpl_DjQyJuhJuHxPf6y9TrPSjoizFkSy`, ambos de producción READY y creados por `support-7375` en el mismo equipo/proyecto enlazado localmente.

El enlace local `.vercel/project.json` y las variables locales existentes coinciden con ese proyecto/equipo. La CLI sí falló de forma reproducible cuando `VERCEL_PROJECT_ID` estaba definido sin `VERCEL_ORG_ID`: exige los dos valores para un proyecto enlazado. Con `VERCEL_ORG_ID` igual al equipo y `--scope` explícito, la inspección read-only funciona.

## Causa y solución

No hay evidencia de un bloqueo de sandbox, auto-review ni permiso de Claude. El problema local es una invocación CLI incompleta/ambigua para un proyecto con `VERCEL_PROJECT_ID`: faltaba fijar también `VERCEL_ORG_ID` y el scope de equipo.

`scripts/vercel-project.mjs` carga privadamente las tres variables locales, fija el enlace completo y ejecuta la CLI con scope explícito. Uso comprobado sin publicar:

```sh
node scripts/vercel-project.mjs --check dpl_DjQyJuhJuHxPf6y9TrPSjoizFkSy
```

Para una publicación ya autorizada, el entrypoint es `node scripts/vercel-project.mjs --deploy`. La credencial no se incluye en argumentos ni salida.

## Permiso Claude Code efectivo

Los rechazos observados no provenían de Vercel ni del sandbox: el registro de Claude Code los identifica como `Permission for this action was denied by the Claude Code auto mode classifier`, razón `Production Deploy`. El proyecto ahora limita el permiso a los entrypoints de comprobación y publicación del wrapper, sin habilitar bypasses ni reglas globales.

Se validó con el binario de la extensión Devin 2.1.273 en una sesión efímera, `dontAsk`, sin persistencia y máximo de tres turnos. Claude ejecutó exactamente `node scripts/vercel-project.mjs --check`; resultado: `success: true`, `permission_denials: 0`, `exitcode: 0`. No se creó deployment. Los logs de las sesiones IDE activas no exponen un evento de recarga de settings, por lo que esta comprobación acredita las sesiones nuevas; una sesión IDE ya abierta puede necesitar reiniciarse para tomar cambios de configuración.
