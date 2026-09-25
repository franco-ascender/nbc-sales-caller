# Owner Cell App: auditoría renglón por renglón contra los documentos del handoff

Fecha: 2026-09-21, actualizada 2026-09-24. Estado por requisito: **LISTO** (con evidencia en el repo y, cuando aplica, probado en producción), **PARCIAL**, **NO** (no construido), **EN CURSO** (agente construyendo hoy), **DECISIÓN** (se apartó del documento a propósito, con la razón). Cada renglón cita el archivo del handoff del que sale.

Convención de evidencia: `sql:` migración en `supabase/migrations/`, `ts:` código en `src/`, `py:` `ownercell/`, `test:` prueba, `prod:` verificado contra https://nbc-sales-nbc-sales.vercel.app o Supabase producción.

## 00_START_HERE.md

| Renglón | Estado | Evidencia / por qué |
|---|---|---|
| Stack: Next.js + TS en Vercel, Supabase Postgres para todo lo persistente | LISTO | prod: 30 tablas `lead_engine_*`, 4 migraciones nuevas aplicadas |
| Stack: Python workers para el engine (engine.py envuelto como job steps) | DECISIÓN | El runner de producción es TypeScript en Vercel (`ts: services/lead-engine-jobs.service.ts`) porque Franco prueba solo en Vercel y no hay host para workers Python. El paquete `py: ownercell/` existe, refactoriza engine.py módulo por módulo, mantiene la CLI, y comparte brain y vectores de test con el TS. Es la reserva para correr local o en un worker cuando exista. |
| Outscraper para Maps (key y precio de Anas); Apify como alternativa documentada | DECISIÓN | El runner usa Apify ($0,004, `ts: services/lead-engine-apify-runs.ts`) porque es la cuenta que funcionó en el piloto y el adaptador Outscraper (`ts: services/lead-engine-outscraper.ts`) quedó sin cablear al job. El plan lo permite ("if Outscraper fails"). Falta: opción por job de proveedor. |
| BatchData para verify ($0,007) y skip trace ($0,07) | LISTO | `ts: lead-engine-batchdata.ts` match por número, 403 en body; skip trace lo construye el agente de receta B |
| FTC National DNC Registry suscripción directa como fuente de DNC para el rescrub de 31 días | NO | Hoy DNC viene del flag de BatchData. Requiere cuenta FTC ($82 por área) y decisión de Franco. El ledger ya guarda `dnc_file_version` para cuando exista. |
| Telnyx y DataZapp solo experimentales hasta el bake-off | LISTO | Nada los usa; el meter los acepta como vendors con techo 0. |
| Nunca gastar sin chequeo de cap; cap → entregar lo que hay, liquidar, parar | LISTO | `sql: 202609210240 lead_engine_meter`; runner `stopForMeter` → `deliver`; `test: lead-engine-jobs-postgres` ($1,00 para en $1,00) |
| Cualquier error de API para el job; no retry con otro vendor; body logueado; needs_attention | LISTO | `freeze_job` con razón sanitizada; sin switch de vendor; `test:` freeze/resume |
| BatchData 403 "Insufficient balance" en body con 200 | LISTO | `ts: lead-engine-batchdata.ts` `provider_balance_exhausted`; `test: lead-engine-batchdata.test.ts` |
| Nunca entregar el mismo número dos veces; supresión global permanente | LISTO | `lead_engine_businesses.phone10 unique` + `deliveries` + `suppressions` con gate; opt_out suprime en la misma transacción |
| Manual dialing only; no SMS; no autodialer | LISTO | Sin ruta de SMS; Legal Notes lo dice; xlsx sin columnas de marcación automática |
| Ventana 08:00 a 20:00 local del destinatario; tz en cada fila; sin tz se retiene | LISTO | `sql:` CHECK en `row_ledger`; `ts: lead-engine-dial-window.ts`; filas `held` |
| DNC aplica a celulares de sole proprietors; strict por defecto; rescrub 31 días; litigator siempre fuera | LISTO | `dnc_mode` default strict; ledger gate `ledger_scrub_stale`; tcpa siempre drop |
| Cada fila entregada tiene ledger; cada llamada tiene outcome con snapshot | LISTO | `sql: 202609210230`; `prod:` tablas aplicadas; `test:` 44 aserciones |
| Nunca usar voter files, DMV, SC/UT listas, WA liquor, NIPR, locators; nunca marcar CA small family child care | LISTO | Ninguna fuente de esas está en los adaptadores; SC/UT `legal_status prohibited` en brain; CA nota legal. Falta: excluir filas CA small family homes si algún día se ingiere CA CHHS (no ingerido). |
| Default off revisable: BatchData property search, Maps como entregable para attorneys/CPAs/med spas, Apollo, ZoomInfo, TLOxp, Twilio, Clay, Data Axle | LISTO | Guardrail `NEVER_MAPS_DELIVERABLE` en gates y quote; ninguno de los vendors integrado |
| Verificar antes de afirmar; solo endpoints del catálogo | LISTO | 18 adaptadores con sondeo en vivo documentado en `docs/features/owner-cell-jobs.md`; CSLB marcado `portal_unavailable` en vez de fingir |
| Phase 0 a 5 en un párrafo | ver 03 abajo | |
| Dos sistemas de yields: no mezclar; el sample fija el número para industrias research | PARCIAL | `measured_by` se muestra en UI y quote; el runner NO escribe `expected_clean` en el brain después del sample (queda registrado en `jobs.sample`). Falta el paso "editar el JSON con el resultado". |

