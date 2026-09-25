# Índice de contratos runtime — OR02, 2026-09-16

Inventario de fuentes locales revisadas junto con reportes I01–I09/C01–C07/L01-r9. No reemplaza pruebas de integración ni afirma que todos los proveedores estén activos. Payloads y decisiones: features [Members](../features/member-platform.md), [Usage](../features/account-usage.md), [Caller](../features/caller-sales-workspace.md), [CRM](../features/caller-crm-workbench.md), [views](../features/caller-personal-dashboard.md), [Lead Engine](../features/lead-engine.md). Las fuentes enlazadas conservan el contrato exacto.

## SQL aplicado según evidencia histórica

Los siete hashes locales coinciden con los registros históricos de aplicación. No se consultó/aplicó DB en OR02. No reescribir ni reaplicar estas migraciones; cualquier cambio necesita otra versión. Academy020 no está en esta lista: sigue como propuesta.

| Migración y especificación completa | Tablas definidas | Evidencia de aplicación |
|---|---|---|
| [202609140030_members.sql](../../supabase/migrations/202609140030_members.sql) | `nbc_members`, `nbc_onboarding`, `nbc_calendar`, `nbc_messages`, `nbc_tickets`, `nbc_credit_wallets`, `nbc_credit_operations`, `nbc_credit_entries` | [2026-09-14T20:58:05.931Z](../../artifacts/lanes/I02/activation/migration.json) |
| [202609150060_usage_settings.sql](../../supabase/migrations/202609150060_usage_settings.sql) | `nbc_usage_events`, `nbc_credit_rates`, `nbc_credit_packages`, `nbc_credit_orders`, `nbc_payment_events` | [2026-09-15T16:18:59.259Z](../../artifacts/lanes/I06/migration-applied.json) |
| [202609140040_caller_crm.sql](../../supabase/migrations/202609140040_caller_crm.sql) | `caller_leads`, `caller_imports`, `caller_voice_jobs` | [2026-09-14T21:21:55.667Z](../../artifacts/lanes/C02/migration-live.json) |
| [202609140050_caller_operations.sql](../../supabase/migrations/202609140050_caller_operations.sql) | `caller_lead_lists`, `caller_lead_list_items` | [2026-09-15T13:37:55.347Z](../../artifacts/lanes/C03/migration-live.json) |
| [202609150060_caller_workbench.sql](../../supabase/migrations/202609150060_caller_workbench.sql) | `caller_pipelines`, `caller_buckets`, `caller_activity`, `caller_pipeline_changes` | [2026-09-15T14:27:29.660Z](../../artifacts/lanes/C04/migration-live.json) |
| [202609150070_caller_views.sql](../../supabase/migrations/202609150070_caller_views.sql) | `caller_views` | [2026-09-15T14:57:26.435Z](../../artifacts/lanes/C05/migration-live.json) |
| [202609140010_lead_engine.sql](../../supabase/migrations/202609140010_lead_engine.sql) | `lead_engine_control`, `lead_engine_plans`, `lead_engine_provider_accounts`, `lead_engine_plan_approvals`, `lead_engine_batches`, `lead_engine_costs`, `lead_engine_searches`, `lead_engine_businesses`, `lead_engine_suppressions`, `lead_engine_deliveries`, `lead_engine_discovery_jobs`, `lead_engine_pricing`, `lead_engine_folders`, `lead_engine_quotes`, `lead_engine_lists`, `lead_engine_candidates` | [2026-09-15T21:12:43.391Z](../../artifacts/lanes/L01/r9/migration-applied.json) |

SQL enlazado incluye campos, tipos, defaults, PK/FK/índices, funciones, grants/políticas y triggers exactos. Members/Usage y Caller están enlazados a sus features; Lead Engine010 define16 tablas y21 funciones SECURITY INVOKER según evidencia. Usage060 incluye funciones SECURITY DEFINER explícitas de metering/admin/wallet, cuyo alcance y permisos están en su SQL; no describir todo el esquema como SECURITY INVOKER. No migración destructiva ejecutada en OR02.

## Rutas implementadas (métodos exportados)

La tabla enumera código; no implica integración comercial habilitada. Guards y payloads exactos en la fuente/feature. En particular, Lead Engine usa aún requireOperator y tiene hallazgo L-AUTH; no afirmar membresía NBC aplicada en todas sus rutas. Caller usa identidad común con restricciones admin en voces/demo. Members/Settings/Usage aplican roles propios; webhook de créditos valida firma del proveedor. Ver revisión OR02 para límites.

