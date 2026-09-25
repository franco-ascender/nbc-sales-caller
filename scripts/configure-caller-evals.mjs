import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (existsSync(".env.local")) loadEnvFile(".env.local");
const mode = process.argv[2];
if (!["--sync", "--verify"].includes(mode)) throw new Error("Use --sync or --verify. Test execution is deliberately separate because simulations consume provider resources.");
const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error("ELEVENLABS_API_KEY is required.");
const suite = JSON.parse(readFileSync("config/nbc-caller-eval-v1.json", "utf8"));

function validate() {
  if (!/^nbc-caller-eval-v\d/.test(suite.version) || !Array.isArray(suite.tests) || suite.tests.length < 10) throw new Error("Invalid NBC evaluation suite.");
  const slugs = new Set(), names = new Set();
  for (const test of suite.tests) {
    if (!/^[a-z0-9-]{3,60}$/.test(test.slug) || slugs.has(test.slug) || typeof test.name !== "string" || !test.name.startsWith("NBC | ") || names.has(test.name)) throw new Error(`Invalid or duplicate test: ${test.slug}`);
    if (!Number.isInteger(test.max_turns) || test.max_turns < 1 || test.max_turns > 20 || typeof test.scenario !== "string" || test.scenario.length < 40 || !Array.isArray(test.success_conditions) || test.success_conditions.length < 2 || test.success_conditions.some(item => typeof item !== "string" || item.length < 20)) throw new Error(`Invalid test contract: ${test.slug}`);
    slugs.add(test.slug); names.add(test.name);
  }
}
validate();

async function request(path, init = {}) {
  const response = await fetch(`https://api.elevenlabs.io${path}`, { ...init, headers: { "xi-api-key": key, "content-type": "application/json" } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${JSON.stringify(body)}`);
  return body;
}
async function listAll() {
  const rows = []; let cursor = null;
  do {
    const query = new URLSearchParams({ page_size: "100", search: "NBC | " }); if (cursor) query.set("cursor", cursor);
    const page = await request(`/v1/convai/agent-testing?${query}`); rows.push(...(page.tests || [])); cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return rows;
}

const existing = await listAll(), byName = new Map(existing.map(item => [item.name, item]));
const result = [];
for (const test of suite.tests) {
  const found = byName.get(test.name);
  if (found) {
    if (mode === "--sync") await request(`/v1/convai/agent-testing/${encodeURIComponent(found.id)}`, { method: "PUT", body: JSON.stringify({
      type: "simulation", name: test.name, simulation_scenario: test.scenario, simulation_max_turns: test.max_turns,
      success_conditions: test.success_conditions, conversation_initiation_source: "twilio",
      tool_mock_config: { mocking_strategy: "all", fallback_strategy: "raise_error", mocked_tool_ids: [] },
    }) });
    result.push({ slug: test.slug, id: found.id, status: mode === "--sync" ? "updated" : "existing" }); continue;
  }
  if (mode === "--verify") { result.push({ slug: test.slug, id: null, status: "missing" }); continue; }
  const created = await request("/v1/convai/agent-testing/create", { method: "POST", body: JSON.stringify({
    type: "simulation", name: test.name, simulation_scenario: test.scenario, simulation_max_turns: test.max_turns,
    success_conditions: test.success_conditions, conversation_initiation_source: "twilio",
    tool_mock_config: { mocking_strategy: "all", fallback_strategy: "raise_error", mocked_tool_ids: [] },
  }) });
  result.push({ slug: test.slug, id: created.id, status: "created" });
}
mkdirSync("artifacts/caller/evals", { recursive: true });
const output = `artifacts/caller/evals/${suite.version}-manifest.json`;
writeFileSync(output, JSON.stringify({ version: suite.version, generated_at: new Date().toISOString(), tests: result }, null, 2) + "\n");
const missing = result.filter(item => item.status === "missing");
console.log(JSON.stringify({ version: suite.version, total: result.length, created: result.filter(item => item.status === "created").length, updated: result.filter(item => item.status === "updated").length, existing: result.filter(item => item.status === "existing").length, missing: missing.length, manifest: output }));
if (missing.length) process.exitCode = 1;