## 01_MERGED_ARCHITECTURE.md

| Renglón | Estado | Evidencia / por qué |
|---|---|---|
| §1 Créditos 1 = $0,10, hold at quote, settle en celdas limpias entregadas | LISTO | `sql:` `lead_engine_credits_ledger`, `hold_job`, `deliver_job` |
| §1 Máquina de estados draft→quoted→sample_running→sample_done→running→delivered ↘ needs_attention | LISTO | trigger `lead_engine_job_transition` con log de transiciones |
| §1 Sample automático de ~20 celdas, "menos de la mitad → parar y devolver" | LISTO | `sampleGate`, `lead_engine_sample_result(false)` devuelve el hold |
| §1 Cap por job 60% de lo facturado | LISTO | `cap_cents = credits × 10 × 0.6` |
| §1 Techo diario global de gasto | LISTO | `lead_engine_daily_ceilings` + alerta 80% |
| §1 Caches businesses 90 días y verified 31 días | PARCIAL | verified: LISTO (`lead_engine_verified`, consultada antes de pagar). businesses 90 días: NO (cada job vuelve a scrapear la ciudad; `lead_engine_job_rows` es por job). |
| §1 Quality gates bloqueantes | LISTO | `ts: evaluateJobGates`, corre antes de `deliver_job` |
| §1 xlsx con List, Summary y Legal | LISTO | `ts: dialSheet`; CSV adicional: NO |
| §1 Do-not-build list | LISTO | Nada de esa lista construido |
| §1 Engine de Anas envuelto como job steps, no reescrito | DECISIÓN | Ver 00: `py: ownercell/` es el refactor fiel; el runner TS reimplementa los pasos con las mismas reglas (filtros, verify por número, cap antes de cada paso). |
| §2 Más fuentes receta C: FL DBPR, MN DLI, Austin permits, NYC DOB, FMCSA, TX TDLR mini, FL DFS, IRS PTIN, NY attorneys, PA/NY/TX/DE childcare, NOLA/Orlando STR, NYC DCWP, WA DOL, CA BAR, PA HIC | PARCIAL | LISTO: FL DBPR (sin teléfono en el extract → B), MN DLI, Austin, FMCSA, TX TDLR, FL DFS, PTIN, NY attorneys, PA/NY/TX childcare, NOLA, Orlando. NO: DE childcare, NYC DOB, NYC DCWP, WA DOL, CA BAR, PA HIC. |
| §2 Más fuentes receta B: NY salons, NY DMV repair, TX TDI, TABC, NY DOH, FL barbers, Sunbiz SFTP, CO SOS, SEC ADV, TREC, NPPES NPI-1 roster | LISTO salvo Sunbiz SFTP y SEC ADV | adaptadores `ny_salons`, `ny_repair_shops`, `tx_tdi`, `tx_tabc`, `ny_doh_food`, `fl_dbpr_barbers`, `co_sos_agents`, `tx_trec`, `fl_re`, `fl_cpa`, `az_adre`, `il_idfpr`, `nppes_medspa` en `ts: lead-engine-registers.ts`; roster NPI-1 en `ts: lead-engine-medspa.ts`. Sunbiz SFTP no corre en Vercel; SEC ADV baja prioridad. |
| §2 Saltar parcel donde el archivo trae calle de casa | LISTO | `homeStreetSource` en `ts: lead-engine-parcel.ts`, usado en `pullNames` |
| §2 Receta D | LISTO | `ts: lead-engine-buckets.ts`, fases names/bucket en el runner |
| §2 Clasificador owner vs employee (reglas: TDI, appointments, TREC, FL RE, SEC, CSLB títulos, WA Individual, apellido en firma) | PARCIAL | Títulos CSLB/WA/TDI Owner/DRLP, TREC Broker Individual, FL RE broker, CO agente con apellido en la entidad (`Agent-Owner`) en `title_code`; appointments count y SEC: NO |
| §2 Chains desde OSM name-suggestion-index | LISTO | `src/data/lead-engine-brands.json` (auto y comida) + franquicias de la investigación |
| §2 Extracción de nombre de dueño desde reviews y about pages | LISTO | `ts: lead-engine-reviews.ts` + `lead-engine-reviews.service.ts`; cableado en el runner tras verify (`nameOwners`), about page gratis primero, reviews y Haiku detrás del meter (vendor `anthropic`, migración 0270) |
| §2 Gates legales por estado y fuente; ventana 8pm | LISTO | `legal_status` por estado; 8pm en CHECK y Legal Notes |
| §3 Receta D pasos names → scrape → bucket → verify → deliver | LISTO | runner |
| §3 Match nombre ≥ 0,87 y dirección ≥ 0,90; banda 0,80 a 0,87 logueada | LISTO | `tokenSortRatio`, `bucketBand` contado |
| §3 Buckets 1 a 4 con las reglas de verify de cada uno | LISTO | bucket 3 solo si Mobile; 4 → verify Maps phone |
| §3 Filtro reuso > 3 licencias; licencia más nueva primero | LISTO | `reuse_count`, orden `license_issue_date desc` |
| §3 Columnas Bucket, Register Source, License Issue Date, Maps Phone | PARCIAL | Bucket, Source, License Issue Date sí; "Maps Phone" no es columna del brain v2 (está en `job_rows.maps_phone` y en el ledger `maps_phone_at_fetch`) |
| §3 Medición del efecto en registros de contratistas (M4) | NO | Requiere corrida paga |
| §4 Bake-offs DataZapp, Telnyx, mobile rate por registro | NO | Requieren gasto con consentimiento ($60, $10, $2 por fuente) |
| §5 row_ledger con todas las columnas | LISTO | incluye `reassigned_checked_at` (nunca poblado: no hay vendor de reassigned) |
| §5 dial_outcomes con features_snapshot | LISTO | |
| §5 register_snapshots para diffs diarios | LISTO | append-only, `lead_engine_new_licensees` |
| §5 entity_graph_edges | LISTO | `ts: lead-engine-graph.ts` + `graph.service.ts`; el runner escribe edges en names, scrape, verify y delivery; `GET /api/lead-engine/graph/phone/[phone10]` |
| §5 state_coverage con legal_status, legal_note, registry_phone_sources, name_sources, recipe_d_ready | PARCIAL | Tabla creada; el ruteo usa el brain, no la tabla. |
| §5 names con source_row_id, title_code, business_type, license_issue_date, issuing_state, reuse_count | LISTO | |
| §5 verified con vendor y caller_type | LISTO (columna) / caller_type nunca poblado (BatchData no lo da) | |
| §5 jobs con recipe_version y brain_version | LISTO | |
| §5 Ingesta nocturna con cadencias por fuente | LISTO | Vercel Cron 07:15 UTC (`vercel.json`) → `GET /api/lead-engine/registers/cron` con `CRON_SECRET`; `ts: lead-engine-cron.ts` elige las fuentes vencidas por cadencia; `test: lead-engine-cron.test.ts` |
| §6 Nuevas industrias y estados en brain_v2 | LISTO | 44 industrias, 21 estados, `register_source` agregado (única edición, sin tocar números) |
| §6 Grilla de cobertura con grey-out y tooltip legal | LISTO | pestaña Owner cells → Show grid |
| §7 Rechazar export > 31 días sin override | LISTO | `ts: lead-engine-export.service.ts` + `sql: 202609210280` |
| §7 CCPA: aviso de privacidad, acceso y borrado, procedencia por registro | PARCIAL | Procedencia: LISTO (ledger). Aviso y mecanismo de acceso/borrado: NO. |
| §8 Score: captura de outcomes desde la primera lista, xlsx + endpoint, snapshot congelado | LISTO | |
| §8 Score v0 regla (0,25 fuente, 0,20 teléfono difiere, 0,20 móvil, 0,15 match nombre, 0,10 sole prop, 0,10 small business) | LISTO | `ts: lead-engine-score.ts`; ordena la planilla y va en Status; `lead_engine_score_report` + `GET /api/lead-engine/score/report` |
| §8 Grafo con historia: cada ingesta es snapshot y diff, nunca overwrite | LISTO | snapshots append-only + edges con `observed_day` único |

