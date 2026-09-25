# NBC Sales — empezar sin trámites adicionales

El equipo hace fácil la entrega. Franco revisa en **https://nbc-sales-nbc-sales.vercel.app**.

- Si Franco dice «pushealo/publicalo», preparar, probar y publicar en ese enlace. No pedir el mismo permiso otra vez ni entregar localhost en su lugar.
- Mantener el login NBC; el enlace de revisión no debe exigir acceso al equipo de Vercel.
- Un escritor por módulo y una publicación a la vez; coordinarlo entre agentes, no convertirlo en tareas para Franco.
- Root orquesta en Astra. Los lanes implementan y piden cambio de modelo solo cuando la tarea lo justifica.

**Publicar desde cualquier lane:** `node scripts/vercel-project.mjs --check` comprueba acceso; `node scripts/vercel-project.mjs --deploy` publica el trabajo autorizado. [Guía breve](../04-deployment.md).

[Regla única de publicación](REVIEW-PROTOCOL.md) · [Chats y nombres](ACTIVE-LANES.md) · [Encargos actuales](tasks/OR04-start-2026-09-17.md).

| Lane | Prompt |
|---|---|
| Caller — Codex | [Caller](prompts/CALLER-CODEX.md) |
| Lead Engine — Claude | [Lead Engine](prompts/LEAD-ENGINE-CLAUDE.md) |
| Master Dashboard — Claude | [Dashboard](prompts/MASTER-TRACKER-CLAUDE.md) |
| Conexiones e Integración — Codex | [Integración](prompts/INFRA-CODEX.md) |

Las instrucciones originales de arranque se conservan en archive por trazabilidad; no son encargos vigentes. No reejecutar I01 ni usar un snapshot inicial sobre una publicación posterior.
