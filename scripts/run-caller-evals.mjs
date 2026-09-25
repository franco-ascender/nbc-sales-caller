import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (existsSync(".env.local")) loadEnvFile(".env.local");
const repeatIndex = process.argv.indexOf("--repeat"), execute = process.argv.includes("--execute");
const repeat = repeatIndex >= 0 ? Number(process.argv[repeatIndex + 1]) : 1;
const agentIndex = process.argv.indexOf("--agent"), agentName = agentIndex >= 0 ? process.argv[agentIndex + 1] : "telephone";
const onlyIndex = process.argv.indexOf("--only"), only = onlyIndex >= 0 ? new Set(process.argv[onlyIndex + 1].split(",").filter(Boolean)) : null;
if (!execute || !Number.isInteger(repeat) || repeat < 1 || repeat > 20) throw new Error("Use --execute --repeat <1-20>. Simulations consume provider resources.");
if (!['telephone','browser'].includes(agentName)) throw new Error("Use --agent telephone or --agent browser.");
const key = process.env.ELEVENLABS_API_KEY, agent = agentName === 'telephone' ? process.env.ELEVENLABS_AGENT_ID : process.env.ELEVENLABS_WEB_AGENT_ID;
if (!key || !agent) throw new Error("ELEVENLABS_API_KEY and the selected agent ID are required.");
const suite = JSON.parse(readFileSync("config/nbc-caller-eval-v1.json", "utf8"));
const manifestPath = `artifacts/caller/evals/${suite.version}-manifest.json`;
if (!existsSync(manifestPath)) throw new Error("Sync the evaluation suite before running it.");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (!Array.isArray(manifest.tests) || manifest.tests.length !== suite.tests.length || manifest.tests.some(item => !item.id)) throw new Error("The remote evaluation manifest is incomplete.");
const selected = manifest.tests.filter(item => !only || only.has(item.slug));
if (!selected.length || only && selected.length !== only.size) throw new Error("Every --only slug must exist in the synced suite.");

async function request(path, init = {}) {
  const response = await fetch(`https://api.elevenlabs.io${path}`, { ...init, headers: { "xi-api-key": key, "content-type": "application/json" } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${JSON.stringify(body)}`);
  return body;
}
const subscription = async () => {
  try { const value = await request("/v1/user/subscription"); return { character_count: value.character_count ?? null, character_limit: value.character_limit ?? null, tier: value.tier ?? null }; }
  catch { return null; }
};

const before = await subscription();
let result = await request(`/v1/convai/agents/${encodeURIComponent(agent)}/run-tests`, { method: "POST", body: JSON.stringify({ tests: selected.map(item => ({ test_id: item.id })), repeat_count: repeat }) });
const invocation = result.id;
if (!invocation) throw new Error("ElevenLabs did not return a test invocation ID.");
const deadline = Date.now() + 30 * 60 * 1000;
while (result.test_runs?.some(run => run.status === "pending") || result.bucketing_status === "pending") {
  if (Date.now() > deadline) throw new Error(`Evaluation ${invocation} did not finish within 30 minutes.`);
  await new Promise(resolve => setTimeout(resolve, 5000));
  result = await request(`/v1/convai/test-invocations/${encodeURIComponent(invocation)}`);
  const counts = Object.fromEntries(["passed", "failed", "pending"].map(status => [status, result.test_runs?.filter(run => run.status === status).length ?? 0]));
  process.stdout.write(`${JSON.stringify({ invocation, ...counts, bucketing: result.bucketing_status ?? null })}\n`);
}
const after = await subscription(), directory = "artifacts/caller/evals/runs"; mkdirSync(directory, { recursive: true });
const stamp = new Date().toISOString().replaceAll(":", "-");
const rawPath = `${directory}/${stamp}-${invocation}.json`;
writeFileSync(rawPath, JSON.stringify(result, null, 2) + "\n");
const runs = result.test_runs || [], groups = result.result_groups || [];
const summary = {
  suite: suite.version, invocation, agent: agentName, agent_version: result.version_id ?? null, repeat,
  total: runs.length, passed: runs.filter(run => run.status === "passed").length, failed: runs.filter(run => run.status === "failed").length, pending: runs.filter(run => run.status === "pending").length,
  by_test: suite.tests.filter(test => !only || only.has(test.slug)).map(test => { const matching = runs.filter(run => run.test_name === test.name); return { slug: test.slug, name: test.name, passed: matching.filter(run => run.status === "passed").length, failed: matching.filter(run => run.status === "failed").length, unknown: matching.filter(run => !["passed", "failed"].includes(run.status)).length, failures: matching.filter(run => run.status === "failed").map(run => run.condition_result?.rationale?.summary || run.condition_result?.rationale?.messages?.join(" ") || "No rationale") }; }),
  buckets: groups.map(group => ({ test_name: group.test_name, buckets: group.buckets?.map(bucket => ({ status: bucket.status, count: bucket.test_run_ids?.length ?? 0, title: bucket.title, reason: bucket.reason })) ?? [] })),
  subscription_before: before, subscription_after: after, raw: rawPath,
};
const summaryPath = `${directory}/${stamp}-${invocation}-summary.json`; writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify({ ...summary, by_test: summary.by_test.map(item => ({ slug: item.slug, passed: item.passed, failed: item.failed, unknown: item.unknown })) , buckets: undefined }, null, 2));
if (summary.failed || summary.pending) process.exitCode = 2;