## 03_BUILD_PLAN.md

| Tarea | Estado | Evidencia |
|---|---|---|
| P0.1 esquema: tablas de Anas + row_ledger, dial_outcomes, register_snapshots, entity_graph_edges | LISTO | 0230 + 0240 (jobs, job_spend, credits_ledger, verified, names, state_coverage; `businesses`/`searches_run`/`parcel_matches`/`traced` de Anas: `businesses` existe de L01 como gate global, `searches_run` y `traced` NO como tablas propias) |
| P0.2 ledger de créditos append-only, hold/settle/refund | LISTO | |
| P0.3 máquina de estados con transiciones logueadas | LISTO | |
| P0.4 meter única función, cap 60%, techo diario con alerta | LISTO | |
| P0.5 brain loader con fallback a v1 y route() | LISTO (fallback v1 solo en `py:`; TS carga v2) | |
| P0.6 tz por ZIP y ventana 08:00 a 20:00 | LISTO | GeoNames, 40.977 ZIPs |
| P0.7 outcome capture endpoint + xlsx round trip + snapshot | LISTO | |
| P0 aceptación: job falso cap $1 para en $1; fila entregada con ledger y outcome; brain rutea hvac FL → A, chiropractor direct line FL → D ok, contractors SC → prohibited | LISTO | tests Postgres y brain |
| P1.1 engine.outscraper/verify/deliver como job steps con caches | PARCIAL | Apify en vez de Outscraper; cache verified sí, cache businesses 90 días NO |
| P1.2 filtro por brain + OSM brand files + allowlist | LISTO | |
| P1.3 sample gate ~100 negocios en 5 ciudades, parar bajo la mitad | DECISIÓN | Muestra = 1 ciudad × 125 lugares (mínimo de Apify $0,50) y se amplía si hay menos de 20 verificados; misma regla de corte |
| P1.4 quality gates bloqueantes | LISTO | |
| P1.5 tabla de cobertura en UI | LISTO | |
| P1 aceptación: Tampa roofers xlsx, cero duplicados, todo móvil, DNC limpio, ledger, créditos solo por entregadas; segundo job casi gratis | NO CORRIDO | Requiere el primer job pago. "Segundo job casi gratis" solo se cumple para verify (cache), no para scrape. |
| P1 demo 500 HVAC Florida | NO | Requiere ~$15 de proveedores y consentimiento |
| P2.1 framework de ingesta nocturna + adaptadores en el orden dado | LISTO | 38 adaptadores, reanudables, snapshots, reuse, cron nocturno en Vercel; CSLB Personnel join escrito pero portal 503 |
| P2.2 worker receta C con filtro de reuso y licencia nueva primero | LISTO | |
| P2.3 M1 mobile rate por registro (300 teléfonos por fuente) | NO | gasto |
| P2.4 M2 Telnyx pre-gate | NO | gasto |
| P2.5 M3 DataZapp vs BatchData | NO | gasto + términos |
| P2 aceptación: 8 fuentes C ingiriendo nightly con snapshots; expected_clean medido; jobs "tax preparers TX" y "childcare homes PA" entregan | PARCIAL | 2 fuentes ingeridas hoy (OR, WA); las demás listas para ingerir con un clic; nightly NO; jobs C cotizan sin bloqueo pero no corridos |
| P2 demo 5.000 CSLB Sole Owner | NO | portal CSLB 503 en el postback |
| P3.1 bucket step | LISTO | |
| P3.2 worker receta D con columnas | LISTO | |
| P3.3 adaptador NPPES bulk mensual + delta semanal, AO fields, filtro corporativo, filtro de título, regla apellido, NPI-1 solo clínico | PARCIAL | Vía API (no bulk); AO fields, filtro de títulos staff, reuse para DSOs; roster NPI-1 por ZIP con `sole_proprietor` en `ts: lead-engine-medspa.ts`. Regla de apellido en la organización: NO |
| P3.4 healthcare_ao_contrast live para chiropractors, podiatrists, optometrists, dentists; bucket 3 → receta B | PARCIAL | Rutea a D vía nppes; dentist y chiropractor tienen receta B vía `nppes:dentist` + parcel; handoff automático de bucket 3 a B dentro del mismo job: NO |
| P3.5 M4 share de bucket 2 en 2.000 filas | NO | gasto |
| P3 aceptación: job "florida contractors" D con buckets; bucket 1 sin place id; chiropractor FL con AO distinto del front desk | NO CORRIDO | código listo, sin corrida paga |
| P4.1 worker receta B (names, parcel, investors, trace, deliver) piloto FL CPAs y NC dentists | LISTO código / NO corrido | fases `names`, `parcel`, `trace` en el runner; `skipTrace` por identidad; quote `cpa FL` → B vía fl_cpa, `dentist NC` → B vía nppes + parcel NC (probado en producción). Investors: solo en `py: ownercell/investors.py`. Corrida paga pendiente de consentimiento. |
| P4.2 fuentes B de la investigación | LISTO (salvo Sunbiz SFTP, SEC ADV) | 13 adaptadores nuevos, sondeados en vivo el 2026-09-24 |
| P4.3 reglas owner vs employee antes del trace | PARCIAL | `title_code` y `owner_is_entity` en los adaptadores; sin modelo |
| P4.4 camino med spa (NPI-1 roster, Sunbiz dos saltos, TX Comptroller, grafo de directores médicos, blocklists, team page) + M5 | PARCIAL | roster NPI-1, grafo de directores TN (588 filas, 46 directores en 3+ spas), blocklists de franquicias y agentes registrados, team page vía reviews service: LISTO (`ts: lead-engine-medspa.ts`). TX Comptroller: adaptador sin verificar (formulario HTML). Sunbiz dos saltos: NO (SFTP). M5: gasto. |
| P4.5 extractor de reviews y about page ($0,30 por 1.000 reviews + modelo) | LISTO | precio real medido en vivo: $0,0006 por review en el tier gratis (el doble del catálogo), codificado |
| P4.6 chains OSM auto y comida + franquicias | LISTO | |
| P5.1 diff diario → segmento "new licensee" con prioridad y alerta | PARCIAL | RPC y endpoint `new?days=90`; prioridad en el entregable y alerta: NO |
| P5.2 edges del grafo en cada ingesta y match | LISTO | runner: names, scrape, verify, delivery; match de bucket: NO (solo la evidencia queda en el ledger) |
| P5.3 score v0 regla como orden; v1 logístico con 5.000 dials | LISTO v0 / v1 requiere 5.000 llamadas registradas | |
| P5.4 refresh 1 crédito por 10; export DNC flag para email; investors TX/AZ/IL | NO | |
| P5.5 permit velocity y license age como features; Shovels solo si hace falta | PARCIAL | license_issue_date en features; permits ingeridos (Austin) pero no como feature |
| Qué no construir | LISTO | Nada de la lista construido |
| Preguntas abiertas: engine.py/STATE-COVERAGE/MASTER-PROMPT, DataZapp terms, CSLB terms, WA legal | ABIERTAS | Necesitan a Franco o a Anas |

