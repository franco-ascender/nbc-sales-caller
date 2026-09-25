# Reparación de login NBC — 2026-09-17

## Resultado

Login restaurado en https://nbc-sales-nbc-sales.vercel.app. Deployment final `dpl_8y5fR8PiTciDHDCfmrXepNkQrsVv`, producción `READY`.

## Causa verificada

`WorkspaceAccess.tsx` crea el cliente de autenticación solo si el bundle contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Las variables de runtime existían solo para `preview`; el build `production` no recibió ninguna de las cuatro variables de autenticación. Por eso el formulario emitía “Workspace access is being prepared” antes de llamar a Supabase. La contraseña, identidad y membresía no eran la causa: la credencial existente autenticó, el correo estaba confirmado y `nbc_members` conservaba `admin / active`.

## Cambio ejecutado

En coordinación con el orquestador se copiaron al target `production`, sin imprimir valores:

- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`encrypted`)
- `SUPABASE_SECRET_KEY` y `NBC_OPERATOR_EMAIL` (`sensitive`)
- `ELEVENLABS_API_KEY` y `ELEVENLABS_AGENT_ID` (`sensitive`), para conservar Caller

Luego se reconstruyó producción. No se copió contraseña, token Vercel, token Supabase Management ni otra clave administrativa; no se creó usuario, no se restableció contraseña y no se cambió rol/RLS. Esta lane detectó que las variables y el rebuild ya se habían creado concurrentemente, evitó duplicarlos y solo añadió la verificación aislada y este reporte.

## Verificación

- URL habitual: HTTP 200
- Login real con credencial vigente: `Overview` visible
- `/api/workspace/session` autenticada: 200
- `/api/workspace/session` anónima: 401
- Alias estable durante la prueba; cero errores de página o requests fallidos

Evidencia: `artifacts/orchestrator/login-repair-20260917/verification.json`, `login-success.png` y `verify-login.mjs`.
