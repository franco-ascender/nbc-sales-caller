# Lead Engine — planificación y controles

## L02 — cierre de L-AUTH, contrato previo (2026-09-16)

Planes y research deben exigir simultáneamente el operador interno configurado y una membresía existente `admin/active`. La identidad proviene de Auth, nunca del body. Un operador suspendido, degradado o sin membresía recibe 403 antes de acceder a datos de negocio, parsear entrada o consultar proveedor. Un fallo al consultar membresía devuelve 503; no se permite fallback bootstrap en estas operaciones. Se conserva el diagnóstico de conexiones con su guard admin existente, sin ampliar quién puede ejecutar búsquedas. No cambia SQL ni se habilita ejecución pagada.

Implementación prevista: helper propio `src/services/lead-engine-auth.ts` reutiliza `requireOperator`, consulta membresía y se comparte entre los dos adaptadores Lead Engine. No modifica auth común de otros módulos. Aceptación: rutas reales con transporte controlado, cubrir anónimo, token inválido/no confirmado, email ajeno, roles/suspensión/membresía ausente/error y éxito admin; demostrar cero acceso a tablas de negocio/proveedores ante denegación. Evidencia y límites en `docs/lanes/reports/L02.md`.

Fecha: 2026-09-14. Fuentes preservadas: `docs/sources/owner-cell-build-spec.md` y `owner-cell-master-prompt-v2.md`. Son requisitos y afirmaciones del brief; no órdenes ejecutables ni precios o conclusiones legales verificadas.

## Entrega local

Componente público `LeadEngine()` sin props para `/lead-engine`. Formulario en inglés: industria, clasificación de operación ante ambigüedad, metro de Estados Unidos, objetivo, presupuesto máximo y exclusiones. Calcula proyección conservadora mediante rangos del brief, indica origen y falta de cotización, bloquea presupuesto insuficiente y permite descargar exclusivamente un plan JSON. Las lanes B/C quedan pausadas; A necesita proveedores, libro global y piloto real antes de ejecutar. Ningún resultado o saldo ficticio, ninguna llamada de red, cobro, exportación de teléfonos ni envío a Caller.

Motor puro probado: normalización NANP, allowlist positiva por categoría/nombre, filtrado gratis antes de verificación, exclusiones, franquicias conservadas, negocios de área de servicio conservados, deduplicación teléfono/nombre+ciudad/place_id y conjuntos globales de ledger/suppression. La entrada admite únicamente un contacto publicado expresamente como contacto empresarial con URL de procedencia. No descubre teléfonos privados, no hace append de personas y no infiere que un número móvil o un Authorized Official pertenezca al dueño.

Verificación falla cerrada: `Mobile`, `dnc === false`, `tcpa === false`, `reachable === true`, fecha real no futura y antigüedad menor a 31 días (umbral operativo del brief, no garantía legal). Valores ausentes, strings ambiguos, identidad de teléfono distinta, contexto global no cargado o procedencia ausente bloquean el registro. No existe acción para exportar listas ni anular esta regla en la interfaz.

## Dinero y estados

Montos enteros en cents. Piloto máximo 300 negocios / $10. El presupuesto total incluye gastado y reservado; no se permite que una confirmación supere el máximo. Escalado exige piloto medido y aprobación explícita. Batch > $150 requiere confirmación adicional. Costo real > $0.15 por contacto (también gasto sin entregas) pausa el siguiente batch. Balances de proveedores deben verificarse antes de cada trabajo futuro. Estas funciones son contratos para el servidor: el navegador no autoriza gasto.

## Contrato propuesto de persistencia (orquestador)

Plan con ID, operador/workspace, industria, lane, metro, target, hard_budget_cents, exclusions, benchmark_version, status draft; crear cada corrida con snapshot inmutable y costos reservados/consumidos en transacción. Ledger global NBC de búsquedas, negocios procesados, entregas y supresiones permanentes. Los servicios filtran permisos y no exponen contactos entre clientes. Un claim único de teléfono/búsqueda debe preceder cualquier cobro; usar idempotency key y reserva de presupuesto atómica. Nunca confiar en los sets enviados por navegador para una operación pagada. No se aplica migración en este lane.

## Tensiones por resolver antes del piloto

- Lane A: el brief mezcla 18.7% medido con rango 20–30%; se conserva 18.7% como benchmark declarado, no rendimiento garantizado.
- Lane B: Authorized Official no demuestra propiedad; el pipeline no fue validado end-to-end según el propio documento. No se implementa append personal.
- Lane C: benchmark $0.20–0.50 supera stop-loss $0.15; bloqueado hasta rediseño y decisión explícita.
- Datazapp mínimo declarado $125 contradice carga máxima $100; no se crean cuentas ni se compra saldo.
- DNC 15–60% es señal de anomalía de muestra, no prueba automática de cumplimiento. Horarios, origen, consentimientos y obligaciones requieren validación específica antes de una campaña. Sin campaña habilitada en esta entrega.

## Implementación entregada

- `src/components/lead-engine/LeadEngine.tsx` y `LeadEngine.module.css`: formulario reactivo, lane, forecast, presupuesto, etapas y estados pendientes, descarga de borrador JSON.
- `src/lib/lead-engine-plan.ts`: router, parsing decimal exacto, validación `City, ST` con códigos de estado reales (sin geocodificación), benchmark etiquetado y gates de gasto puros.
- `src/lib/lead-engine-quality.ts`: normalización de contactos empresariales, filtro previo, deduplicación, contrato de flags y elegibilidad cerrada. La procedencia se exige como dato; una URL por sí sola no demuestra la veracidad del contacto y deberá verificarse al conectar fuentes.
- `tests/lead-engine-plan.test.ts` y `tests/lead-engine-quality.test.ts`: 12 pruebas unitarias aprobadas, sin red ni gasto.

No se integra aún este motor a jobs o DB. Tampoco hay exportación de listas, ordenación por fit/timezone, aprobaciones persistidas ni integración de proveedores. La interfaz ofrece exclusivamente descarga de plan; el motor es base para esos servicios futuros.

## Validación

Tests adversariales de normalización, router ambiguo, presupuesto/overflow, gates de piloto/batch, señales desconocidas, fecha futura/vencida, supresión y duplicados entre industrias. Build y navegador quedan a cargo del orquestador después de integrar lanes.

## L01 — contrato previo a implementación (2026-09-14, revisión 1)

Estado: EN DESARROLLO. Esta sección reemplaza el alcance histórico «solo local» para L01. Objetivo: guardar/abrir snapshots inmutables y preparar un dry-run persistido sin proveedores. Scope fijo `nbc-internal`, operador obtenido con `requireOperator`; no tenants SaaS. No endpoints de ejecución, saldos, aprobación ni exportación de contactos.

Flujo: editar → exportar borrador (siempre local) → login de operador en el módulo → guardar snapshot con UUID idempotente → listar páginas de 20 → abrir snapshot propio → preparar dry-run con UUID estable. Editar un snapshot genera un nuevo plan. Un timeout conserva identidad para reintentar; conflictos de identidad/payload devuelven 409. Migración/configuración ausente devuelve 503 con código `storage_pending`; la UI conserva campos y export, distingue fallo transitorio `storage_unavailable`, nunca muestra guardado ficticio.

### Entidades y propiedad

Todas las tablas llevan prefijo `lead_engine_`. `plans`: UUID, operator_id FK auth.users, scope fijo, input JSONB validado, lane/benchmark/forecast autoritativos, hard_budget_cents, status draft/paused/archived, timestamps. El input no cambia; aprobación no es parte del payload.

`control`: singleton NBC, ejecución deshabilitada inicialmente y mutex transaccional global. `provider_accounts`: proveedor, saldo verificado, reservado, consumido desde esa verificación, fecha/expiración/evidencia. Sin seeds de saldo ni proveedores conectados. `plan_approvals`: evidencia de piloto medido/aprobado, proyección medida y referencia de revisión; solo servidor futuro. `batches`: plan/operador por FK compuesta, UUID/idempotencia, snapshot de stage, límite de negocios/costo, proveedor, búsquedas y negocios a reclamar; aprobación de lote grande privada. Estados dry_run/prepared/reserved/uncertain/completed/partial/failed. `costs`: un evento final por batch, consumo real y monto liberado. `searches`: source + query + metro normalizados únicos globales; `businesses`: phone10, name_city y place_id únicos globales; ambos retienen el claim aun con fallo parcial para no pagar nuevamente. `deliveries`: phone10 único global, batch/plan propios y evidencia de verificación; sin API de listas. `suppressions`: phone10 PK global permanente, motivo/origen/fecha; sin DELETE ni expiración.

### Transacciones y gates

RPCs `SECURITY INVOKER`, search_path fijo y EXECUTE solo service_role. RLS habilitada en todas las tablas, sin políticas anon/authenticated; revocar accesos directos. Backend privilegiado usa siempre ownership y no devuelve ledgers globales. No se afirma que service_role esté aislado de otros permisos de Supabase.

El mutex de `control` se toma `FOR UPDATE` antes de reserva, resolución o supresión. Con serialización global inicial, una sola transacción evalúa estado/ownership, aprobación privada, proveedor/saldo fresco, presupuesto total (consumido + reservado), piloto acumulado ≤300/$10, forecast, lote >$150 y stop-loss histórico; luego reclama búsquedas/negocios y reserva. Claves únicas protegen identidades entre planes e industrias. Si cualquier claim falla, rollback de toda la reserva. Repetir el batch devuelve el mismo estado; no vuelve a cobrar. Se elige serialización global por simplicidad verificable del alcance interno; revisar throughput antes de múltiples clientes.