## 05_ANAS_DEV_HANDOFF.md

| Renglón | Estado | Evidencia |
|---|---|---|
| §0 Usuario compra créditos, elige industria y **estado o nationwide**, cantidad, Run | PARCIAL | Créditos internos (grant), industria, **un estado por job**, cantidad. "Nationwide" como un solo job: NO (hay que crear un job por estado). |
| §0 Nunca ve dólares, solo créditos | PARCIAL | La UI muestra créditos y además el estimado de proveedor en dólares (es la UI interna de NBC; para clientes habría que ocultarlo) |
| §1 Recetas A, B, C con costos | LISTO las tres (más D) | |
| §1 Tres protecciones: meter, error para el job, nunca dos veces/supresión | LISTO | |
| §2a brain.json: aliases → receta, keyword/allow, name_source por estado, expected_clean, credits; states[state] chequeo y grey-out; guardrails; editar JSON sin código | LISTO | |
| §2b envolver engine.py función por función | DECISIÓN | ver 00; parcel y trace del runner TS siguen las mismas reglas que `parcel_lookup`/`cmd_trace` (match LAST FIRST, un solo dueño, `street_ok`, mejor móvil limpio, email) |
| §2b archivos de licencias ingeridos nightly a Postgres, no por job; NPPES bulk mensual | PARCIAL | Ingesta a Postgres sí, a demanda; NPPES por API |
| §3 Input: industry, geo (state list o nationwide), target_cells, dnc_mode | PARCIAL | geo = un estado |
| §3 Route: fallback a A si el estado no tiene camino, antes de cobrar | LISTO | corregido hoy, nacional automático |
| §3 Quote: créditos, **ETA**, yield esperado; hold | PARCIAL | ETA NO |
| §3 Sample siempre; < mitad → parar, refund, needs_attention con los números | LISTO | |
| §3 Run: ampliar hasta target o hold agotado; cada llamada paga chequea créditos | LISTO | |
| §3 Deliver: xlsx + CSV, gates, ledger, settle | LISTO | `GET .../download?format=csv` (`ts: lead-engine-export.service.ts`) |
| §3 El usuario ve Draft → Quote → Running (barra scraped/verified/delivered) → Download | LISTO | |
| §4 Tabla de precios y créditos por receta | LISTO | del brain |
| §4 Hold at quote, settle at delivery; sample a cargo nuestro; jobs fallidos no cuestan | LISTO | |
| §4 Cap 60% | LISTO | |
| §4 Techo diario con alerta; **stop-loss 2× costo por celda limpia → pausa** | LISTO | `sql: 202609210280` en `lead_engine_meter` (reason `stop_loss`, desde 10 entregadas); `test: lead-engine-stoploss-postgres` |
| §4 flag mode entrega DNC marcadas a mitad de tarifa; emails de BatchData a la vista | PARCIAL | Mitad de tarifa LISTO; emails solo cuando la fuente los trae (registros, trace EN CURSO) |
| §4 Refresh a 1 crédito por 10 números | NO | |
| §5 Yields esperados | LISTO | brain, `measured_by anas` |
| §6 Modelo de datos | PARCIAL | ver 03 P0.1 (`searches_run`, `parcel_matches`, `traced` no son tablas; `parcel_matches`/`traced` los agrega o no el agente B) |
| §6 Caches: verified 31 días para todos; ciudad scrapeada 90 días | PARCIAL | verified sí; ciudad no |
| §7 Gates | LISTO | |
| §8 dnc_checked_at en cada fila; rechazar export > 31 días sin override; tz en cada fila; Legal Notes; supresión global; strict default; flag solo email y la UI lo dice | LISTO | export viejo → 409 `export_stale` salvo `?override=1` (`sql: lead_engine_job_freshness`) |
| §9 Orden de build 1 a 7 | 1 a 6 LISTO; 7 (refresh, export DNC, investors TX/AZ/IL) NO | |
| §10 No construir | LISTO | |

