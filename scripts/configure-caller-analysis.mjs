import { loadEnvFile } from "node:process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

loadEnvFile(".env.local");
const key = process.env.ELEVENLABS_API_KEY;
const agents = [
  ["telephone", process.env.ELEVENLABS_AGENT_ID],
  ["browser", process.env.ELEVENLABS_WEB_AGENT_ID],
].filter((entry) => entry[1]);
if (!key || agents.length !== 2) throw new Error("Both ElevenLabs agents and the private API key are required.");
const config = JSON.parse(readFileSync("config/nbc-caller-analysis-v1.json", "utf8"));
const endpoint = (id) => `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(id)}`;
const request = async (url, init = {}) => {
  const response = await fetch(url, { ...init, headers: { "xi-api-key": key, "content-type": "application/json", ...(init.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${JSON.stringify(body)}`);
  return body;
};
const view = (agent) => ({
  agent_id: agent.agent_id,
  version_id: agent.version_id,
  branch_id: agent.branch_id,
  analysis_llm: agent.platform_settings?.analysis_llm,
  data_collection: agent.platform_settings?.data_collection,
  evaluation: agent.platform_settings?.evaluation,
  topic_discovery: agent.platform_settings?.topic_discovery,
  sentiment_analysis: agent.platform_settings?.sentiment_analysis,
  summary_language: agent.platform_settings?.summary_language,
});

const stamp = new Date().toISOString().replaceAll(":", "-");
const directory = "artifacts/caller/analysis-v1";
mkdirSync(directory, { recursive: true });
for (const [name, id] of agents) {
  const before = await request(endpoint(id));
  writeFileSync(`${directory}/${stamp}-${name}-before.json`, `${JSON.stringify(view(before), null, 2)}\n`);
  const updated = await request(endpoint(id), {
    method: "PATCH",
    body: JSON.stringify({
      platform_settings: {
        analysis_llm: config.analysis_llm,
        data_collection: config.data_collection,
        data_collection_scopes: Object.fromEntries(Object.keys(config.data_collection).map((field) => [field, "conversation"])),
        evaluation: config.evaluation,
        topic_discovery: { enabled: true },
        sentiment_analysis: { enabled: true },
        summary_language: "en"
      },
      version_description: "NBC post-call analysis v1: sales, customer care, recurring objections, and reporting"
    })
  });
  const after = view(updated);
  if (Object.keys(after.data_collection || {}).length !== Object.keys(config.data_collection).length || after.evaluation?.criteria?.length !== config.evaluation.criteria.length) throw new Error(`${name} agent did not retain the analysis configuration.`);
  writeFileSync(`${directory}/${stamp}-${name}-after.json`, `${JSON.stringify(after, null, 2)}\n`);
  console.log(JSON.stringify({ name, version_id: after.version_id, data_fields: Object.keys(after.data_collection || {}).length, evaluation_criteria: after.evaluation?.criteria?.length || 0, topic_discovery: after.topic_discovery?.enabled === true, sentiment: after.sentiment_analysis?.enabled === true }));
}
