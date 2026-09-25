# Handoff S01 — sesión12h — 2026-09-15

Publicado y verificado en **https://nbc-sales-nbc-sales.vercel.app**. Usar siempre este enlace con Franco. Deployment `dpl_65U6x6EsvJ5gXeyobJ2vd6KkrAsE`, READY staging. Base C03-R1/I02-R4/K01 preservada;125 runtime. Próximos despliegues deben conservar snapshot artifacts/lanes/S01/nbc-sales-S01-R1.tar.gz o sus tres deltas en runtime-manifest.json.

WorkspaceAccess/CSS + workspace-session-storage: login explícito crea ventana fija12h compartida por pestañas del mismo perfil/origen. Restore validado en GET /api/workspace/session, nunca autorización por bandera local. Password no se guarda, sí sesión SDK en localStorage acotada. Refresh no extiende; logout/expiry cierran otras pestañas;403 limpia,503 permite retry. Auth/API/RLS servidor sin cambios.

4 unitarias,6 checks fixture con reloj/races/errores y4 checks Auth real en cada entorno local/HTTPS pasan; build local/cloud aprobados. No12h de espera real; no datos privados en evidencia. Estado completo y deltas globales: docs/lanes/reports/S01.md. Feature: docs/features/workspace-session.md. Infra/orquestador debe consolidar política de memoria anterior y adaptar pruebas históricas que esperaban login en cada tab.

Request actual amplió ownership de Academy a este cambio de auth. Autorización para publicar en mismo Vercel vigente; aceptación visual/revisión técnica pendientes. Push/SQL no ejecutados. No se inicia otra tarea.
