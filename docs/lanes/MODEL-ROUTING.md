# Selección de modelos y control de tokens — NBC

> Regla vigente de publicación (2026-09-17): `docs/lanes/REVIEW-PROTOCOL.md` desde la raíz. Un pedido de Franco de publicar/pushear autoriza Vercel en el enlace habitual; no reiterar permisos ni entregar localhost. Las restricciones históricas inferiores que contradigan esto quedan reemplazadas.

Versión 2, 2026-09-16. Primero cerrar este sistema; después reasignar tareas de producto. Pedido de Franco: el chat principal orquesta y los lanes implementan. No convertir al orquestador en otro escritor de Caller, Lead Engine o Infra.

## Responsabilidades y selección

Orquestador: delimitar tarea/archivos/aceptación, elegir modelo, resolver contratos, revisar entrega y consolidar. Lanes: implementar, probar y reportar. Una tarea tiene un escritor; Claude reemplaza o complementa un trabajo independiente, no duplica al lane Codex sobre los mismos archivos.

Elegimos el modelo de menor costo **entre los adecuados para el riesgo y la tarea**. Esta es una política inicial, no un benchmark que pruebe cuál es mejor en NBC. Se ajusta con costo por tarea aceptada, fallos y retrabajo.

| Trabajo | Codex | Claude alternativo | Esfuerzo inicial |
|---|---|---|---|
| Inventario dirigido, documentación, corrección mecánica acotada | Luna | Haiku | Bajo, si el modelo lo admite |
| Implementación habitual, pruebas, UI funcional, integración conocida | Terra | Sonnet | Medio |
| Orquestador principal, por instrucción de Franco | **Astra siempre** | No se traslada a Claude | Alto; sin max por defecto |
| Auth, dinero, SQL/migraciones, decisiones de arquitectura difíciles | Sol | Opus | Alto, tarea acotada |
| Bloqueo complejo que supera el nivel anterior | Astra, con motivo registrado | Opus; Fable solo tras evaluación específica | Alto; no max por defecto |

Las categorías críticas no pasan primero por un modelo pequeño solo para ahorrar. Una integración con idempotencia, costos o aislamiento se separa en contrato/revisión crítica y ejecución acotada. Una prueba fallida por selector, entorno o credenciales no justifica automáticamente un modelo más grande.

**Claude:** el usuario informa créditos disponibles; pendiente distinguir plan incluido de saldo API y comprobar modelo accesible. Con cuota incluida confirmada, Sonnet es primera opción para la próxima tarea de implementación compatible que se le asigne. Si es saldo API, se compara costo total estimado y calidad: saldo comprado no significa costo cero. No se abre una nueva cuenta ni se cambia autenticación por inferencia. Los aliases `sonnet`/`opus` dependen del proveedor: registrar el modelo efectivo mostrado por la sesión.

## Costo de referencia, sin mezclar unidades

Verificado el 2026-09-16. Tarifas publicadas; no son la factura de NBC ni medición de nuestros $400. Revisarlas si cambia modelo, plan, velocidad o proveedor.

Codex, **créditos por millón de tokens** (entrada / entrada cacheada / salida):

| Modelo | Entrada | Caché | Salida |
|---|---:|---:|---:|
| Luna | 5 | 0,5 | 30 |
| Terra | 50 | 5 | 300 |
| Sol | 100 | 10 | 500 |
| Astra | 250 | 25 | 1.250 |

