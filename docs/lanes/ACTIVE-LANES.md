# Chats activos e instrucciones — NBC Sales

> Regla vigente de publicación (2026-09-17): `docs/lanes/REVIEW-PROTOCOL.md` desde la raíz. Un pedido de Franco de publicar/pushear autoriza Vercel en el enlace habitual; no reiterar permisos ni entregar localhost. Las restricciones históricas inferiores que contradigan esto quedan reemplazadas.

## Arranque vigente — 2026-09-17

Tres productos: AI Caller, Lead Engine y Master Dashboard (incluye trackers). Un cuarto lane da soporte de conexiones e integración. Encargos completos: [OR04](tasks/OR04-start-2026-09-17.md).

| Nombre del chat | Plataforma / continuidad | Modelo para arrancar | Tarea |
|---|---|---|---|
| NBC 00 · Orquestador | Este chat Codex | Astra alto siempre | Coordinar y revisar |
| NBC 01 · AI Caller | Codex Caller actual, renombrar | Sol alto para contrato; luego Terra medio | C08 |
| NBC 02 · Lead Engine | Nuevo Claude Code | Sonnet medio | L03 |
| NBC 03 · Master Dashboard | Nuevo Claude Code; si ya abriste Master Tracker, renombrarlo | Sonnet medio | TR01 |
| NBC 04 · Conexiones e Integración | Codex Infra/Dashboard/Members actual, renombrar | Terra medio | I10 |

Antes de activar Claude Lead Engine, pausar su escritor Codex anterior y conservar handoff. Academy/Ask Anas permanece pausado. No abrir otro chat para un Master Tracker separado del Master Dashboard. Infra no diseña otro dashboard: implementa configuración, auth, shell común e integración coordinada.

Pegar prompt del lane y asignación OR04, o indicarle leer ambos archivos del proyecto. Al terminar, traer aquí ID y ruta del reporte, no todo el historial. Ver abajo los enlaces a los cuatro prompts y el mensaje para pausar escritores anteriores.

## Referencia de continuidad anterior

Decisión vigente de Franco, 2026-09-16: **orquestador siempre Astra**; los cuatro lanes eligen modelo por tarea y solicitan a Franco el cambio de selector cuando corresponda.

| Chat | Acción | Modelo base | Prompt completo |
|---|---|---|---|
| Orquestador actual | Continuar: coordinación y revisión, sin implementar módulos | Astra / alto siempre | Reglas principales y MODEL-ROUTING |
| Caller actual en Codex | Continuar el mismo chat | Terra / medio | [Caller](prompts/CALLER-CODEX.md) |
| Infra/Dashboard/Members actual en Codex | Continuar el mismo chat | Terra / medio | [Infra](prompts/INFRA-CODEX.md) |
| Lead Engine en Claude Code | Nuevo chat que reemplaza al escritor Codex | Sonnet / medio | [Lead Engine](prompts/LEAD-ENGINE-CLAUDE.md) |
| Master Tracker en Claude Code | Nuevo chat para el foco de tracking | Sonnet / medio | [Tracker](prompts/MASTER-TRACKER-CLAUDE.md) |

## Chats que dejan de implementar

- **Lead Engine anterior en Codex:** pausa y consulta histórica. Guardar cambios/handoff antes de que Claude empiece a escribir.
- **Academy/Ask Anas anterior:** pausado; preservar código, SQL propuesto, reportes y pendientes. No migrar cursos ahora ni asignarle Tracker además del nuevo chat.
- Las revisiones internas terminadas no son lanes de producto ni se mantienen generando tareas.

Mensaje para pegar en cada chat que se pausa:

```text
Pausá nuevas implementaciones. Conservá todos los cambios existentes; no hagas push ni deploy por esta pausa. Si hay trabajo en curso, guardá un handoff breve con archivos modificados, pruebas, pendientes y la operación que todavía esté ejecutándose. Confirmá cuando ya no estés escribiendo en el proyecto. Quedás como consulta histórica; el orquestador coordina el reemplazo.
```

## Orden del traspaso

1. Pegar pausa en Codex Lead Engine y Academy; no borrar chats ni archivos.
2. Pegar el prompt completo de actualización en Caller e Infra existentes.
3. Con el escritor Lead Engine anterior pausado, abrir Claude Lead Engine y pegar su prompt. Si hay delta de handoff posterior a L02, leerlo antes de escribir.
4. Abrir segundo Claude para Master Tracker y pegar su prompt.
5. Cada lane identifica la fase/modelo y pide a Franco cambiar solo si corresponde. Los chats no reciben estas instrucciones automáticamente.

Cinco chats operativos total: root + dos lanes Codex + dos Claude. Los históricos pueden cerrarse visualmente o quedar como consulta; nunca otro escritor del mismo módulo. No se crean nuevos chats por cada cambio de modelo; conservar el mismo chat cuando sea posible.

## Cómo debe avisar cada lane

> Franco, para revisar la idempotencia del Caller, cambiame a Sol con razonamiento alto. Después del contrato y los casos de fallo volvemos a Terra medio. Avisame cuando esté cambiado.

> Terminó la fase crítica. Para implementar el ajuste acotado, cambiame de Opus a Sonnet medio.

En Claude una revisión Astra se envía al orquestador; no se selecciona Astra dentro de Claude. El cambio de selector no autoriza gasto comercial ni publicación. [Política completa](MODEL-ROUTING.md).
