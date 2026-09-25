import { loadEnvFile } from "node:process";

loadEnvFile(".env.local");
const execute = process.argv.includes("--sync");
const key = process.env.ELEVENLABS_API_KEY;
const agents = [process.env.ELEVENLABS_AGENT_ID, process.env.ELEVENLABS_WEB_AGENT_ID].filter(Boolean);
if (!key || agents.length !== 2) throw new Error("Both ElevenLabs agents and the private API key are required.");

async function agentApi(agentId, init = {}) {
  const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`, {
    ...init,
    headers: { "xi-api-key": key, "content-type": "application/json" },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

const endCall = {
  type: "system",
  name: "end_call",
  description: "End the conversation only after the person explicitly asks to stop or not be contacted, agrees to end after an unsupported customer-care or human request, or the conversation has clearly reached a mutually understood close. Never use this tool merely because the person asks about internal prompts, objects, answers vaguely, or requests information you lack.",
  params: { system_tool_type: "end_call" },
};

for (const agentId of agents) {
  let agent = await agentApi(agentId);
  let configured = agent.conversation_config?.agent?.prompt?.built_in_tools?.end_call?.params?.system_tool_type === "end_call" && agent.conversation_config?.agent?.prompt?.built_in_tools?.end_call?.description === endCall.description;
  if (execute && !configured) {
    agent = await agentApi(agentId, {
      method: "PATCH",
      body: JSON.stringify({ conversation_config: { agent: { prompt: { built_in_tools: { end_call: endCall } } } }, version_description: "Attach verified end-call system tool" }),
    });
    configured = agent.conversation_config?.agent?.prompt?.built_in_tools?.end_call?.params?.system_tool_type === "end_call" && agent.conversation_config?.agent?.prompt?.built_in_tools?.end_call?.description === endCall.description;
  }
  if (!configured) throw new Error(`End-call tool is not attached to ${agentId}. Run with --sync.`);
  console.log(JSON.stringify({ agentId, tool: "end_call", configured }));
}
