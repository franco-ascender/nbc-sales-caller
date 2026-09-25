# Owner Cell App: Phase 0 a Phase 3 (meter, memoria, recetas A, C y D, registros)

Estado: construido y probado el 2026-09-21. Publicado en Vercel. Las tres migraciones nuevas (0230 memoria, 0240 jobs/créditos/meter, 0250 registros) están escritas y probadas en Postgres 17 real como cadena completa (30 tablas); aplicadas a Supabase producción el 2026-09-21 (evidencia en `artifacts/lanes/L03/migration-*-applied.json`).

Origen: `handoff/03_BUILD_PLAN.md` Phase 0 (tareas 1 a 7) y Phase 1 tarea 1 (Lane A como job). Los documentos del handoff son recomendaciones; donde este build se aparta de ellos lo dice.

## Qué hace

Un **job** es un pedido de N celulares de dueños verificados para una industria y un estado. El flujo real:

1. **Quote.** El brain (`src/data/lead-engine-brain.json`) rutea industria + estado a una receta (A scrape, B trace, C registro, D contraste), tasa limpia esperada, créditos por celda (1 crédito = USD 0,10) y estado legal. Cap de gasto del motor = créditos × 0,10 × 0,6. Nada se cobra.
2. **Hold.** Un clic explícito retiene los créditos (`lead_engine_hold_job`), abre el batch del job y pasa a `sample_running`.
3. **Sample.** Primera ciudad, 125 lugares en Apify (mínimo del proveedor, USD 0,50). Se verifican los teléfonos publicados en BatchData de a 10, con caché de 31 días. Si la tasa limpia queda por debajo de la mitad de la esperada, `lead_engine_sample_result(false)` devuelve el hold completo y el job queda en `needs_attention` con los números.
4. **Run.** Se amplía ciudad por ciudad (lista por estado en `src/data/lead-engine-state-cities.json`, 12 ciudades ordenadas por cantidad de ZIPs) hasta llegar al objetivo, agotar ciudades o tocar el cap.
5. **Deliver.** `lead_engine_deliver_job` liquida créditos solo por celdas entregadas (DNC flag a mitad de tarifa), libera el resto y cierra el batch. La planilla xlsx (List / Summary / Legal Notes) sale con las 20 columnas del brain incluyendo `Ledger Id`.
6. **Outcomes.** Cada llamada se registra por fila (dropdown en la UI o subiendo la misma planilla con `Called` y `Outcome`). `lead_engine_record_dial_outcome` congela las features, calcula hora local, marca si cayó dentro de 08:00 a 20:00 y **suprime globalmente** en `opt_out` y `wrong_number`.

Nada muere: cualquier error de proveedor, cap o techo diario deja el job en `needs_attention` con `resume_from`, y `lead_engine_resume_job` (con créditos extra opcionales) lo retoma exactamente donde estaba.

## Piezas

| Pieza | Archivo | Prueba |
|---|---|---|
| Memoria (ledger por fila, outcomes, snapshots, grafo, caché verified, names, cobertura) | `supabase/migrations/202609210230_lead_engine_memory.sql` | `tests/lead-engine-memory-postgres.test.mjs` (44 aserciones) |
| Jobs, ledger de créditos, meter, techos diarios, filas de trabajo | `supabase/migrations/202609210240_lead_engine_jobs.sql` | `tests/lead-engine-jobs-postgres.test.mjs` (9 subtests; incluye el job con cap de USD 1,00 que para en USD 1,00) |
| Brain loader y `route(industry, state)` | `src/lib/lead-engine-brain.ts`, vectores compartidos en `tests/fixtures/brain-routes.json` | `tests/lead-engine-brain.test.ts` |
| Zona horaria por ZIP (GeoNames, CC BY) y ventana 08:00 a 20:00 | `src/lib/lead-engine-dial-window.ts`, `src/data/lead-engine-zip-timezones.json`, generador `scripts/lead-engine-zip-timezones.py` | `tests/lead-engine-dial-window.test.ts` |
| xlsx sin dependencias (escritura y lectura) | `src/lib/lead-engine-xlsx.ts` | `tests/lead-engine-xlsx.test.ts` |
| Lógica pura de jobs (quote, gate, ciudades, planilla, parser de outcomes) | `src/lib/lead-engine-jobs.ts` | `tests/lead-engine-jobs.test.ts` |
| Runner (Apify → filtros → BatchData → gate → entrega, todo detrás del meter) | `src/services/lead-engine-jobs.service.ts`, `lead-engine-apify-runs.ts` | browser `tests/lead-engine-jobs-browser.mjs` |
| Outcomes (uno o planilla entera) | `src/services/lead-engine-outcomes.service.ts` | `tests/lead-engine-jobs.test.ts` |
| Rutas | `src/app/api/lead-engine/{jobs,jobs/quote,jobs/[id],jobs/[id]/{start,advance,resume,download},credits,outcomes,outcomes/import,coverage}` | browser: 13 rutas rechazan anónimos con 401 y `no-store` |
| UI | `src/components/lead-engine/LeadJobs.tsx` (pestaña "Owner cells", por defecto) | capturas en `artifacts/lanes/L03/jobs-ui/` |
| Paquete Python (engine.py refactorizado, sin `die()`) | `ownercell/` (README propio) | `npm run test:py` (33 tests) |