## 08_BRIEF_FOR_LEADERSHIP.md (Module 0 a 6, compliance floor, preguntas abiertas)

| Renglón | Estado |
|---|---|
| Module 0: outcome schema y ledger; normalización teléfono/dirección; parsing de nombres con sufijos corporativos; fuzzy match con umbrales; cuatro buckets; filtro de teléfono exclusivo; ZIP → tz; scheduler de rescrub 31 días; cost tracking con cap | LISTO salvo **scheduler de rescrub** (NO: hoy el ledger rechaza filas con scrub viejo, pero nadie re-verifica solo) |
| Module 1: CSLB Sole Owner 5.000 dueños | NO (portal 503) |
| Module 2: WA y OR, luego Telnyx mobile rate por registro | WA y OR ingeridos (LISTO); Telnyx NO (gasto) |
| Module 3: NPPES load, contraste AO vs front desk, regla apellido, exclusión DSO; chiropractors y podiatrists FL y TX | PARCIAL (API, títulos, reuse; apellido EN CURSO; sin corrida) |
| Module 4: TX mini establishments, NY salons y barbers, FL DBPR, Sunbiz | TX mini LISTO; NY salons, FL barbers EN CURSO; Sunbiz NO (SFTP) |
| Module 5: Group B invertido con reviews y FMCSA; TX TDI y PTIN; childcare como prueba | FMCSA, PTIN, childcare LISTO; reviews y TDI EN CURSO |
| Module 6: Group D (Sunbiz dos saltos, TX officers, grafo de directores), auto y comida | EN CURSO parcial (sin Sunbiz); auto NY y comida TX/NY EN CURSO |
| Compliance floor: manual, DNC federal en celulares, litigator, ventana 8 a 8, supresión global, gates de fuentes, CCPA | LISTO salvo CCPA (aviso y borrado) |
| Preguntas abiertas: mobile rate por registro, workaround med spa de Anas, hit rate DataZapp, revisión legal WA/AZ/MI | ABIERTAS: las tres primeras requieren gasto o a Anas; la legal requiere abogado |