Fuente: [precios Codex](https://learn.chatgpt.com/docs/pricing). No convertir créditos a USD sin el precio del plan/acuerdo. Fast tiene recargo; no activarlo por defecto para ahorrar tiempo sin considerar costo.

Claude API directa, **USD por millón de tokens** (entrada / lectura de caché / salida): Haiku 4.5 **1 / 0,10 / 5**; Sonnet 5 **2 / 0,20 / 10**; Opus 5 **5 / 0,50 / 25**; Fable 5.1 **10 / 0,25 / 50**. Las escrituras de caché y herramientas tienen cargos adicionales según modalidad. Estas tarifas no equivalen al consumo de una cuota de Claude Code. Fuente: [precios Anthropic](https://platform.claude.com/docs/en/about-claude/pricing).

Comparar unidades homogéneas y el trabajo terminado, no solo precio por token. Para API: sumar entrada no cacheada, lecturas/escrituras de caché, salida facturada y herramientas; evitar contar dos veces caché dentro del total de entrada. Para Codex créditos, usar su rate card. Reasoning facturado y reintentos también cuentan. No prometer un porcentaje de ahorro antes de medir.

## Selector local

Política: `docs/lanes/model-routing-policy.json`. Comando sin APIs ni consumo:

```sh
node scripts/route-lane-task.mjs --task integration
node scripts/route-lane-task.mjs --task auth
node scripts/route-lane-task.mjs --task integration --provider claude --claude-available --billing included
```

El tercer ejemplo es válido **después** de confirmar cuota/acceso; esos flags son declaraciones del operador, no verificaciones automáticas. `--billing api` distingue pago por API; `unknown` impide declarar Claude listo. El resultado clasifica tarea, modelo/esfuerzo, motivo y estado. No ejecuta el modelo, cambia chats ni cobra. Flags incorrectos fallan; no sustituir por Astra silenciosamente.

Para escalar: registrar fallo reproducible, lo ya intentado y por qué falta capacidad. `--escalate --reason 'motivo concreto'` sube un nivel; llegar a Astra en un lane requiere además `--exceptional`. `--task orchestration` usa la excepción fija Astra/Codex, sin ese flag; no usar esa categoría para disfrazar implementación como coordinación. Tras dos intentos fallidos, `--attempts 2` devuelve necesidad de replanteo, no inicia otro bucle. Estos son controles del selector, no límites técnicos del proveedor; no borrar el contador para eludirlos. Dividir un trabajo y resolver una dependencia puede ser mejor que escalar.

## Contexto y ejecución

- Un lane conserva contexto del módulo, pero recibe un encargo incremental por entrega. No reenviar los cuatro reportes históricos ni el chat del orquestador. Un chat nuevo lee instrucciones necesarias; uno existente consulta cambios y archivos relevantes.
- Buscar símbolos/rutas y leer fragmentos primero. Herramientas devuelven resúmenes y rutas de logs; no volcar miles de líneas ni repetir archivos ya leídos sin cambios.
- Handoff con objetivo, estado fiable, archivos exclusivos, contratos, aceptación, modelo y dependencia. Objetivo orientativo: 500–800 palabras máximo; ampliar solo por complejidad real. Reporte corto de resultado con enlaces a evidencia, no otro consolidado histórico.
- Los agentes internos se abren con `fork_turns="none"` y un encargo autosuficiente cuando no necesitan historia. Siempre especificar modelo/esfuerzo; evitar heredar Astra. Chats externos no reciben mensajes ni cambian modelo por editar este documento.
- Pruebas afectadas durante implementación y una comprobación integrada al cierre. Una segunda revisión independiente se reserva para permisos, dinero, migraciones o riesgo comparable; no hacer revisar cada cambio simple por cuatro modelos.
- Antes de cambiar a una tarea ajena al contexto, crear handoff breve. No reiniciar compulsivamente sesiones del mismo trabajo: también se pierde caché útil. Compacción/resumen debe conservar decisiones, archivos, pruebas y pendientes.

## Aplicación en los chats existentes

Inventario local: `~/.codex-devin/config.toml` tenía Astra/high; Luna, Terra y Sol figuran en metadata instalada. Claude Code está instalado; no se consultaron saldos ni se abrió autenticación. Solo se prepara default del **proyecto**: Codex Terra/medium y Claude Sonnet/medium. No cambiar cuentas ni defaults personales globales.

[Codex permite overrides de proyecto](https://learn.chatgpt.com/docs/config-file/config-basic). Un chat abierto puede conservar su selección: comprobar su selector y cambiarlo al modelo del encargo antes de continuar. No afirmar que los cuatro lanes cambiaron automáticamente. Este turno del orquestador tampoco cambia de modelo al escribir configuración; mantener Astra en el selector del orquestador. El default Terra del proyecto corresponde a los lanes y no reemplaza esta excepción explícita.

En Claude, usar `/model sonnet` y esfuerzo medio para implementación; la configuración del host puede prevalecer. Ver [configuración Claude](https://code.claude.com/docs/en/model-config) y [control de costos](https://code.claude.com/docs/en/costs). Modelos sin control de esfuerzo no deben recibir flags incompatibles. No activar modo `best`, Fable o máximos como default de todos los trabajos.

## Registro y evaluación

Antes de asignar: ID, lane, problema, clase/riesgo, modelo/esfuerzo, presupuesto de trabajo y criterios de éxito. Después: modelo efectivo, fuente de facturación, tokens si disponibles, costo y unidad, duración, intentos, pruebas/aceptación y retrabajo. Plantilla: `docs/lanes/TASK-COST-TEMPLATE.json`. `null` significa desconocido, nunca cero.

Tras cinco tareas comparables aceptadas, revisar costo mediano total y tasa de aceptación sin retrabajo por clase/modelo. Cambiar la preferencia solo con evidencia suficiente; no volver a implementar tareas terminadas para fabricar un benchmark. Separar gasto de construcción de consumo runtime NBC.

No hay presupuesto diario numérico acordado, saldo consultado ni corte de gasto configurado. Las pausas por intentos son disciplina operativa. Si se requiere un corte monetario, debe configurarse en el proveedor/ejecutor correspondiente y verificarse; este sistema no finge imponerlo.

## Siguiente paso

Una vez revisado este sistema: redefinir prioridades y asignar una primera tarea pequeña por lane con modelo explícito. No lanzar C08/L02/TR01/I10 automáticamente. Cambios locales L02/T1 previos se preservan y se entregan al propietario; el orquestador vuelve a coordinación/revisión.


## Distribución estable de chats — 2026-09-16

Recomendación registrada ante la pregunta de Franco sobre cantidad y plataformas: cinco chats abiertos en total, uno de orquestación y cuatro lanes. Orquestador Codex **Astra/high siempre**, por instrucción explícita posterior de Franco. Dos lanes Codex: Caller y Infra/integración, ambos Terra/medium para implementación habitual. Dos lanes Claude: Lead Engine y Master Tracker, Sonnet/medium, sujeto a acceso y modalidad de cuota ya pendientes de confirmar. Las tareas críticas se clasifican y escalan según esta política; no fijar Astra/Opus para todo un lane.

Mantener chats abiertos no significa mantener cuatro trabajos generando continuamente. Activar los cuatro cuando tengan tareas independientes y ownership claro; pausar el que espera insumos o integración. No crear un quinto lane de producto ni duplicar un escritor por añadir Claude. Esta distribución no lanza tareas, cambia selectores del IDE ni confirma saldo. Preparar handoff al mover Lead Engine desde su chat Codex anterior a Claude; dejar el anterior como consulta, sin trabajo simultáneo.


## Protocolo obligatorio de cambio de modelo

Antes de una tarea nueva o de una fase con riesgo distinto, cada lane declara: tarea, modelo/esfuerzo recomendado, motivo, alcance de esa fase y modelo al que volverá. Debe elegir por el trabajo concreto, no por nombre del lane ni por tamaño aparente del archivo. Usar selector como ayuda; riesgo de auth, pagos, aislamiento o migraciones exige clasificación crítica.

Si ya está en el modelo adecuado y lo sabe, informar en una línea y continuar dentro del encargo, sin pedir confirmación repetida. Si no puede conocer el modelo efectivo, no inventarlo: pedir a Franco comprobar el selector. Si hace falta cambiar, escribir exactamente en este formato:

> Franco, para [fase concreta], cambiame a [modelo] con razonamiento [nivel]. Motivo: [riesgo o dificultad concreta]. Lo usaré para [entrega acotada]; después volvemos a [modelo base]. Avisame cuando esté cambiado.

No simular un cambio por escribirlo. Mientras espera, conservar estado y preparar un handoff corto; no ejecutar la fase dependiente bajo un modelo distinto del acordado ni gastar turnos esperando. Confirmación del selector o de Franco permite continuar, no el tiempo transcurrido. No hace falta cambiar por cada comando/test: agrupar una fase coherente y reutilizar caché/contexto.

Al terminar una fase costosa, pedir explícitamente volver al modelo base antes del siguiente trabajo rutinario. Dos intentos fallidos provocan reporte de bloqueo y replanteo, no bucle ni escalada silenciosa. La selección de modelo no autoriza push, deployment, gasto API o ampliar scope.

Un lane Claude no puede pedir seleccionar Astra dentro de Claude. Usa Sonnet/Haiku/Opus accesibles; si hace falta revisión Astra, entrega una pregunta técnica y evidencia al orquestador, que permanece en Astra. Un lane Codex puede solicitar Luna/Terra/Sol/Astra disponibles. Fable no es fallback automático.

Prompts vigentes por chat: `docs/lanes/prompts/`. Codex Caller e Infra continúan sus chats. Codex Lead Engine y Academy/Ask Anas antiguos quedan en pausa/consulta; guardar handoff si tienen cambios en curso antes de activar sus reemplazos. No borrar historial, código ni evidencia. Claude Lead Engine y Claude Master Tracker son los dos nuevos escritores. El traspaso de Lead Engine requiere confirmación de que su antiguo escritor está pausado.


## Arranque de producto del 2026-09-17

Distribución oficial en ACTIVE-LANES y encargos OR04. Master Tracker pasa a llamarse **Master Dashboard**, incluye todos los trackers; Infra se llama **Conexiones e Integración**, soporte sin dashboard propio. C08 empieza Sol alto por contrato telefónico/eventos/gasto, luego Terra medio. L03 y TR01 empiezan Sonnet medio; I10 Terra medio. No iniciar modelos caros para la tarea completa ni dejar fases ambiguas sin pedir datos. La pausa de asignación de OPT01 queda superada por este arranque explícito de Franco.