## Meter

`lead_engine_meter(operator, job, vendor, step, units, cents)` es la única puerta de todo gasto. Orden: switch `execution_enabled`, dueño del job, estado `sample_running`/`running`, proveedor conocido, **cap del job**, **techo diario del proveedor** (`lead_engine_daily_ceilings`, USD 50 por defecto, alerta al 80%). Si pasa, inserta `lead_engine_job_spend` y suma `spent_cents` en la misma transacción. Si no pasa, devuelve `allowed=false` con la razón y no escribe nada. `units = 0` es chequeo puro. El runner, ante `cap`, entrega lo que hay (guardrail 1 del brain); ante `daily_ceiling` o `execution_disabled`, congela.

## Fase 2 y 3: registros, receta C y receta D

**Ingesta de registros** (`src/lib/lead-engine-registers.ts`, `lead-engine-registers.service.ts`, migración `202609210250`): 18 adaptadores gratuitos, ingesta en trozos reanudables (cursor guardado tras cada segmento, congela con razón ante cualquier error HTTP, `Resume` continúa), snapshot diario en `register_snapshots`, upsert en `lead_engine_names`, `reuse_count` por teléfono (descarta teléfonos en más de 3 licencias, la trampa MN), `lead_engine_new_licensees(source, days)` para el segmento "licencia nueva" (Phase 5 tarea 1). Fuentes: wa_lni, or_ccb, cslb, pa_pals, fl_dbpr_construction (sin teléfono en el extract: receta B), irs_ptin, fl_dfs_individual, fmcsa, pa/ny/tx_childcare, ny_attorneys, tx_tdlr_salons (owner_telephone es espejo, nunca segundo teléfono), nola_str, orlando_str, mn_dli, austin_permits, nppes (API por estado × prefijo ZIP × taxonomía, con filtro de títulos de staff). Pestaña **Registers** en la UI. Sondeo en vivo del 2026-09-21: 17 de 18 responden; el portal CSLB devuelve 503 en el postback (adaptador escrito contra el layout documentado, fixture marcado sintético).

**Receta C** (`quoteJob` + `pullNames` en el runner): nombres del registro mapeado por `industries[*].register_source` (brain), teléfono presente, `reuse_count ≤ 3`, licencia más nueva primero, excluidos entregados y suprimidos; muestra 50 nombres; verify detrás del meter; ledger con `source_register` y `source_row_id`.

**Receta D** (`src/lib/lead-engine-buckets.ts`): nombres (con o sin teléfono) → scrape Maps con la keyword del oficio en las ciudades del registro → match por token sort ratio (nombre ≥ 0,87 y dirección ≥ 0,90; banda 0,80 a 0,87 contada) → buckets 1 (solo registro), 2 (teléfonos difieren: candidato a línea directa), 3 (iguales: `register_eq_maps`, se conserva si es móvil), 4 (solo Maps) → verify → entrega con Bucket, Source, Source Row Id, License Issue Date.