## 09_CLAUDE_CODE_PROMPT.md

| Renglón | Estado |
|---|---|
| Leer 00 a 04 y engine.py; inventario antes de construir | LISTO (sesión anterior) |
| Construir sobre engine.py, refactor a paquete, CLI vieja funcionando | LISTO (`py: ownercell/`, 33 tests, `handoff/engine.py --help` corre) |
| Una fase a la vez en el orden de 03 | LISTO en el orden 0 → 1 → 2 → 3 → 4/5 |
| Nunca gastar sin pedir | LISTO: cero llamadas pagas en toda la construcción |
| Verificar antes de afirmar | LISTO: sondeos en vivo por fuente, CSLB no fingido |
| Las decisiones de Anas son defaults, no leyes; medir antes de cambiar | LISTO en principio; los bake-offs esperan consentimiento |
| Las dos tablas de memoria primero | LISTO |
| Fixes conocidos de engine.py: tz por ZIP, 8pm, dedupe en tablas, meter → ledger, BatchData orden y body | LISTO los cinco |
| Reportes en español con las 7 secciones tras cada tarea | DECISIÓN de Franco (2026-09-21): un solo reporte al final |
| Definition of done milestone 1: Phase 0 y 1, job HVAC FL end to end detrás del meter con ledger y outcome | PARCIAL: todo construido y probado con mocks y Postgres real; **el job real pago no se corrió** (sin consentimiento). Luego CSLB demo: bloqueado por el portal. |