| Ruta | Métodos | Fuente |
|---|---|---|
| `/api/academy/covers/[id]` | GET | [route.ts](../../src/app/api/academy/covers/[id]/route.ts) |
| `/api/academy/covers` | POST | [route.ts](../../src/app/api/academy/covers/route.ts) |
| `/api/academy/inventories/[id]/revisions` | GET | [route.ts](../../src/app/api/academy/inventories/[id]/revisions/route.ts) |
| `/api/academy/inventories/[id]` | GET, PUT | [route.ts](../../src/app/api/academy/inventories/[id]/route.ts) |
| `/api/academy/inventories` | GET | [route.ts](../../src/app/api/academy/inventories/route.ts) |
| `/api/admin/usage` | GET | [route.ts](../../src/app/api/admin/usage/route.ts) |
| `/api/calendar` | GET | [route.ts](../../src/app/api/calendar/route.ts) |
| `/api/caller/demo` | GET, POST | [route.ts](../../src/app/api/caller/demo/route.ts) |
| `/api/caller/leads/[id]/activity` | GET, POST | [route.ts](../../src/app/api/caller/leads/[id]/activity/route.ts) |
| `/api/caller/leads/[id]/details` | PATCH | [route.ts](../../src/app/api/caller/leads/[id]/details/route.ts) |
| `/api/caller/leads` | GET, POST, PATCH | [route.ts](../../src/app/api/caller/leads/route.ts) |
| `/api/caller/lists` | GET, POST | [route.ts](../../src/app/api/caller/lists/route.ts) |
| `/api/caller/pipeline` | GET, PUT | [route.ts](../../src/app/api/caller/pipeline/route.ts) |
| `/api/caller/sessions/[id]/sync` | POST | [route.ts](../../src/app/api/caller/sessions/[id]/sync/route.ts) |
| `/api/caller/sessions/reconcile` | POST | [route.ts](../../src/app/api/caller/sessions/reconcile/route.ts) |
| `/api/caller/sessions` | GET, POST | [route.ts](../../src/app/api/caller/sessions/route.ts) |
| `/api/caller/views/[scope]` | GET, PUT | [route.ts](../../src/app/api/caller/views/[scope]/route.ts) |
| `/api/caller/voices/capabilities` | GET | [route.ts](../../src/app/api/caller/voices/capabilities/route.ts) |
| `/api/caller/voices/clone` | POST | [route.ts](../../src/app/api/caller/voices/clone/route.ts) |
| `/api/caller/voices` | GET, PATCH, POST | [route.ts](../../src/app/api/caller/voices/route.ts) |
| `/api/credits/checkout` | POST | [route.ts](../../src/app/api/credits/checkout/route.ts) |
| `/api/credits/packages` | GET | [route.ts](../../src/app/api/credits/packages/route.ts) |
| `/api/credits/webhook` | POST | [route.ts](../../src/app/api/credits/webhook/route.ts) |
| `/api/integrations/events` | GET | [route.ts](../../src/app/api/integrations/events/route.ts) |
| `/api/integrations/ghl/test` | POST | [route.ts](../../src/app/api/integrations/ghl/test/route.ts) |
| `/api/integrations/status` | GET | [route.ts](../../src/app/api/integrations/status/route.ts) |
| `/api/lead-engine/connections/check` | POST | [route.ts](../../src/app/api/lead-engine/connections/check/route.ts) |
| `/api/lead-engine/folders` | GET, POST | [route.ts](../../src/app/api/lead-engine/folders/route.ts) |
| `/api/lead-engine/lists/[id]/move` | POST | [route.ts](../../src/app/api/lead-engine/lists/[id]/move/route.ts) |
| `/api/lead-engine/lists/[id]` | GET | [route.ts](../../src/app/api/lead-engine/lists/[id]/route.ts) |
| `/api/lead-engine/lists/[id]/sync` | POST | [route.ts](../../src/app/api/lead-engine/lists/[id]/sync/route.ts) |
| `/api/lead-engine/lists` | GET | [route.ts](../../src/app/api/lead-engine/lists/route.ts) |
| `/api/lead-engine/plans/[id]/dry-run` | POST | [route.ts](../../src/app/api/lead-engine/plans/[id]/dry-run/route.ts) |
| `/api/lead-engine/plans/[id]` | GET | [route.ts](../../src/app/api/lead-engine/plans/[id]/route.ts) |
| `/api/lead-engine/plans` | GET, POST | [route.ts](../../src/app/api/lead-engine/plans/route.ts) |
| `/api/lead-engine/quotes/[id]/approve` | POST | [route.ts](../../src/app/api/lead-engine/quotes/[id]/approve/route.ts) |
| `/api/lead-engine/quotes` | POST | [route.ts](../../src/app/api/lead-engine/quotes/route.ts) |
| `/api/members` | GET, POST | [route.ts](../../src/app/api/members/route.ts) |
| `/api/members/summary` | GET | [route.ts](../../src/app/api/members/summary/route.ts) |
| `/api/profile` | GET, PATCH | [route.ts](../../src/app/api/profile/route.ts) |
| `/api/webhooks/ghl` | POST | [route.ts](../../src/app/api/webhooks/ghl/route.ts) |
| `/api/workspace/session` | GET | [route.ts](../../src/app/api/workspace/session/route.ts) |
