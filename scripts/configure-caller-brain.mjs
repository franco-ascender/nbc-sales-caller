import { loadEnvFile } from "node:process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

loadEnvFile(".env.local");
const key = process.env.ELEVENLABS_API_KEY;
const agents = [["telephone", process.env.ELEVENLABS_AGENT_ID], ["browser", process.env.ELEVENLABS_WEB_AGENT_ID]].filter((entry) => entry[1]);
if (!key || agents.length !== 2) throw new Error("Both ElevenLabs agents and the private API key are required.");
const brain = JSON.parse(readFileSync("config/nbc-caller-brain-v2.json", "utf8"));
const request = async (id, init = {}) => {
  const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(id)}`, { ...init, headers: { "xi-api-key": key, "content-type": "application/json" } });
  const body = await response.json();
  if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${JSON.stringify(body)}`);
  return body;
};
const safe = (agent) => ({ agent_id: agent.agent_id, version_id: agent.version_id, branch_id: agent.branch_id, model: agent.conversation_config?.agent?.prompt?.llm, temperature: agent.conversation_config?.agent?.prompt?.temperature, max_tokens: agent.conversation_config?.agent?.prompt?.max_tokens, max_duration: agent.conversation_config?.conversation?.max_duration_seconds, prompt_sha256: null });
const { createHash } = await import("node:crypto");
const stamp = new Date().toISOString().replaceAll(":", "-");
const directory = `artifacts/caller/${brain.version.split("-").slice(0, 2).join("-")}`; mkdirSync(directory, { recursive: true });
for (const [name, id] of agents) {
  const before = await request(id); writeFileSync(`${directory}/${stamp}-${name}-before.json`, `${JSON.stringify(safe(before), null, 2)}\n`);
  const context = name === "telephone" ? brain.telephone_context : brain.browser_context;
  const prompt = `${brain.shared_prompt}\n\n${brain.confidentiality_prompt}\n\n${brain.operating_protocol_prompt}\n\n# Context\n${context}`;
  const currentFirst = before.conversation_config?.agent?.first_message;
  const updated = await request(id, { method: "PATCH", body: JSON.stringify({ conversation_config: { agent: { first_message: name === "telephone" ? brain.telephone_first_message : currentFirst, prompt: { prompt, llm: brain.model, temperature: brain.temperature, max_tokens: brain.max_tokens } }, conversation: { max_duration_seconds: name === "telephone" ? brain.telephone_max_duration_seconds : brain.browser_max_duration_seconds } }, version_description: `${brain.version}: priority routing, grounded claims, and decisive next steps` }) });
  const result = safe(updated); result.prompt_sha256 = createHash("sha256").update(updated.conversation_config?.agent?.prompt?.prompt || "").digest("hex");
  if (updated.conversation_config?.agent?.prompt?.prompt !== prompt || result.max_duration !== (name === "telephone" ? brain.telephone_max_duration_seconds : brain.browser_max_duration_seconds)) throw new Error(`${name} brain verification failed.`);
  writeFileSync(`${directory}/${stamp}-${name}-after.json`, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ name, version_id: result.version_id, model: result.model, max_duration: result.max_duration, prompt_sha256: result.prompt_sha256 }));
}
