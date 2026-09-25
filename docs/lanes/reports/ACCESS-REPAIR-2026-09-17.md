# Reparación de acceso habitual — 2026-09-17

## Resultado

Se restauró el acceso a `https://nbc-sales-nbc-sales.vercel.app` sin desplegar, reconstruir ni mover el alias. Antes devolvía `302` a `vercel.com/sso-api`; ahora devuelve `200` y presenta el login propio de NBC Sales.

El alias quedó en el mismo deployment de producción `dpl_HTi3nMWu8GTHPe7zHPt7JsD7pP8k`, estado `READY`. Las rutas privadas anónimas conservan la autenticación de la aplicación: `GET /api/workspace/session`, `GET /api/members` y `GET /api/caller/sessions` devuelven `401` JSON.

## Causa y cambio exacto

La causa era Vercel Authentication a nivel proyecto, con el modo legacy `all_except_custom_domains`. Ese modo interceptaba el dominio habitual `.vercel.app` antes de que la solicitud llegara a NBC.

Se aplicó un único `PATCH /v9/projects/{projectId}` con:

```json
{
  "ssoProtection": {
    "deploymentType": "prod_deployment_urls_and_all_previews"
  }
}
```

Este es el modo Standard Protection documentado por Vercel: el dominio de producción queda accesible y los previews y las URLs directas de deployment siguen protegidos. Se comprobó que la URL directa `nbc-sales-awja113ba-nbc-sales.vercel.app` continúa redirigiendo a Vercel Authentication. No se cambió Password Protection, Trusted IPs, credenciales, cookies, membresías NBC, variables de entorno ni auth de las APIs.

Documentación del contrato usado: [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication) y [Deployment Protection](https://vercel.com/docs/deployment-protection).

## Publicaciones siguientes

No existe un entrypoint de publicación vigente y reutilizable registrado en este workspace. El deployment de producción actual figura creado por un actor externo `claude-code`; el CLI de Vercel tampoco está instalado localmente. Los `scripts/deploy-*-publish.mjs` presentes publican snapshots históricos a `target: staging` y varios fijan deployments base antiguos, por lo que no deben usarse para mover el alias habitual.

El flujo vigente a consolidar para cada publicación es:

1. resolver por API que `nbc-sales-nbc-sales.vercel.app` apunta al deployment de producción actual y guardar su ID como preflight;
2. publicar el candidato revisado directamente con target `production` mediante el publicador actual de Vercel, sin reasignar el alias a un staging histórico;
3. esperar `READY` y confirmar por API que el alias apunta al nuevo deployment esperado;
4. comprobar que el dominio habitual devuelve `200` sin redirect a `vercel.com`, que muestra el login NBC y que las APIs privadas anónimas siguen devolviendo `401`;
5. comprobar que `ssoProtection.deploymentType` sigue siendo `prod_deployment_urls_and_all_previews`.

El equivalente oficial al paso 2 es `vercel deploy --prod` cuando se instale y vincule el CLI al proyecto correcto. Hasta que exista un entrypoint único versionado, el preflight y los postchecks anteriores son obligatorios para evitar que un script histórico vuelva a apuntar el alias a una versión vieja o reintroduzca una barrera de proveedor.

## Rollback

El rollback de esta configuración, si se necesitara, es repetir el PATCH con `ssoProtection.deploymentType = all_except_custom_domains`. El cuerpo exacto quedó en `artifacts/orchestrator/access-repair-20260917/result.json`; no contiene credenciales.