Resolución: reserved → completed/partial/failed con consumo confirmado ≤reserva y liberación del remanente en la misma transacción. Resultado ambiguo reserved → uncertain mantiene todo reservado y pausa plan. uncertain → resultado final exige evidencia; no hay reintento de proveedor ni caducidad que libere fondos automáticamente. Costos >reserva requieren reconciliación fuera de L01 y bloquean resolución; nunca ocultar sobreconsumo. Claim permanece para revisión manual. Un dry-run no transiciona a reserved: futura preparación requiere nuevo batch y contrato verificado. Entregas/supresión comparten mutex; después de supresión no se admite nueva entrega.

### API v1

- GET `/api/lead-engine/plans?offset=0`: 20 snapshots propios, `nextOffset` o null.
- POST `/api/lead-engine/plans`: `{version:1, planId:UUIDv4, input:{industry,metro,target,hardBudgetCents,exclusions,operation?}}`. Rechazar campos extra, tipos coercibles, límites inválidos. Lane, benchmark y forecast recalculados. Devuelve `{plan}`; UUID/payload idéntico idempotente, distinto 409.
- GET `/api/lead-engine/plans/:id`: `{plan}`, 404 si ajeno/inexistente.
- POST `/api/lead-engine/plans/:id/dry-run`: `{version:1, batchId:UUIDv4}`. Lee plan y controles en Postgres, persiste diagnóstico con `executionEnabled:false`, 300 negocios/$10 como límites, cero reserva/costo/claims; bloqueos explícitos. Solo draft, 409 para pausado/archivado. Reintento retorna diagnóstico original; nuevo UUID solicita diagnóstico nuevo.

Todos usan Bearer validado, JSON ≤8 KiB y no-store. Errores 400/401/403/404/409/413/415/503; mensajes saneados. No nuevas variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, NBC_OPERATOR_EMAIL.

### Archivos y aceptación

Escritura limitada al ownership L01: componentes propios (incluido panel de persistencia), lib lead-engine types/validation, servicios lead-engine, rutas propias, tests lead-engine, migración reservada, feature/handoff/reporte/artifacts. Auth común sin cambios. Criterios: guardar/leer autenticado cuando integrada; timeout/reintento seguro; SQL concurrente sin doble presupuesto; dedupe y supresión transversal; estados honestos y export intacto; ninguna ejecución de proveedor. Tests SQL entregados aunque no haya Postgres aislado. No se encontró psql/postgres/initdb/docker ni instalación Homebrew de Postgres: ejecución SQL real pendiente salvo disponibilidad posterior. Build/navegador solo copia aislada.