**Quality gates bloqueantes** (`evaluateJobGates`): duplicados, 10 dígitos, empresa, zona horaria, línea fija/VoIP, litigante, DNC salvo flag, conteos, tasa limpia fuera de 10 a 70% (`broken_filter`), y la regla "nunca Maps como entregable para attorneys, CPAs y med spas". Falla → job congelado con la lista de gates.

**Marcas y franquicias** (`src/data/lead-engine-brands.json`, `isChain`): OSM name-suggestion-index (auto y comida) más las franquicias de la investigación, por categoría de industria.

**Primera ingesta real en producción (2026-09-21, gratis):** OR CCB 56.191 filas leídas, 45.505 dueños nombrados; WA L&I 75.891 filas, 75.891 nombrados, 74.926 marcables tras el filtro de reuso. Una llamada de ingesta procesa 30.000 a 40.000 filas en unos 20 segundos. Migración correctiva `202609210260` (las funciones ya no leen `auth.users`, que el rol de servicio no puede leer en Supabase).

## Decisiones que se apartan del handoff

- **Credits ledger propio** (`lead_engine_credits_ledger`) en vez de reutilizar `nbc_credit_*` del módulo Usage: el hold/settle por job necesita `available` y `held` con secuencia, y el módulo Usage modela compras. Cuando la venta a clientes exista, un grant por compra pagada une los dos.
- **La UI arranca en "Owner cells"**; las pestañas anteriores siguen.
- **Solo la receta A está cableada** en el runner. B, C y D cotizan y rutean pero el quote lo bloquea con un mensaje explícito hasta Phase 2. Los estados prohibidos (SC, UT) ofrecen la receta A como fallback.
- **Chains se descartan** (guardrail del brain) aunque el flujo de listas anterior las etiquetaba y conservaba.
- **Configs en `src/data/`** porque `.vercelignore` excluye cualquier directorio llamado `config` de la publicación.
- Límite inferior de una llamada registrada: 31 días antes de la entrega (los callers cargan planillas de ayer).

## Operación

Aplicar migraciones (una vez, en orden), desde la raíz:

```bash
node scripts/lead-engine-apply-migration.mjs supabase/migrations/202609210230_lead_engine_memory.sql
node scripts/lead-engine-apply-migration.mjs supabase/migrations/202609210240_lead_engine_jobs.sql
node scripts/lead-engine-apply-migration.mjs supabase/migrations/202609210250_lead_engine_registers.sql
node scripts/lead-engine-apply-migration.mjs supabase/migrations/202609210260_lead_engine_auth_users_read.sql
```

Las cuatro quedaron aplicadas a producción el 2026-09-21.

Deja evidencia en `artifacts/lanes/L03/migration-*-applied.json`. Aplicadas el 2026-09-21.

Créditos internos: botón "Add credits" en la UI (`POST /api/lead-engine/credits`, solo admin activo).

Test Postgres local (cero rastro al terminar):

```bash
initdb -D /tmp/pg0 -U $USER -A trust -E UTF8 >/dev/null && pg_ctl -D /tmp/pg0 -o "-p 54329 -k /tmp -c listen_addresses=127.0.0.1" -w start >/dev/null && createdb -h 127.0.0.1 -p 54329 nbc_l01_test
L01_SQL_ISOLATED=1 LEAD_ENGINE_TEST_DATABASE_URL=postgresql://$USER@127.0.0.1:54329/nbc_l01_test node --test tests/lead-engine-jobs-postgres.test.mjs
pg_ctl -D /tmp/pg0 -m fast stop >/dev/null && rm -rf /tmp/pg0
```

## Pendiente (no bloquea revisar)

- Receta B (parcel + trace) sigue sin cablear en el runner (Phase 4). CSLB: el portal rechaza el postback hoy; reintentar la ingesta cuando responda. Demo CSLB Sole Owner requiere esa ingesta más un verify pago (consentimiento).
- Owner name y email en la planilla salen vacíos en receta A (el scraper corre con `scrapeContacts: false` para sostener USD 0,004 por lugar).
- El techo diario por proveedor se edita hoy por SQL (`lead_engine_daily_ceilings`); falta UI.
- `nbc_usage_events`: el gasto del meter todavía no se refleja en el módulo Usage.
