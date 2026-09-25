# ownercell

Python engine for the Owner Cell App: `handoff/engine.py` refactored into a package. Python 3.9, standard library only. `handoff/engine.py` is untouched and still runs.

## Modules

| Module | Concern |
|---|---|
| `errors.py` | `Frozen(step, reason, resume)`: the only exception a step raises. No `die()`; only the CLI's last line calls `sys.exit`. |
| `http.py` | `get_json()` on urllib: 5 attempts on 429/5xx/timeouts with exponential backoff and jitter, then `Frozen` with a 300-char body head (header values redacted). Other 4xx freeze at once. `body_error()` catches BatchData's 403 inside a 200 body. Never switches vendor. |
| `psql.py` | Runs one statement through the `psql` binary with `-X -q -t -A -v ON_ERROR_STOP=1`; values travel as psql variables, never interpolated. Missing binary or non-zero exit is `Frozen`. |
| `meter.py` | `Decision(allowed, remaining_cents, reason, spend_id)`; `FileMeter` (engine.py's spend.json shape plus `credits_held`, `daily`) and `PostgresMeter` (`public.lead_engine_meter`). |
| `brain.py` | Mirror of `src/lib/lead-engine-brain.ts`: `load`, `validate`, `route`, `coverage`, `credits_for_cells`, `cap_cents_for_credits`. Shared vectors in `tests/fixtures/brain-routes.json`. |
| `tz.py` | `zone_for_zip` (src/data/lead-engine-zip-timezones.json), `resolve_zone` (ZIP, then engine.py's state/city tables, then area code), `within_dial_window` 08:00 to 20:00 local via zoneinfo, `hold_back_without_zone`. |
| `common.py` | `p10`, `street_ok`, `save`, `show_addresses`, `download`, work dir, `.env` loading (never printed). |
| `scrape.py` | Outscraper async job and engine.py's filter chain (no_phone, dup, tollfree, closed, chain, allowlist). |
| `verify.py` | BatchData phone verification in chunks of 100, indexed by returned number. |
| `names.py` | Free registers: fl_re, fl_cpa (via `xlsx.py`), tx_trec, az_adre, il_idfpr, pa_pals, nppes, firms. |
| `parcel.py` | PARCEL ArcGIS table, IL/PA/HCAD lookups, exactly-one-home resolution. |
| `investors.py` | NC parcel grouping for individual owners with N properties. |
| `trace.py` | BatchData skip trace with identity matching (see bug 1). |
| `deliver.py` | List (20 brain `output_columns`) / Summary / Legal Notes workbook, held rows to `held_<name>.json`. |
| `xlsx.py` | Minimal xlsx writer (inline strings, header style, freeze pane, autofilter) and reader (shared and inline strings). |
| `outcomes.py` | `read_outcomes(xlsx)` validated against the 7 outcome codes; `post_outcomes()` via `public.lead_engine_record_dial_outcome`. |
| `jobs.py` | `JobState` in `<out>/.job.json` (draft, quoted, sample_running, sample_done, running, delivered, needs_attention); `run()` catches `Frozen`; `resume()`. |
| `cli.py`, `__main__.py` | argparse front end. |

## How the meter works

Every paid call does two things:

1. `meter.check(step, vendor, units_estimate, unit_cents)` before the request. `allowed=False` with reason `cap` or `daily_ceiling` means the step returns what it has and the caller delivers, settles and stops. Nothing is recorded.
2. `meter.charge(step, vendor, units_actual, unit_cents)` after the response, with the count the vendor actually bills (rows returned for scrape, numbers sent for verify, requests sent for trace).

`FileMeter(path, cap_cents=None, credits_held=None)`: cap = `credits_held * credit_value_usd * 100 * spend_cap_ratio` (both from the brain: $0.10 and 0.6 today) unless an explicit cap is given. Daily ceiling per vendor from `OWNERCELL_DAILY_CEILING_<VENDOR>_CENTS` (default 5000); `meter.alert` is set at 80 percent. The JSON keeps engine.py's `cap`, `spent`, `log` (dollars) so old `spend.json` files load, and adds `credits_held`, `daily`, and `spend_id`/`cents`/`vendor` per log line.

`PostgresMeter(database_url, operator_id, job_id)` calls `select public.lead_engine_meter(:'operator'::uuid, :'job'::uuid, :'vendor', :'step', :units::int, :cents::int)` and parses the jsonb `{allowed, remaining_cents, reason, spend_id}`. `check()` probes with 0 units. psql missing or failing is `Frozen`; it never falls back to a file. The SQL function lives in `supabase/migrations/202609210240_lead_engine_jobs.sql` (with the credits ledger and job state machine); `p_units = 0` is a check that records nothing.

## Run

```
python3 -m ownercell --help
python3 -m ownercell route hvac FL
python3 -m ownercell coverage [--json]
python3 -m ownercell meter --cap 10 | --credits 40 | --new "FL CPAs"
python3 -m ownercell scrape  --tag pool --kw "pool builder" --cities "Tampa, FL;Charlotte, NC" [--limit 40] [--go]
python3 -m ownercell names   --tag flcpa --source fl_cpa [--city TAMPA] [--n 200]
python3 -m ownercell parcel  --tag t --in work/names_t.json --state NC
python3 -m ownercell investors --tag inv --state NC --county Mecklenburg --min 3 --max 8
python3 -m ownercell trace   --tag t --in work/picks_t.json [--go]
python3 -m ownercell deliver --name "FL CPAs" --in work/traced_t.json [--dnc strict|flag] [--master prior.csv] [--outdir out]
python3 -m ownercell resume  <work dir with .job.json>
python3 -m ownercell outcomes import <xlsx> [--post --operator <uuid>]   (needs DATABASE_URL and psql)
```

Work dir: `OWNERCELL_WORK`, else `ENGINE_WORK`, else `./work`. API keys from the environment or `.env.local` / `.env` / `handoff/.env` (`OUTSCRAPER_API_KEY`, `BATCHDATA_API_KEY`). Paid commands print an estimate and stop without `--go`. A `Frozen` in scrape or trace writes `<work>/.job.json` as `needs_attention`; `resume` continues trace jobs from the cursor using `traced_<tag>.partial.json` so paid rows are not re-traced. Exit codes: 0 ok or dry run, 2 stopped.

## Tests

```
python3 -m unittest discover -s tests/python -v
```

Offline; vendor calls are faked via the `get` argument or by patching `urllib.request.urlopen`.

## engine.py bugs fixed in the port

| # | engine.py location | Fix |
|---|---|---|
| 1 | `cmd_trace`, line 408: `zip(chunk, r['results']['persons'])` matched by position | `trace.match_results`: key = normalised first, last, street, ZIP; matched on the response's echoed `meta.input` / `meta.request` / `input` / `request`, else on the returned `propertyAddress` + `name`. Unmatched rows get `trace_status='unmatched'` and an empty phone. |
| 2 | `cmd_deliver`, line 447: `tz()` returned `''` and the row shipped | `deliver.build` runs `tz.hold_back_without_zone`; held rows go to `held_<name>.json` with reason `time_zone_unresolved` and are counted in Summary. |
| 3 | `cmd_deliver`, line 462: `Call 8am–9pm` | `deliver.LEGAL_NOTES`: 8:00am to 8:00pm recipient local (FL 501.616(6)) and max 3 calls per 24h per recipient on the same subject. |
| 4 | `cmd_deliver`, line 431: hardcoded `/mnt/user-data/outputs/MASTER - all owner cells.csv` | `deliver.master_path`: `--master`, then `OWNERCELL_MASTER_CSV`, then `<outdir>/MASTER - all owner cells.csv`. |
| 5 | `cmd_scrape` line 143 charged `len(rows)` after a preflight on `queries*limit`; `verify`/`cmd_trace` charged the estimate before the call | `meter.check` before, `meter.charge` after with the actual count (`scrape.outscraper`, `verify.verify`, `trace.trace`). |
| 6 | Em dashes in `meter_charge`, `cmd_names`, `cmd_deliver` status and notes | No em dashes in any output text; commas or "to". Guarded by `tests/python/test_xlsx.py`. |

Also changed on purpose: `tz.STATE_TZ['AZ']` maps to `America/Phoenix` (no DST) instead of Denver so the local clock is right; the sheet label stays `Mountain`.

## Not ported faithfully

- `cmd_names fl_cpa`: engine.py copied a pre-downloaded `/home/claude/fl_cpa.xlsx` when present; that path was sandbox-specific and is dropped. The download path is unchanged.
- `cmd_meter --reset` kept `cap` and zeroed `spent`; the port also zeroes `daily`.
- `resume` covers trace jobs (the only multi-chunk paid loop with a stable cursor). A frozen scrape is re-run with `--go`; Outscraper's async job cannot be resumed by cursor.