Referencia técnica consultada: [Postgres, bloqueo explícito](https://www.postgresql.org/docs/17/explicit-locking.html). Un lock de fila se mantiene hasta terminar la transacción; se usa para serializar decisiones del ledger interno. Las guías Next.js se leyeron en node_modules/next/dist/docs.

Ajuste del contrato durante autorrevisión: el ledger de negocios también admite negocios descartados por filtros gratuitos (`disposition=filtered`, `drop_reason` requerido, teléfono opcional). Así se puede recordar un negocio sin teléfono sin habilitar verificación pagada. Un claim pagado conserva `disposition=claimed`, exige teléfono y no admite motivo de descarte. No hay endpoint de ingesta en L01. Las entregas conservan evidencia y el estado posterior se obtiene del batch; no se sobreescriben claims.

## L01 — implementación y diccionario entregados

Estado histórico r1, 2026-09-14: **PARCIAL CON DEPENDENCIA**. Código y UI revisables; migración PROPUESTA, NO APLICADA ni ejecutada en Postgres aislado. Las 20 unitarias y el build aislado pasan. Las pruebas del navegador combinan planificación/export reales y rechazo anónimo real con fixtures explícitos para guardar/abrir/dry-run. No hay scraper conectado. Evidencia/reproducción: `docs/lanes/reports/L01.md`.

Diccionario de esquema (`public.lead_engine_*`, SQL exacto en `supabase/migrations/202609140010_lead_engine.sql`). Columnas NOT NULL salvo las marcadas `?`; todos los tiempos son timestamptz, todos los montos son integer cents; IDs uuid. FKs sin cascada de borrado.

| Tabla | Columnas y claves | Constraints/índices |
|---|---|---|
| control | scope text PK default nbc-internal; execution_enabled bool default false | scope único/fijo, fila mutex; no saldo simulado |
| plans | id PK; operator_id FK auth.users; scope FK control default nbc-internal; input jsonb; lane text; benchmark_version text; forecast_cents int; hard_budget_cents int; status text default draft; created_at default now | UNIQUE(id,operator_id); índice operador/fecha/id; lane A/B/C; forecast>0; budget 1..999999999; input objeto; trigger snapshot inmutable salvo estado |
| provider_accounts | provider text PK; balance_cents int; reserved_cents/consumed_cents int default0; verified_at/valid_until; evidence_ref text | balance≥reserved+consumed, todos ≥0; valid_until>verified_at; nombre restringido, evidencia1..300; no seeds |
| plan_approvals | plan_id PK/FK plans; pilot_measured_at, pilot_approved_at; approved_by FK auth.users; measured_forecast_cents int; evidence_ref text | proyección>0; evidencia1..300; append-only; sin UI/API de aprobación |
| batches | id PK; plan_id/operator_id FK compuesta plans; stage/status text; businesses/estimate_cents int; reserved_cents/consumed_cents/delivered_count int default0; provider? FK accounts; search_claims/business_claims jsonb default[]; large_approved_at?; large_approved_by? FK auth.users; evidence_ref? text; dry_run? jsonb; created_at default now; settled_at? | UNIQUE(id,plan_id,operator_id); índice plan/fecha; businesses1..100000; estimate1..999999999; claims arrays≤300; consumed+reserved≤estimate; delivered≤businesses; aprobación fecha/autor ambos null o presentes; estados/reservas consistentes; trigger transición |
| costs | batch_id PK/FK batches; consumed_cents/released_cents int; outcome/evidence_ref text; created_at default now | montos≥0, outcome completed/partial/failed; un settlement final por batch; append-only |
| searches | source/query/metro text PK compuesta global; batch_id FK batches; claimed_at default now | source slug1..60; query/metro normalizados minúscula ASCII con espacios1..150; no duplicado entre planes/industrias; append-only |
| businesses | id PK default gen_random_uuid(); phone10? text UNIQUE; disposition text default claimed; drop_reason? text; name_city text UNIQUE; place_id? text UNIQUE; source_url text; batch_id FK batches; claimed_at default now | teléfono NANP10; claimed requiere teléfono y sin drop_reason; filtered requiere motivo1..300; name_city normalizado≤300; place≤200; source_url HTTPS≤2000; append-only |
| suppressions | phone10 text PK; reason/evidence_ref text; added_at default now | NANP10; opt_out/complaint/wrong_number/bad_fit; permanente; trigger mutex; sin update/delete |
| deliveries | phone10 text PK/FK businesses(phone10); batch_id/plan_id/operator_id FK compuesta batches; line_type text; dnc/tcpa/reachable bool; verified_at; time_zone/evidence_ref text; delivered_at default now | Mobile/false/false/true estrictos; trigger impide supresión, verificación futura o≥31d, zona inexistente, batch ajeno/no reservado o claim de otro batch; append-only |

`source_url` y `evidence_ref` son referencias, no prueba automática de legitimidad. Los futuros adaptadores deben comprobar la fuente empresarial y filtros gratuitos. `time_zone` se valida como zona IANA existente; **la correspondencia con la dirección/estado aún requiere el adaptador y no está certificada por este esquema**. No hay tabla owners, append personal ni import/export de contactos en L01.

### Permisos exactos y funciones

Para cada una de las diez tablas: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY; REVOKE ALL ... FROM public,anon,authenticated,service_role; GRANT SELECT,INSERT ... TO service_role;`. Solo control/plans/provider_accounts/batches reciben además UPDATE. No se concede DELETE, TRUNCATE ni acceso a anon/authenticated. **No se crean políticas RLS de acceso de cliente**; se conserva default-deny. service_role de Supabase usa BYPASSRLS: ownership se comprueba explícitamente en las rutas/RPC, nunca constituye aislamiento SaaS multiempresa.

Nueve funciones: `lead_engine_immutable`, `lead_engine_plan_transition`, `lead_engine_batch_transition`, `lead_engine_contact_gate` (triggers); `lead_engine_save_plan(uuid,uuid,jsonb,text,text,integer,integer)`, `lead_engine_blockers(uuid,text,integer,integer,text,boolean)`, `lead_engine_dry_run(uuid,uuid,uuid)`, `lead_engine_reserve_batch(uuid,uuid)`, `lead_engine_settle_batch(uuid,uuid,text,integer,text)`. Todas SECURITY INVOKER, `search_path=pg_catalog,public`, EXECUTE revocado a PUBLIC/anon/authenticated y concedido exclusivamente a service_role. SQL dinámico del bloque final se limita a nombres literales del esquema; no entradas de usuario.

El prefijo `lead_engine_` está reservado a L01. Tras integrar, la migración no se edita ni reejecuta; una corrección requiere nueva asignación/migración. No hay rollback automático destructivo. Reconciliar historial CLI y refrescar schema cache de PostgREST al integrar.

### Contratos de respuesta definitivos

Las cuatro rutas devuelven HTTP 200 en éxito (incluidos reintentos): POST/GET individual `{plan:{id,status,createdAt,input,plan}}`; listado `{plans:[...],nextOffset:number|null}`; dry-run `{dryRun:{version:1,batchId,planId,status:"dry_run",executionEnabled:false,maxBusinesses:300,maxCostCents:1000,reservedCents:0,consumedCents:0,claimsCreated:0,blockers:string[],checkedAt}}`. Los detalles derivados `plan` se recalculan con el benchmark v1 vigente para visualización; input, forecast/lane/benchmark del registro SQL son inmutables y las reservas usan los valores SQL. Antes de cambiar benchmarks, versionar también su lectura en UI para no reinterpretar snapshots históricos.

Errores `{error,code}`: `invalid_input`400; auth común401/403; `access_pending`503 para configuración de acceso; `not_found`404 ajeno/inexistente; `idempotency_conflict`409; `invalid_state`409; `storage_pending`503 para configuración, relación o RPC ausente; `storage_unavailable`503 para error transitorio/permisos SQL; `access_or_input_error`413/415/400 por body común; `request_failed`503 para excepción no prevista. No se envían detalles SQL. UUID v4 obligatorio en API, formato canónico en minúsculas.

RPC de guardado usa `.single()` para recibir la fila compuesta en forma de objeto, según [representación singular de PostgREST](https://postgrest.org/en/latest/references/api/resource_representation.html). Los tests comprueban el header real generado por Supabase; la ida y vuelta PostgREST+SQL queda pendiente de integración.

### Límites operativos explícitos

- Dry-run es diagnóstico inmutable, no cotización ni reserva. Repetir su UUID abre el resultado original; cambios de readiness requieren un nuevo UUID vía API (la UI actual reutiliza la última identidad por plan).
- Reservar no reclama de nuevo un batch terminal/uncertain; devuelve su estado original. Un futuro worker **solo** puede consumir un claim recién adquirido y debe resolver la exclusión de ejecución del proveedor por idempotency key; no existe worker L01. Las reservas por sí solas no garantizan exactamente una petición HTTP externa tras un crash.
- La fuente de saldo necesita un snapshot no futuro y vigente. `consumed_cents` del proveedor se cuenta desde ese snapshot. Renovar saldos/reconciliar sobreconsumo y confirmar precios de cada etapa requieren integración futura.
- Los fallos/partial/uncertain pausan el plan sin mecanismo de resume en L01. No liberar reservas por tiempo ni borrar claims; recuperación manual revisada conserva costos y evita repetir consumo.
- Para un piloto de múltiples proveedores, preparar quotes/claims por etapa y presupuestar su total antes de activar un worker. El piloto acumula negocios y estimaciones de batches no draft/dry-run de forma conservadora; no cuenta una liberación como permiso para repetir piloto.
- No rate limiting general ni cuentas comerciales añadidos. No se consumieron herramientas pagadas ni se leyó/modificó `.env.local`.

Ajuste final de contrato de claim: `lead_engine_reserve_batch` devuelve JSON `{batch,acquired}`. Solo la transacción que cambia prepared→reserved recibe `acquired:true`; reintentos/concurrencia reciben `false`, incluso si el estado sigue reserved. Un futuro worker no debe tratar un batch ya reservado como un nuevo permiso de llamada. Timeout después del commit requiere reconciliación, no repetir el proveedor. La firma de argumentos se mantiene; el retorno final reemplaza el tipo compuesto del diseño inicial.

Validación de clasificación en servidor: `operation` sirve para resolver una industria ambigua/desconocida. Si el router reconoce una única lane, un payload que intenta sustituirla por otra se rechaza con400; el campo no funciona como permiso para levantar la pausa B/C.

## Revisión 2 — encargo directo de Franco: scraping por lotes y experiencia de investigación

2026-09-14. Nueva instrucción del usuario posterior a L01-r1: avanzar hacia scraping operativo, verificar contactos por lotes, contrastar fuentes para distinguir al dueño de recepción y mejorar de forma visible la UI. Esta instrucción autoriza continuar el desarrollo del lane; no implica aprobación de push, compra de saldo o presupuesto ilimitado. Se preservó el candidato r1 completo en `artifacts/lanes/L01/r1/`.

### Objetivo y recorrido antes de editar

Reemplazar la presentación centrada en pedir1000 contactos por un espacio de investigación NBC: configurar negocio/metro, preparar una primera búsqueda acotada, revisar evidencia, verificar números por lotes. Objetivo largo plazo queda bajo opciones de planificación; default50 contactos y$10 es un borrador editable, no una autorización de consumo. Conservar guardar/abrir/export/dry-run y compatibilidad del contrato v1.

Interfaz: cabecera editorial, navegación Search / Evidence / Connections, formulario compacto, etapas de fuente/contraste/teléfono, panel de configuración claro y bandeja de evidencia vacía hasta disponer de datos reales. Un ejemplo opcional se identifica permanentemente como ilustrativo. No usar contadores inventados ni progreso simulado. Componente/estilos separados y tokensNBC; solo ownership L01.

### Fuentes y prueba de identidad

1. Descubrir negocios y teléfonos publicados para el negocio, con URL original, industria y localidad.
2. Filtros gratuitos y dedupe global antes de cada operación pagada. Contrastar páginas del negocio y fuentes empresariales fiables; conservar URL/fecha/afirmación y conflictos. Fuentes copiadas en varios directorios no equivalen a fuentes independientes.
3. Verificación masiva en bloques compatibles con el proveedor; mantener teléfono original y respuesta asociados. Mobile/reachable/DNC/TCPA son señales distintas de identidad del dueño. Nunca inferir dueño desde un móvil, coincidencia de apellido o repetición del mismo número. La procedencia debe vincular de forma explícita a la persona, su rol y ese contacto empresarial. Si no alcanza: owner unconfirmed; si recepción: front desk. Sin búsqueda de teléfonos personales privados.

Se añadirá un contrato puro de evidencia del dueño (supported/needs_review/front_desk/conflicting), y preparación de bloques de verificación con dedupe, límites y resultado incompleto explícito. Una afirmación extraída todavía requiere revisión confiable; las flags del navegador no autorizan entrega.

### Integración independiente posible

Preparar comprobación de acceso **de solo lectura** de Apify (`GET /v2/users/me`) desde servidor autorizado, sin ejecutar Actors ni registrar datos de cuenta. El panel diferencia clave ausente/configurada/acceso verificado; ninguna condición se presenta como scraper ejecutado. BatchData se mantiene configured_unverified si hay clave: no hacer una verificación pagada para probarla y no inventar endpoint de saldo. Nuevo `POST /api/lead-engine/connections/check` sin campos de credenciales, requireOperator, no-store y errores saneados. Variables propuestas (no editar .env ni paquetes): `APIFY_API_TOKEN`, `BATCHDATA_API_KEY` privadas.

### Dependencias del piloto real

Preguntado a Franco: cuentas disponibles, industria/metro y techo de gasto; claves por configuración privada, nunca chat. Todavía faltan respuesta, proveedor/verificador habilitados, contrato actual de sus campos/precios y validación/integración de SQL r1 por el orquestador. No hay ejecución real hasta reserva persistente, saldo/cotización verificados y aprobación de gasto concreta. El esquema r1 no se aplica ni se modifica en r2. Planear el límite acumulado por etapa antes de un pipeline de múltiples proveedores (no contarlo como nuevos negocios cada vez).

Referencias primarias consultadas: [Actor Maps en Apify](https://apify.com/compass/crawler-google-places), [ejecución asíncrona y API](https://docs.apify.com/api/v2), [Run Actor y límite de gasto](https://docs.apify.com/api/v2/actors-runs-post), [Phone Verification Async BatchData](https://developer.batchdata.com/docs/batchdata/batchdata-v1/operations/create-a-phone-verification-async). El detalle de BatchData no se pudo extraer de la página dinámica: no asumir los campos del brief como contrato vigente.

Aceptación r2: UI visiblemente renovada, cero resultados ficticios por defecto, evidencia/identidad separadas de estado telefónico, export y persistencia anteriores conservados, acceso de proveedor comprobable sin gasto, pruebas locales y captura móvil/escritorio, reporte claro de lo que impide la primera búsqueda real.

### Resultado y contratos entregados en r2

Implementado el recorrido descrito con tres pestañas accesibles, formulario de mercado, objetivo opcional, resumen de presupuesto, export de borrador y panel de snapshots preservados. El ejemplo de evidencia es opt-in y siempre ilustrativo. `Continue to save` lleva al panel privado; no ejecuta una búsqueda ni afirma guardado. Las conexiones distinguen preparación, credenciales y ejecución.

`src/lib/lead-engine-research.ts` aporta `assessOwnerEvidence` y `prepareVerificationBatches`. La primera exige nombre de negocio/teléfono normalizados, fuentes HTTPS revisadas hace menos de31 días, contacto directo explícito en web empresarial y rol coincidente en registro de editor independiente. Fuentes contradictorias o recepción bloquean la clasificación supported. **Supported significa que las afirmaciones suministradas cumplen la regla; la función no navega, autentica fuentes ni prueba identidad por sí misma.** Solo debe recibir evidencia de ingesta/revisión confiable. El segundo contrato aplica los filtros existentes, ledger global y supresión antes de dividir en bloques; máximo10000 entradas y tamaño1..1000 suministrado desde contrato verificado del proveedor. No afirma que todos los proveedores acepten1000. Ambos son reglas puras, aún sin worker ni persistencia de evidencia.

`POST /api/lead-engine/connections/check`: Bearer de operador y JSON vacío `{}`; no acepta claves, precios ni flags. Respuesta200 `LeadConnectionCheck={checkedAt,apify:missing|access_verified|rejected|unavailable,phoneVerifier:missing|configured_unverified,executionEnabled:false}`. Apify se comprueba con GET de metadatos de cuenta, sin Actors; BatchData solo informa presencia de configuración. No devuelve ID/email de cuenta, saldo ni secretos. Fallo del proveedor se expresa como estado saneado; errores de auth/body usan helper común (400/401/403/413/415/503). No-store, timeout10s, URL fija y sin redirects. La ruta puede comprobar acceso antes de integrar SQL; esto no habilita ningún gasto.

Autorrevisión r2 (2026-09-14):25/25 unitarias, build/TypeScript aislado y Chrome desktop1440/móvil390 aprobados. Cinco rutas rechazan anónimo en servidor real; persistencia y resultado de conexiones usan fixtures rotulados. Prueba SQL reejecutada:0 PASS/1 SKIP por falta de Postgres aislado. Capturas/logs y manifiesto r2 en `artifacts/lanes/L01/r2/`. Migración idéntica a r1, no aplicada. Reporte vigente distingue integración pendiente, falta de cuentas/contratos y trabajo de worker todavía no implementado.

Para activar el piloto faltan: configuración privada de cuentas (`APIFY_API_TOKEN`, `BATCHDATA_API_KEY` si se elige BatchData), confirmación de industria/metro y techo autorizado, contrato actual de campos/precios y saldo comprobable, integración SQL validada y adaptador asíncrono persistente con reconciliación. Una clave por sí sola no completa esa integración. No se recibió adjunto nuevo de Anas en esta revisión; se usaron los dos documentos fuente existentes.

## Revisión 3 — continuidad autorizada, 2026-09-15

### Diseño antes de implementación

Franco indica “seguiimos”. Continuar hacia scraping por lotes sin inferir cuentas/budget ni publicación. R2 intacta verificada por manifiesto y archivada en `artifacts/lanes/L01/r2/candidate/`. SQL sigue propuesto según docs/estado local, sin evidencia de aplicación; no hay psql/postgres/docker. No se modifica UI ni auth común esta revisión.

Objetivo acotado: adaptador asíncrono de descubrimiento Apify y seguimiento persistente de su identidad. No exponer endpoint de inicio ni activar scheduler todavía. Construir/testear transporte real con fetch inyectado, vinculado a un contrato SQL; llamadas de pruebas solo simuladas. El operador autenticado y la configuración privada autorizada deben venir de un futuro entrypoint servidor, nunca del navegador.

Nueva tabla en la única migración reservada: `lead_engine_discovery_jobs`, PK/FK batch_id, FK operator_id+batch, actor_id/build_tag, search_term/location/max_results, evidencia de contrato y aprobación privada con vencimiento, status prepared/dispatching/running/succeeded/failed/uncertain, run_id/dataset_id únicos y tiempos. Inmutables los insumos/aprobación. Actor por ID y build fijado; la fuente y tarifa deben haber sido verificadas por integración antes de sembrar un prepared. Sin seeds ni API de aprobación.

Transiciones y atomicidad:
- claim_discovery toma mutex global, ownership y aprobación vigente; exige batch piloto Apify y search claim coherente con mercado/insumos. Invoca reserve_batch y cambia prepared→dispatching en la misma transacción. Solo acquired:true permite un POST. Replay nunca vuelve a POST; no leases ni reenvío por timeout.
- POST perdido, respuesta inválida o fallo de guardar respuesta→uncertain; reserva conservada y plan pausado. Si falla también DB, dispatching queda pendiente de conciliación: tampoco autoriza reenvío.
- Respuesta válida liga run_id/dataset_id a actor/build; observe_discovery conserva esa identidad. GET de seguimiento usa solo IDs guardados del propio operador. Estados terminales no regresan; polls antiguos se ignoran. Error de GET conocido permite reintentar lectura sin nuevo POST.
- SUCCEEDED no es entrega ni costo final. Reserva mantenida hasta ingesta/factura/settlement verificados. FAILED/TIMED-OUT/ABORTED conserva reserva incierta y pausa. No usar primer usageTotalUsd como recibo definitivo (documentación Apify advierte cifras preliminares al terminar).

Transporte: Bearer privado a origen fijo api.apify.com, sin redirects, timeout y límite de respuesta, IDs validados, errores saneados. Inicio fija maxTotalChargeUsd desde reserva y build auditado, un término/una ubicación/max300, sin enriquecimientos/reviews personales. Contrato verificado del Actor y garantía real del cap son dependencias de activación, no propiedades probadas con mocks. No endpoints genéricos de fetch, webhooks o entradas arbitrarias del cliente.

Archivos: lib lead-engine-discovery, services lead-engine-apify / lead-engine-discovery-store / lead-engine-discovery, tests lead-engine-discovery y suite SQL existente; migración reservada y docs/evidencia propias. Criterios: doble worker→un POST con claim exclusivo; ninguna llamada sin claim; fallos inciertos no repiten; ownership/identidad/estados inválidos bloqueados; parser no convierte corrida exitosa en dueño/móvil/verificado. SDK y unitarias locales; SQL suite preparada pendiente si no hay motor; build aislado. UI r2 y cinco endpoints existentes permanecen.

Fuentes consultadas 2026-09-15: https://docs.apify.com/api/v2/actors-runs-post ; https://docs.apify.com/api/v2/actor-run-get ; https://apify.com/compass/crawler-google-places/input-schema . Pendientes posteriores: ingesta paginada persistente, extracción/contraste de evidencia del dueño, BatchData con contrato vigente y quote agregado por etapas. No se declarará pipeline operativo con este avance.

### R3 — contrato final y evidencia

Implementado: `lead-engine-discovery.ts` (tipos/validación de job y observación); `lead-engine-apify.ts` (POST asíncrono y GET de seguimiento, origen fijo, Bearer, build numérico fijado, maxTotalChargeUsd, restartOnError:false,15s y256KiB); `lead-engine-discovery-store.ts` (SDK/RPC/lectura propia); `lead-engine-discovery.ts` en services (coordinación claim→POST→checkpoint, recuperación de GET). Son módulos internos por inyección; ninguna ruta los instancia, ningún scheduler los inicia y no leen configuración automáticamente. El futuro entrypoint debe ser server-only y reutilizar requireOperator; el UUID del operador no es un permiso de cliente.

Contrato interno: `DiscoveryJob={batchId,planId,operatorId,actorId,build,searchTerm,location,maxResults,maxCostCents,status,runId,datasetId}`. `DiscoveryObservation={runId,datasetId,actorId,build,status:running|succeeded|failed}`. El parser exige identidad/build y dataset coincidentes, no expone usageTotalUsd ni datos de cuenta. `SUCCEEDED` solo describe la corrida del proveedor; no acredita dueño, teléfono, entrega ni factura final.

Migración propuesta r3 ahora contiene **11 tablas y13 funciones** (reemplaza10/9 de r1/r2 para este candidato). Tabla nueva `lead_engine_discovery_jobs`: batch_id uuid PK; plan_id/operator_id uuid NOT NULL, FK compuesta a batches(id,plan_id,operator_id); actor_id text15..30 alfanumérico; build_tag text versión numérica x.y.z; search_term/location text1..150 sin controles; max_results int1..300; max_cost_cents int1..1000; contract_evidence_ref text1..300; approved_by uuid FK auth.users; approved_at/valid_until timestamptz con fin>inicio; status text default prepared; run_id/dataset_id text nullable únicos15..30 alfanuméricos; created_at/updated_at timestamptz default now. Todas las columnas son NOT NULL salvo run_id/dataset_id, ambos presentes o ausentes juntos. prepared/dispatching no admiten IDs; running/succeeded/failed los exigen. Índice operador/created_at desc. No datos ni approvals sembrados.

Permisos como r1: RLS habilitada sin políticas cliente; revocación a PUBLIC/anon/authenticated/service_role, SELECT/INSERT/UPDATE solo service_role. Trigger `lead_engine_discovery_transition()` congela entrada, aprobación e identidad externa y valida transiciones; DELETE rechazado por immutable y sin grants. Nuevas RPC INVOKER y search_path fijo, EXECUTE solo service_role:
- `lead_engine_claim_discovery(uuid,uuid)→jsonb {job,acquired}`: ownership, aprobación vigente del mismo operador, quote y source claim exactos de mercado, piloto proveedor apify; reserva y dispatching atómicos. Solo prepared adquiere.
- `lead_engine_observe_discovery(uuid,uuid,text,text,text,text,text)→jsonb job`: run/dataset/actor/build/status; valida identidades, vincula IDs y no regresa terminales con polling atrasado. Un failed retiene presupuesto mediante settle uncertain y pausa plan.
- `lead_engine_uncertain_discovery(uuid,uuid)→jsonb job`: conserva reserva/pausa; replay terminal no cambia resultado.

El estado uncertain no se reenvía automáticamente ni se adjunta manualmente un run arbitrario por API. Si queda dispatching sin run_id tras crash, hace falta conciliación revisada; no existe herramienta de reparación manual en r3. Si existe run running, sync reintenta exclusivamente GET y checkpoint. Un resultado exitoso mantiene reserva hasta implementar ingesta/factura; no liberar fondos solo por status. Se deben resolver quote/costos por etapas y stop-loss antes del pipeline completo.

Validaciones propias2026-09-15: **34/34 unitarias PASS**, build/TypeScript aislado PASS. Nueve tests nuevos cubren lost commit/POST/checkpoint, doble worker con contrato simulado, ownership, payload/proveedor, límites y errores. Runner SQL ampliado a once tablas y cuatro subtests de discovery (carreras, identidad/IDs únicos, terminales, incertidumbre, aprobación/quote/saldo); **0 PASS/1 SKIP**, no SQL real ejecutado. UI intacta; no se repitió navegador ni se atribuyen capturas r2 como nuevas. Evidencia y manifiesto en `artifacts/lanes/L01/r3/`. SQL no aplicado ni servicios de proveedor invocados con cuenta real.

## Revisión 4 — scrape con cotización y aprobación; listas/carpetas

2026-09-15. Pedido explícito de Franco: terminar flujo de scraper, estimar costo antes de correr, confirmar “¿aprobás?” y organizar listas en carpetas desde un tab. Releídos ambos briefs completos; son requisitos, no órdenes de ejecutar el master prompt ni compras. El brief prefiere Outscraper; Apify sigue provisionalmente como adaptador ya construido a partir del pedido previo de Franco (“Apify o la mejor forma”). No afirmar paridad de tarifas históricas. Cuenta/mercado/techo consultados; no inferirlos del borrador.

### Contrato previo a implementación

Flujo: guardar snapshot de búsqueda → seleccionar negocios a descubrir (1..300), nombre de lista/carpeta → Review scrape cost → cotización persistida con rango/límite/etapa/vencimiento → Cancel o Approve & start (autorización del operador de esa cotización exacta) → corrida y lista persistidas → Refresh results consulta run/ingiere una página → lista de negocios con owner/phone verification pendientes. Nunca convertir descubrimiento en lista de celulares verificados. No teléfonos visibles/export de marcado ni conexiones Caller/SMS en este candidato.

Precio comercial calculado en Postgres a partir de tarifa privada auditada del Actor/build, costos base y por negocio en milicéntimos; no usar benchmark de4–6c/celular como precio de scrape. Tarifa falta/vencida→pricing_pending, sin cotización inventada ni botón aprobado. quote version1 y UUID idempotente, límites min/max calculados, expiración≤15 minutos/tarifa, plano inmutable y scope discovery_only. Cliente no envía precio/saldo/Actor/aprobación booleana; POST approve con cuerpo vacío registra quién y cuándo aprobó la cotización y crea list/batch/job transaccionalmente. Antes de reserva se vuelven a evaluar presupuesto, saldo, vigencia, ejecución habilitada y duplicados; reintento no consume dos veces. Ningún consumo real hasta integrar/mantener controles privados; no sembrar tarifa/approval/cuenta de prueba en Supabase compartido.

Carpetas privadas NBC: un nivel, crear y filtrar por chips; All lists/Unfiled y carpetas propias. Cada corrida aprobada crea lista con FK al job y carpeta opcional. Mover lista entre carpetas propias; no cambia dedupe/supresión ni borra historial. FK compuestas por operador. No borrar ni compartir carpetas/listas. Paginación de listas20 y registros50; cap200 carpetas por operador para navegación acotada. Recargar recupera listas y resultados de DB.

Ingesta: únicamente dataset de run SUCCEEDED guardado; API Apify GET con offset/limit50, sin clean/skipEmpty para no perder posiciones, paginación validada. Respuestas limitadas y URL fija. Solo campos publicados del negocio; no capturar reviews/personas privadas. Parser conserva incompleto como descarte; no asumir owner/mobile/operational faltante. RPC guarda página normalizada y avanza cursor en la misma transacción, compara cursor esperado para concurrencia/replay. Tope300 entradas; si dataset excede el límite, parar y pedir revisión sin nuevo cargo. Resultados internos nunca aprobados para contacto automáticamente. SQL filtra supresión/deliveries/negocios ya procesados y duplicados globales antes de retener candidatos; las listas no son ledgers separados. Revalidar supresión al leer.

Extensiones únicamente en migración reservada propuesta: pricing, folders, quotes, lists, candidates y RPC quote/approve/folder/move/ingest, RLS default-deny cliente y INVOKER con permisos mínimos server. Aplicación y SQL real siguen responsabilidad del orquestador. No editar migración aplicada si aparece evidencia de integración.

Archivos: nuevos lib/services/components lead-engine del flujo, rutas /folders,/quotes,/quotes/:id/approve,/lists,/lists/:id,/lists/:id/sync,/lists/:id/move; componente de listas/preflight bajo sesión local existente sin cambiar auth común. UI NBC, dialog accesible con foco/Escape, carga/error/vacío/éxito, confirmación expirada/budget cambiante y sin uso de flags de cliente para autorizar. Mantener export/save/open/dry-run y evidencia ilustrativa explícita.

Aceptación: carpeta/lista/quote persistentes con ownership; costo autoritativo y aprobación exacta; retry sin reenvío; ingesta recuperable por página; filtros/supresión/inputs/estado probados; recorrido browser desktop/móvil y build aislados; no atribuir SQL ni proveedor real a mocks. Pendientes separados: cuenta/cotización auditada/saldo/budget, SQL aislado/integración; contraste multifuente y BatchData para owner-mobile reales siguen exigiendo contrato y adaptación, no se presentan como incluidos en discovery_only.

### R4 — contrato entregado y estado vigente

El alcance r4 reemplaza las afirmaciones históricas de r1–r3 de “sin endpoint de ejecución”: ahora hay endpoint de aprobación que conecta worker/Apify después de autorización y controles SQL. **No se activó ni probó con cuenta real.** Migración propuesta ahora16 tablas/21 funciones; no aplicada ni ejecutada en Postgres. Ningún seed comercial habilita ejecución por defecto.

Nuevos archivos: `lead-engine-scrape.ts` (payloads/DTO/parser de negocios), `lead-engine-dataset.ts` (lectura de dataset), `lead-engine-scrape-store.ts` (SDK/RPC), `lead-engine-scrape-http.ts` (auth/contratos), `lead-engine-scrape.service.ts` (server-only/wiring). `LeadScrapeWorkspace{.tsx,.types.ts,.module.css}` compone precio/modal/listas dentro de la sesión de operador existente. LeadEngine suma tab Lead lists. No cambios a shell/auth comunes; el login general del proyecto y el login de operador del módulo siguen siendo dos entradas.

#### Esquema añadido (columnas NOT NULL salvo ?)

| Tabla public.lead_engine_* | Columnas/relaciones | Constraints y permisos |
|---|---|---|
| pricing | id uuid PK; actor_id/build_tag text; base_min_cents/base_max_cents int; unit_min_millicents/unit_max_millicents int; verified_at/valid_until timestamptz; evidence_ref text | Actor15..30 alfanumérico/build x.y.z;0≤base_min≤base_max≤1000,0≤unit_min≤unit_max≤1000000; vigencia creciente; evidencia1..300; append-only y sin seed |
| folders | id uuid PK; operator_id uuid FK auth.users; name text; created_at timestamptz default now | name1..80 sin controles, unique(id,operator_id), índice único operador+lower(btrim(name)); límite200 carpetas por operador en RPC; append-only |
| quotes | id uuid PK; operator_id/plan_id uuid FK compuesta plans; folder_id? uuid FK compuesta folders; name text; max_results int; rate_id uuid FK pricing; min_cost_cents/max_cost_cents int; expires_at timestamptz; approved_at? timestamptz; created_at timestamptz default now | unique(id,operator_id); nombre1..80; resultados1..300;0≤min≤max≤1000 y max≥1; trigger congela todo salvo primera aprobación |
| lists | id uuid PK y FK con operador a quotes; operator_id/plan_id uuid FK compuesta con id a batches; folder_id? uuid FK compuesta folders; name text; cursor int default0; dataset_total? int; import_status text default waiting; created_at timestamptz default now | unique(id,operator_id); cursor/total0..300; waiting/importing/complete; índice operador/fecha/id; trigger solo permite mover carpeta, cursor creciente, fijar total una vez y estados sin regresar complete |
| candidates | list_id uuid FK lists + position int PK compuesta; name/city/state text; website?/source_url? text; phone10? text; place_id? text; business_key text; rejection? text; created_at timestamptz default now | position0..299; longitudes200/150/100, URLs≤2000 y esquemasHTTP(S)/HTTPS; teléfonoNANP10; place_id1..200; key≤600; rejection1..100. Índices únicos parciales globales sobre phone10/place_id/business_key cuando rejection IS NULL; append-only |

phone10 es un teléfono **publicado para el negocio**, privado en servidor hasta validar, jamás una inferencia de celular personal/dueño. No se persisten reviews ni datos personales de reviewers. La API de registros omite el teléfono por completo y señala verification_pending. Revisa supresión vigente cada lectura.

RLS default-deny cliente para las cinco tablas, sin políticas anon/authenticated. Grant SELECT/INSERT solo service_role; UPDATE adicional quotes/lists. No DELETE/TRUNCATE. Nuevas funciones INVOKER con search_path fijo y EXECUTE solo service_role: quote_transition/list_transition (triggers), save_folder(uuid,uuid,text)→jsonb, quote(uuid,uuid,uuid,uuid,text,int)→jsonb, approve_quote(uuid,uuid)→uuid, move_list(uuid,uuid,uuid)→void, ingest_page(uuid,uuid,int,int,jsonb)→jsonb, list_records(uuid,uuid,int)→jsonb. Prefix `lead_engine_`. SQL completo en migración reservada.

Cálculo por snapshot privado de precio: min=base_min+ceil(count×unit_min_millicents/1000), max=max(1,base_max+ceil(count×unit_max_millicents/1000)). Un milicéntimo=0.001 centavo; no usar dólares en estos campos. Rango para discovery_only, sin predicción de yield owner/mobile ni costo de verificación. El límite de1c mínimo es reserva conservadora incluso con tarifa gratuita. Evidencia comercial debe incluir cargos de arranque/eventos y lecturas/ingesta; no se afirma cotización auditada porque exista un precio público en una página.

approve_quote graba el evento autenticado de aprobar **esa cotización** y crea batch/job/lista una sola vez; no acepta un booleano de permisos/saldo del cliente. claim_discovery sigue realizando reserva exclusiva y reevaluación posterior antes de POST. Si la aprobación se guardó pero el inicio falló, la lista conserva prepared y ofrece Retry approved start; job expirado requiere cotización nueva/revisión y no se relanza sin más. dispatching/uncertain nunca reenvía POST. No liberación por timeout ni supuesto cargo cero tras fallo.

#### API r4

Todo requireOperator existente, JSON ≤8KiB en POST, no-store. Creación de cotización acepta `{version:1,quoteId:UUIDv4,planId:UUIDv4,folderId:UUIDv4|null,name:string,count:integer1..300}`; precios/flags/Actor/owner extra rechazados.

| Ruta | Método/entrada | Respuesta200 |
|---|---|---|
| /api/lead-engine/folders | GET, sin filtros; POST `{id:UUIDv4,name}` | `{folders:[{id,name}]}` / `{folder:{id,name}}` |
| /api/lead-engine/quotes | POST payload anterior | `{quote:{id,planId,folderId,name,maxResults,minCostCents,maxCostCents,expiresAt,blockers,scope:discovery_only}}` |
| /api/lead-engine/quotes/:id/approve | POST `{}` | LeadListPage después de start; no acepta importe/approval flag |
| /api/lead-engine/lists | GET `?offset=0&folder=<UUID|unfiled>` opcional | `{lists:LeadList[],nextOffset}`;20 por página |
| /api/lead-engine/lists/:id | GET `?offset=0` | `{list,records:LeadListRecord[],nextOffset}`;50 registros |
| /api/lead-engine/lists/:id/sync | POST `{}` | LeadListPage; máximo una página de50 por refresh, solo dataset del run propio |
| /api/lead-engine/lists/:id/move | POST `{folderId:UUIDv4|null}` | `{moved:true}`; destino/propietario verificados |

LeadList={id,name,folderId,planId,status,importStatus,processed,maxResults,reservedCents,consumedCents,createdAt}. LeadListRecord={position,name,city,state,website,sourceUrl,reviewStatus}; **sin teléfono ni nombre de dueño inventado**. Errores comunes400/401/403/404/409/413/415/503 y `{error,code}`. Dependencias `storage_pending`, `pricing_pending`, `provider_access_pending`, `balance_check_required`; conflictos `quote_expired`, `quote_over_budget`, `hard_budget_exceeded`, `pilot_cap_exceeded`, `claim_unavailable`, `cursor_conflict`, `folder_name_conflict`. Solo cuerpo/identidad, no datos de contacto arbitrarios del navegador. Trece acciones HTTP totales contando cinco anteriores.

Dataset: página cruda JSON50 con clean=false, offsets/count/total de headers validados;2MiB/15s/origen fijo/no redirects. No inferir final de dataset desde página filtrada. Total congelado en primer commit, cursor y rows en una transacción; replay ignora página ya guardada. Enforce US/state solicitado, fuenteGoogleHTTPS, estado operativo explícito, teléfonoNANP, allowlist positiva y exclusiones gratis; supresión/dedupe final dentro del mutex SQL. Para roofing/plumbing/HVAC/landscaping hay sinónimos explícitos; otras industrias usan coincidencia de frase y necesitan calibración del piloto. Rechazos se conservan, no se convierten en leads llamables.

#### Evidencia y dependencias actuales

44/44 unitarias, build/TypeScript aislado y Chrome1440/390 aprobados. Navegador con login general y operador **fixtures**;13 acciones rechazando anónimo en servidor real. Modal Cancel/Escape sin inicio, expiración, presupuesto cambiado, carpeta y resultado/movimiento probados con fixtures rotulados. Primera corrida de browser falló porque la prueba histórica no contemplaba nuevo login general; se adaptó el fixture, sin debilitar auth. En revisión visual se ocultó diagnóstico dry-run viejo en tab de listas para no confundirlo con reservas nuevas; build/browser repetidos después. SQL16 tablas/21 funciones y suite ampliada:0 PASS/1 SKIP; atomicidad real aún pendiente.

Presencia de configuración comprobada privadamente (solo nombres/booleans, sin exponer valores): APIFY_API_TOKEN/APIFY_TOKEN/OUTSCRAPER_API_KEY/BATCHDATA_API_KEY ausentes. No se editó .env ni se llamó a proveedores con claves. Tarifas/approval/control no sembrados ni migración aplicada. Variables runtime nuevas ninguna respecto a r2. El orquestador debe validar SQL e integrar, auditar Actor/build/precio total/saldo y confirmar mercado/cap del piloto; el operador aprueba el costo exacto desde el modal. Los NBC Credits del shell no se debitan aquí.

**Discovery completo implementado hasta ingesta, no validado con proveedor/DB reales. Owner research multifuente y verificación BatchData siguen pendientes de contrato/acceso/implementación; la estimación/modal lo declaran fuera de esta etapa.** Reservas quedan retenidas hasta conciliación de costos; no se conectó liquidación automática ni se presentaron importes de proveedor como factura real. Requiere medir y reconciliar antes de siguiente piloto/escala.

## Publicación de revisión L01-r4 — 2026-09-15

Franco indicó que revisa en Vercel y ordenó publicar los cambios en su mensaje posterior al reporte r4. Esta autorización reemplaza la espera anterior para publicar este candidato. Objetivo: actualizar el alias existente con C04-R1 actualmente publicado más los 34 archivos runtime propios congelados de L01-r4. Snapshot aislado y hashes en `artifacts/lanes/L01/publish-r4/`; conservar otros módulos por copia del archivo C04 publicado, no desde el workspace mutable. Validar build integrado, acceso HTTPS, login y rechazo anónimo de APIs. No aplicar SQL ni configurar proveedores en esta publicación: la dependencia de almacenamiento y tarifa sigue explícita. Sin Git local, usar el despliegue directo Vercel existente, target staging y mismo alias.

Durante la preparación, I04-R1 actualizó el alias. El guard de publicación detuvo el primer intento antes de subir archivos. Se rehízo el snapshot desde I04-R1, conservando también sesión S01 y Caller C04. Archivo definitivo: `artifacts/lanes/L01/publish-r4/nbc-sales-I04-R1-plus-L01-R4.tar.gz`.

Resultado publicación: `dpl_KUekHfr2FB34sbQxemLiKy3sxE9N` READY/staging en el alias existente; 174 archivos, build integrado y 22 checks HTTPS reales PASS. Estado de almacenamiento pendiente comprobado con operador real. No SQL aplicado/proveedor configurado. Evidencia e instrucciones de revisión en reporte L01-r4-P1.

## L01-r5 — Dirección visual y activación, 2026-09-15 (antes de implementar)

Request de Franco: conservar estructura, rehacer UI poco premium, tipografía más grande y diferente, detalles e interacciones; identificar cuentas para probar realmente. Publicar para revisar en Vercel según autorización vigente.

Diseño: interfaz de trabajo con jerarquía editorial, sans del sistema Helvetica Neue/Arial para controles y Georgia itálica solo en acento del título; no nuevas fuentes/dependencias ni cambios de shell. Cuerpo 15–17px, títulos 28–60px, campos 52px y botones accesibles. Superficies planas, líneas finas y tinta NBC, amarillo en acciones relevantes. Eliminar miniatura ornamental de pipeline y badges repetidos. Sustituir por secuencia de tres pasos seleccionables que explica entregable/estado real, foco y teclado. Fichas de conexiones con detalles desplegables sobre los accesos exactos. Mantener tabs, presets, formulario/benchmark, borrador/export, guardar/abrir, carpetas y aprobación de costo sin alterar contratos backend.

Animación: aparición breve de panel, desplazamiento sutil de indicador/interacción hover, acordeones nativos. Respetar prefers-reduced-motion y foco visible. Inputs móviles >=16px; estructura adapta sin scroll horizontal. Sin contadores, resultados, conexiones ni progreso falsos.

Archivos: LeadEngine.tsx/CSS Module, LeadPlanStorage CSS Module, LeadScrapeWorkspace CSS Module, tests/lead-engine-browser.mjs y evidencia r5, feature/handoff/reporte. No backend ni SQL aplicados en esta revisión visual. Verificar build aislado, flujos UI con fixtures, contraste visual light/dark y mobile, revalidar login/API HTTPS después de publicar sobre el último snapshot remoto.

Activación: documentar separación entre acceso del cliente y trabajo técnico pendiente. El brief pide Outscraper + BatchData; implementación actual usa Apify para discovery y no implementa verificación telefónica ni corroboración de dueño. Consultar cuenta ya disponible antes de contratar; no comprar ambas. Supabase/Vercel existentes no requieren nuevas cuentas, pero SQL necesita prueba aislada/integración por orquestador y hay ledger/precio/saldo por configurar. Pedir proveedor/API/alcances, tarifa y presupuesto del piloto por canal privado; sin consumo inferido de una credencial.

### Resultado L01-r5

Publicado en `dpl_5eaKaxoqXvxY7tS8Lj7NeeEZcbhV` READY/staging, alias habitual `/lead-engine`, sobre I05-R1 conservando apariencia y módulos actuales.196 archivos,4 deltas UI,192 idénticos a base. Build aislado final PASS; navegador con fixtures PASS incluyendo teclado/costo/carpetas/presupuesto decimal/móvil/reduced-motion;24 checks HTTPS reales PASS con login y storage_pending. Capturas claro/oscuro verificadas tras integrar base I05. Sin SQL/proveedor/variables/dependencias nuevos. UI con entradas16px, controles52px, fuente local al módulo y acento Georgia; no fuente descargada. Reporte y artefactos r5 contienen manifiesto, archivo reproducible, incidencias y accesos para Anas. Aprobación de publicación vigente; revisión de producto de Franco y técnica externa pendientes.

## L01-r6 — Volver al diseño compartido (antes de editar)

Request: «Muy cuadrado todo… Segui el mismo diseno que el resto de tabs». Prioriza coherencia con Academy/Caller/Members sobre la dirección editorial r5. Mantener flujo y capacidades, adoptar la fuente compartida `--font-body`, superficies/tokens compartidos, radios de tarjetas14–22px y controles9–12px. Quitar Georgia, monograma y título editorial gigante. Encabezado/formulario como workspace del resto de módulos; introducción compacta y pasos interactivos conservados, sin repetir el pipeline al pie. Cotización, carpetas y avisos redondeados, mismos estados y contraste claro/oscuro. Interacciones/reduced-motion, campos móviles16px y monto decimal visibles conservados.

Ownership: cuatro archivos visuales LeadEngine.tsx y los tres CSS Modules del lane; pruebas UI existentes y documentación/evidencia r6. No cambios backend, API, permisos o migración; no cuentas nuevas ni proveedor consumido. Publicar para revisión en Vercel por autorización vigente sobre el último snapshot publicado, validando hashes y evitando otros cambios concurrentes.

Respuesta de activación: Apify y BatchData son las cuentas de ese camino, pero no equivalen a flujo live. Falta SQL aislado/integración, tarifa/saldo/límites probados y código de corroboración de dueño/verificación telefónica. Primer hito comprobable: descubrimiento de negocios con fuentes; segundo hito: contactos empresariales con dueño/móvil comprobados. Sin garantías de fecha por solo entregar claves.

### Resultado L01-r6 — 2026-09-15

Publicado para revisión en `dpl_5GhTL4de25wzGsW68TDiFgxwjdh6` READY/staging, alias habitual `/lead-engine`; base I07-R1,218 archivos/4 deltas visuales/214 preservados por hash. Fuente compartida DM Sans (`--font-body`), superficies NBC y tarjetas/controles redondeados; eliminados acento Georgia, monograma y repetición del pipeline. Mantiene pasos interactivos, teclado, costo/carpetas, export y estados pendientes. Build aislado y navegador con fixtures PASS;24 checks HTTPS reales PASS incluyendo login/storage_pending. Cero llamadas pagadas o SQL aplicado. Manifiesto, capturas, archivo runtime y reporte en `artifacts/lanes/L01/r6/`. Texto actualizado para Anas: `r6/ACCESOS-PARA-ANAS.md`; cuentas necesarias para el camino actual Apify/BatchData, sin confundir acceso con implementación completa. Revisión técnica y aceptación visual pendientes; publicación vigente autorizada por Franco.

Actualización del alias al cierre: Calendar KCAL01-R1 publicó `dpl_7ze1Pm3bx5ci5QZtwNg5SCTtuEGs` sobre el archivo L01-r6 anterior. Sus219archivos preservan los34archivos runtime propios de Lead Engine por hash (`r6/alias-final.json`). No se repuso un baseline viejo ni se redeployó para pisar Calendar. La URL principal sirve esa integración sucesora; el enlace inmutable L01-r6 identifica esta entrega visual. El verificador HTTPS final registra y comprueba el deployment servido al inicio/final.

## L01-r7 — Sesión única y proveedores solo en ajustes de administrador (antes de implementar)

2026-09-15. Franco pide eliminar nuevamente Operator email/password de Lead lists y demás vistas, retirar Connections de Lead Engine y ubicarlo en los ajustes del perfil de administrador. Estudiantes/coaches usan NBC Credits; no configuran proveedores. Evidence workspace se explica como vista futura de fuentes/vínculo de dueño/checks, hoy vacía con ejemplo rotulado; no se inventan resultados ni se elimina esa pestaña sin pedido.

Flujo: LeadPlanStorage consume `useWorkspaceAccess` sin crear cliente Auth, guardar contraseña, login/logout local ni sesión alternativa. Carga planes automáticamente con token vigente. Cambiar cuenta/cerrar sesión limpia estado; respuestas de un token anterior no pisan la sesión actual.401/403 se muestran como sesión/acceso del portal, nunca solicitan credenciales de operador. Conserva borrador/export y503 storage_pending, snapshot idempotente, costo/listas/carpetas. Los endpoints de planes siguen requireOperator hasta el contrato de uso de créditos/membresías; retirar el segundo login no amplía permisos de gasto ni habilita scrapes de estudiantes.

Connections se elimina del tablist/DOM/CTA/footer de Lead Engine, y del modo de los componentes de planes/listas. Nuevo componente propio LeadConnectionSettings montado una sola vez en `/settings`, después del perfil, únicamente con rol admin de la sesión validada. Diagnóstico manual y documentación de cuenta; sin input de secretos, compra ni ejecución. POST `/api/lead-engine/connections/check` pasa del gate operator al rol admin validado por `requireWorkspaceAdmin` (helper común sin cambios). Estudiantes/coaches401/403 no reciben estado del proveedor; validación antes de leer configuración o contactar Apify. Body sigue `{}`, no admite credenciales/flags.

Ownership ampliado de forma puntual por el pedido explícito de mover Connections a ajustes: editar únicamente `src/app/(workspace)/settings/page.tsx` para montar el componente propio. No editar ProfileSettings, shell o auth común; conservar cambios de sus writers. Archivos restantes dentro del lane: componentes/CSS/tipos Lead Engine, route connections/check, tests y docs/evidencia r7. API/DB/Auth global se consolidan por el orquestador. Sin SQL/env/dependencias nuevas.

Validación: build aislado sobre snapshot vigente, recorrido de navegador con una sola autenticación (search/listas/evidence/recarga), roles admin/student/coach, UI sin campos/Connections/provider checks, settings admin con diagnóstico, errores401/403/503 sin login adicional; pruebas del endpoint real aislado contra backend Auth/Members sintético para comprobar403 antes de proveedor. Repetir costo/carpetas/idempotencia y publicar en Vercel por autorización vigente, guardando hashes y último alias. Atomicidad real SQL y checkout de créditos siguen fuera de esta corrección.

### Resultado y contrato L01-r7

Publicado 2026-09-15 en dpl_7CNJKGZUtgoaxKCUAoRs8158eqBH READY/staging; base I08-R1, 228 archivos, 11 deltas y 217 preservados. LeadPlanStorage usa WorkspaceAccess sin cliente Auth, login/password/logout propios. Cambios de cuenta/token invalidan respuestas antiguas. Listas cargan al abrir. Connections retirado de Lead Engine; LeadConnectionSettings montado en /settings solo admin. No se modifica ProfileSettings ni auth/shell comunes.

POST /api/lead-engine/connections/check usa requireWorkspaceAdmin. Body exacto {}; no admite credenciales o flags. 401 sin sesion valida, 403 student/coach/inactivo, 400 JSON/campos invalidos, 413 sobre 8KiB, 415 sin JSON, 503 fallo recuperable. Respuesta 200: checkedAt, apify (missing/access_verified/rejected/unavailable), phoneVerifier (missing/configured_unverified), executionEnabled:false. No-store; sin secretos o saldo. Auth/rol se verifican antes del body/configuracion/proveedor. Diagnostico manual sin Actor ni BatchData; abrir ajustes no llama al proveedor.

44 unitarias PASS; build aislado PASS; browser de costo/carpetas PASS; 7 checks de sesion/roles y 9 casos API PASS usando Auth/Members HTTP sintetico y rutas reales. 24 checks HTTPS reales PASS: un solo login entre modulo/Settings/recarga, storage_pending directo y diagnostico admin 200. Capturas/manifiesto r7. SQL no aplicado ni probado en Postgres; scraper/dueno/BatchData y consumo NBC Credits pendientes. Los endpoints de planes siguen requireOperator; no se inventa permiso comercial por retirar el login. Publicacion autorizada; revision tecnica externa y aceptacion de Franco pendientes.

## L01-r8 - Score por lead y almacenamiento explicado (antes de implementar)

2026-09-15. Franco pide score 0-100 en la informacion del lead/pipeline y no entiende los avisos duplicados de pending integration. Un 100 es fuerza maxima de evidencia segun reglas versionadas, NO probabilidad calibrada/garantia del 100%. Sin evidencia evaluable: value:null, Not checked. No sumar por un numero bien formateado o URL sola.

Contrato owner-phone-v1: cuatro comprobaciones con evidencia empresarial publica, fresca (<31 dias, no futura), mismo negocio/persona/telefono. Contacto directo del dueno en sitio oficial40; registro independiente corroborando mismo dueno25; telefono activo verificado20; linea movil verificada15. Fuentes repetidas no suman; nombre distinto/conflicto exige revision y limita nota. Recepcion, telefono distinto o inactivo nunca dan nota alta; linea no movil tampoco. Nota nunca modifica supresion/permisos/presupuesto ni autoriza llamadas. Ningun flag/score del cliente o del dataset de discovery se acepta como evidencia verificada.

Implementar regla pura tipada y componente LeadConfidence reutilizable en cada registro de lista. API de detalle/sync/approve/move devuelve confidence versionado dentro de LeadListRecord, calculado en servidor. Registros actuales de discovery, sin evidencia de dueno/verificador persistida, devuelven Not checked; no inferir nota de listing/website. Contrato preparado para que el pipeline comun preserve el objeto; no editar Caller concurrente ni conectar handoff automatico. Recoleccion/persistencia de evidencias y renderer del pipeline Caller quedan como dependencia explicita del orquestador, no se afirman integrados.

Evidence workspace explica ahora score/razones con un ejemplo rotulado y el mismo componente, para que la nota no viva como una pantalla separada de cada lead. No inventar negocios o telefonos reales. Se preservan tabs hasta pedido expreso de retirarlos.

Almacenamiento: una sola notificacion de LeadPlanStorage compartida con listas, texto Saving isn't available yet y explicacion de que NBC esta terminando el setup. Mostrar borrador no guardado/export disponible, no scraper iniciado. No repetir errores desde hijo ni sugerir refrescar como solucion definitiva. Deshabilitar guardar/crear carpeta/cotizar mientras falta storage; permitir reintentar comprobacion y descargar borrador. No cambiar SQL ni aplicarlo al Supabase compartido.

Archivos: lib lead-engine-confidence*, componentes LeadConfidence*/LeadEngine/LeadPlanStorage/LeadScrapeWorkspace, lib lead-engine-scrape, service lead-engine-scrape-store, pruebas propias y docs/evidencia r8. Sin env/dependencias/auth/shell/Caller. Verificar regla con casos validos/faltantes/antiguos/conflictivos/supresion no alterada; API contrato no acepta score inventado; UI una sola alerta/campos deshabilitados/recuperacion, sesiones/roles y costo/carpetas. Build/browser aislados y publicacion autorizada sobre ultimo snapshot conservado.

### Contrato implementado L01-r8

Nuevo `LeadListRecord.confidence` compatible con consumidores anteriores (campo opcional en TypeScript para filas antiguas; el productor actual siempre lo agrega). value:number|null, maximum:100, version:owner-phone-v1, meaning:evidence_strength, status:not_scored/needs_review/strong_evidence/conflicting/wrong_contact/inactive/not_mobile, assessedAt, checks y sourceUrls. No probability, consentimiento ni aprobacion. API no admite score/evidencia del cliente. Discovery sin owner/phone verificado devuelve null y sobreescribe cualquier score del dataset.

UI en cada fila Lead Engine: componente LeadConfidence, desplegable de puntos y fuentes; ejemplo75/100 identificado como ilustrativo en Evidence workspace. El pipeline Caller aun no consume el objeto: contrato concreto en artifacts/lanes/L01/r8/PIPELINE-CONFIDENCE-CONTRACT.md, pendiente del orquestador y del writer Caller. No se conecta handoff automatico ni se alteran tablas compartidas.

Una unica notificacion Saving isn't available yet informa setup a cargo de NBC y export del borrador; error storage_pending del hijo se comunica al padre sin render duplicado. Guardar/cotizar/crear carpeta bloqueados mientras falta storage; lectura/check again permite recuperar y conserva identidad del reintento. No se aplico SQL ni se configura proveedor.

### Resultado L01-r8

Publicado dpl_5fZA6U31MN8hKYJrwwvHmCtCKTXh READY/staging en alias habitual, base I09-R1;234 archivos,10 deltas/224 preservados.53 unitarias finales PASS, build aislado PASS, browser de score/costo/recuperacion y siete checks sesion/roles PASS,26 HTTPS reales PASS con ejemplo75 y aviso unico. Primer test strip-only y primer build JSX fallaron y fueron corregidos; logs iniciales/finales preservados en r8. SQL no ejecutado/aplicado, proveedor sin consumo pagado y Caller pendiente. Los pesos son reglas iniciales, no estadistica calibrada con resultados reales. Endpoint move mantiene {moved:true}; la nota aparece en el GET posterior, no cambia su respuesta.


## L01-r9 — Integración real de persistencia (antes de ejecutar)

2026-09-15. Request vigente de Franco: «y q estas esperadno? Hacelo. Recordame qye cuentas falta abrir para que el scraper funcione?». Autoriza completar la integración pendiente descrita en r8; la limitación inicial de entregar SQL sin aplicarlo queda sustituida para esta migración concreta tras verificarla en PostgreSQL aislado. No autoriza compras, consumo de proveedores ni campañas.

Objetivo: hacer guardables/recuperables planes y carpetas en el entorno existente; probar dry-run sin reservas ni cargos, RLS/ownership, idempotencia y presupuesto concurrente. Flujo: diagnóstico remoto de solo lectura, PostgreSQL desechable local con sesiones independientes, correcciones del SQL reservado si aún no está aplicado, aplicación transaccional del candidato validado, lectura por API y navegador autenticado. Control de ejecución permanece false, cuentas/tarifas/saldos reales sin inventar. Si un objeto ya existe se detiene el reemplazo hasta contrastarlo; no sobrescribir migraciones aplicadas.

Ownership: SQL reservado, servicios/API/componentes propios si la integración revela errores, pruebas propias y documentación/evidencia r9. PostgreSQL se instala como herramienta local de verificación, sin alterar package.json/lockfiles ni iniciar servicios compartidos. No cambios en auth común, Caller, .env ni docs globales. Publicación del código solamente si hace falta, sobre snapshot remoto vigente y con autorización de Vercel ya expresada por Franco.

Contrato conservado: NBC interno con operador autenticado; 16 tablas y RPC invoker exclusivos de service_role; deduplicación y supresión transversales al scope interno; cotización aprobada antes de despacho; reserva/claim y reconciliación atómicos. Score existente representa evidencia, no probabilidad. El vínculo de score con Caller y la ingestión real de verificación de dueño/teléfono son dependencias diferenciadas, no se presentan como completas por aplicar SQL. Aceptación: SQL real PASS, esquema/permisos verificados, guardar/abrir/carpeta/dry-run reales sin storage_pending, ejecución deshabilitada y requisitos Apify/BatchData explícitos.


Ajuste r9 tras prueba real: Supabase JSONB reordena las claves de input. La comparación UI por JSON.stringify del objeto completo puede tratar un plan guardado idéntico como distinto y dejar dry-run/cotización deshabilitados. Se reemplaza por huella explícita de campos ordenados (incluida operación opcional), probada con orden JSONB y cambios reales de contenido. Publicar solo lib/lead-engine-storage.ts y LeadPlanStorage.tsx sobre el snapshot vigente; no requiere alterar SQL ya aplicado.


### Resultado L01-r9 — 2026-09-15

SQL aplicado transaccionalmente a2026-09-15T21:12:43Z, hash6b723634fa61743ca8119b04333b74db483e752b5cb54755c5cc851012bb134e,16tablas/21funciones RLS/invoker verificadas.22pruebas Postgres17.10 reales con sesiones independientes PASS; Supabase17.6. Control false, sin tarifas/saldos/jobs. Corregido fingerprint JSONB;55unitarias, build aislado y navegador fixtures PASS. Publicado dpl_yCUAVQPNyp4nySasyLosVRSUBpCC, READY/staging,234runtimefiles con2cambios/232preservados sobre r8.15checks HTTPS reales de persistencia y7de ownership PASS; capturas escritorio/móvil. Guardar, abrir, carpeta, dry-run y export reales; cotización faltante503pricing_pending honesto. Reporte r9 detalla fallo inicial detectado por JSONB, mantenimiento API administrativa tras aplicación, dos borradores de prueba retenidos y artefactos. No proveedor pago ni score de contactos reales; cuentas Apify/BatchData y adaptadores/evidencia→Caller pendientes. SQL aplicado se conserva inmutable; docs globales esperan consolidación por orquestador.


## Actualización L02 / I10

L02 validado localmente: guard implementado, 66/66 pruebas Lead Engine y 188/188 integradas; typecheck exit0 tras T1. No publicado ni probado con proveedor remoto. Detalle: docs/lanes/reports/L02.md.


## Fase 4 (tareas 1 a 3) — receta B en el runner: nombre → domicilio (parcelas) → skip trace (contrato previo, 2026-09-21)

Alcance: `handoff/03_BUILD_PLAN.md` Fase 4 tareas 1 a 3, según `05_ANAS_DEV_HANDOFF.md` §2b/§3 y `engine.py` (`cmd_names`, `PARCEL` + `parcel_lookup`, `street_ok`, `show_addresses`, `cmd_trace`). Fuera de alcance: `firms` (abogados), `cmd_investors`, reviews, Sunbiz SFTP, SEC ADV.

- **Adaptadores de nombres (gratis, mismo patrón por chunks):** `fl_re` (RE_rgn1..7, BK Broker Current/Active, calle del domicilio en el archivo, filtro PM por `business_type`), `fl_cpa` (DBPR `lic01ac.csv`, clase AC; el xlsx público es el mismo dato pero el lector local devuelve la misma hoja dos veces y ese código no se toca), `tx_trec` (Socrata s7ft-44qi, Broker Individual Active; el export CSV excede 28 s), `az_adre` (DownloadList/1, 50 MB sin soporte de Range, Broker Active), `il_idfpr` (pzzh-kp68, CPA y managing broker, business='N'), `ny_salons` (y3u4-jbgh, holder en orden APELLIDO NOMBRE), `ny_repair_shops` (nhjr-rpi2, RS/RSB, vencimiento 2027/2028), `tx_tdi` (kvqi-vsrr Owner/DRLP; ciudad/ZIP desde kxv3-diwf en el ingest; sin calle), `tx_tabc` (7hf9-qc9f, owner persona; la dirección postal cuenta como domicilio solo si difiere del local), `ny_doh_food` (cnih-y5dw, operador persona, solo Restaurant), `fl_dbpr_barbers` (lic03bb.csv: BS dueño en la línea 1 de dirección; BB/BR calle del domicilio), `co_sos_agents` (4ykn-tg5h, agente persona con domicilio igual al principal, apellido en la entidad como flag), `nppes_medspa` (NPI-2 por `organization_name`, títulos de dueño). Regla dueño vs empleado (01 §2) en `title_code`/`business_type` al parsear. `register_source` admite `fuente:filtro` (filtro sobre `business_type`).
- **Parcel (gratis):** `src/lib/lead-engine-parcel.ts` puro (tabla PARCEL NC, FL, AZ, TX Travis, GA Fulton, TN Davidson, WA Snohomish, IL Cook, PA Philadelphia; misma regla de owner string APELLIDO NOMBRE% o NOMBRE APELLIDO, entidades excluidas, exactamente un dueño distinto, `street_ok`) y `src/services/lead-engine-parcel.service.ts` (fetch 25 s, sin reintentos; tres fallos congelan el job). Se omite cuando la fila ya trae calle de domicilio (fl_re, fl_cpa, BB/BR de barberos, postal TABC distinta del local).
- **Trace (pago):** `skipTrace` en `lead-engine-batchdata.ts`, 50 por llamada, $0.07 por persona medido antes de la llamada; resultados casados por identidad (eco del input o dirección+nombre devueltos), nunca por posición; mejor Mobile por score con dnc=false y tcpa=false; email conservado; filas sin match quedan desconocidas; 403 «Insufficient balance» → `provider_balance_exhausted`.
- **Runner:** fases `names` → `parcel` (25 nombres por llamada, tres primeras direcciones en `progress.addressCheck`) → `trace` → entrega existente (ledger con `source_register`, `source_row_id`, `parcel_owner_string`, `trace_score`, `home_street_source`). Muestra de 50 nombres; la puerta compara limpios/trazados. Gates de la lane B: toda dirección trazada con número + calle + sufijo; ningún nombre con dos parcelas trazado.
- **Cotización:** B abre cuando el estado tiene registro mapeado y (fuente de parcelas o archivo con domicilio). Estimación de proveedor = nombres × 0,25 × $0,07 (1,0 cuando se omite parcel); se muestra costo por celda limpia. Nationwide (A) sigue donde no hay camino, salvo la never-list.
- **Nunca** se llama al skip trace real en pruebas. Los probes en vivo son solo lecturas gratuitas.