## 04_SOURCE_CATALOG.md y 07_RESEARCH_BUILD_SPEC.md

Auditoría fuente por fuente y módulo por módulo en curso por agente; se anexa al cierre como `owner-cell-audit-sources.md`.

## Resumen honesto (2026-09-24)

- **Las cuatro recetas están cableadas y publicadas**: A (Maps + verify), B (registro → parcel → skip trace), C (registro con teléfono → verify), D (registro vs Maps con buckets). 31 registros gratuitos con ingesta reanudable y cron nocturno; grafo de entidades, score v0 y reporte por bucket; extractor de dueños desde reviews; stop-loss 2×; export xlsx + CSV con rechazo de listas viejas. Todo probado con Postgres real y con sondeos gratis en vivo.
- **Lo que un competidor no tiene existe pero no tiene números propios**: ningún job B, C o D corrió con plata porque cada corrida requiere consentimiento. Sin eso la demo se ve como "un scraper más". El primer job pago (contractors OR, 100 celdas, ~USD 1 a 2) es lo que cambia eso.
- **Falta y no depende de gasto**: cache de ciudades 90 días, ETA en la cotización, "nationwide" como un solo job, refresh a 1 crédito por 10, aviso CCPA, scheduler de rescrub, Outscraper como opción por job, bucket 3 → receta B dentro del mismo job, regla de apellido en la organización (NPPES), Sunbiz (SFTP, necesita un worker fuera de Vercel).
- **Falta y depende de gasto o terceros**: M1 a M5, demo CSLB (portal 503), FTC DNC directo, Telnyx/DataZapp, revisión legal WA/AZ/MI.
