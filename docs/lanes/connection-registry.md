# Registro privado de conexiones — I10

Actualizado: 2026-09-17. Este registro contiene solo estados y nombres de variables. No contiene valores, tokens, emails, IDs de cuenta, cuotas ni datos de contactos. No es una prueba de acceso remoto.

| Conexión | Estado | Evidencia local | Dueño | Siguiente paso seguro |
|---|---|---|---|---|
| ElevenLabs Agents | configured | Variables de agente y clave presentes; Caller ya tiene adaptador | Caller C08 | Caller valida workspace/agente y prueba controlada según su contrato |
| Twilio | not_configured | No hay variables locales de cuenta, autenticación ni número | Caller C08 | Definir nombres de variables, número propio y límite de piloto antes de configurar |
| Apify | not_configured | `APIFY_API_TOKEN` ausente | Lead Engine L03 | Confirmar si será el proveedor del piloto; luego chequeo read-only permitido por su lane |
| Outscraper / “outcrawler” | blocked | Nombre de proveedor ambiguo y sin variable local | Lead Engine L03 | Franco o Lead confirma si “outcrawler” significa Outscraper y el producto contratado |
| BatchData | not_configured | `BATCHDATA_API_KEY` ausente | Lead Engine L03 | Confirmar caso de uso, endpoint de bajo costo y presupuesto antes de configurar |
| Google Calendar | blocked | ID, client ID, client secret y refresh token ausentes | Infra I10 | Confirmar calendario destino y acceso lector de una identidad dedicada; OAuth solo lectura después |
| GoHighLevel | not_configured | Token, Location ID y Calendar ID locales vacíos | Integración / Infra coordinada | Mantener pendiente hasta que Caller o Dashboard definan el recorrido de prueba |
| Vercel | configured | Hosting existente; no se consultó ni modificó en I10 | Infra / publicador coordinado | Integrar solo un candidato congelado después de revisión y autorización vigentes |

## Reglas operativas

- `configured` solo significa presencia privada de configuración local; no confirma cuenta, permisos, saldo, precio ni adaptador operativo.
- `verified` requiere la comprobación mínima documentada por el dueño, sin cargo o con costo explícitamente autorizado.
- `blocked` identifica una decisión o dato externo que falta. No se resuelve probando contraseñas, cookies o productos no confirmados.
- La configuración remota y `.env.local` tienen un único escritor coordinado. Este registro no autoriza editar ninguna de las dos.
- Antes de publicar se revisa el candidato integrado; no se sube el workspace compartido.
