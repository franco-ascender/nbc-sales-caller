import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (existsSync(".env.local")) loadEnvFile(".env.local");
const mode = process.argv[2];
if (!["--prepare", "--attach", "--verify"].includes(mode)) throw new Error("Use --prepare, --attach, or --verify.");
const elevenKey = process.env.ELEVENLABS_API_KEY;
const vercelToken = process.env.VERCEL_TOKEN, project = process.env.VERCEL_PROJECT_ID, team = process.env.VERCEL_TEAM_ID;
if (!elevenKey || !vercelToken || !project || !team) throw new Error("ElevenLabs and Vercel project credentials are required.");
const url = "https://nbc-sales.vercel.app/api/caller/webhooks/elevenlabs";
const name = "NBC Caller post-call";
const eleven = async (path, init = {}) => {
  const response = await fetch(`https://api.elevenlabs.io${path}`, { ...init, headers: { "xi-api-key": elevenKey, "content-type": "application/json" } });
  const body = await response.json(); if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${JSON.stringify(body)}`); return body;
};
const list = async () => (await eleven("/v1/workspace/webhooks")).webhooks || [];
const find = async () => (await list()).find((item) => item.webhook_url === url);

function saveLocalSecret(secret) {
  const path = ".env.local", lines = readFileSync(path, "utf8").split(/\r?\n/); let written = false;
  const next = lines.filter((line) => {
    if (!line.startsWith("ELEVENLABS_WEBHOOK_SECRET=")) return true;
    if (written) return false;
    written = true; return true;
  }).map((line) => line.startsWith("ELEVENLABS_WEBHOOK_SECRET=") ? `ELEVENLABS_WEBHOOK_SECRET=${secret}` : line);
  if (!written) next.push(`ELEVENLABS_WEBHOOK_SECRET=${secret}`);
  writeFileSync(path, next.join("\n"));
}

async function saveVercelSecret(secret) {
  const suffix = `?teamId=${team}`, headers = { authorization: `Bearer ${vercelToken}`, "content-type": "application/json" };
  const listed = await fetch(`https://api.vercel.com/v9/projects/${project}/env${suffix}`, { headers });
  const current = await listed.json(); if (!listed.ok) throw new Error(`Vercel env list ${listed.status}`);
  const matches = (current.envs || []).filter((entry) => entry.key === "ELEVENLABS_WEBHOOK_SECRET");
  if (matches.length) {
    for (const entry of matches) {
      const updated = await fetch(`https://api.vercel.com/v9/projects/${project}/env/${entry.id}${suffix}`, { method: "PATCH", headers, body: JSON.stringify({ value: secret, target: entry.target, type: entry.type || "encrypted" }) });
      if (!updated.ok) throw new Error(`Vercel env update ${updated.status}`);
    }
  } else {
    const created = await fetch(`https://api.vercel.com/v10/projects/${project}/env${suffix}`, { method: "POST", headers, body: JSON.stringify({ key: "ELEVENLABS_WEBHOOK_SECRET", value: secret, type: "encrypted", target: ["production", "preview"] }) });
    if (!created.ok) throw new Error(`Vercel env create ${created.status}`);
  }
}

if (mode === "--prepare") {
  if (await find()) throw new Error("The NBC webhook already exists; use --attach or --verify instead of rotating its unrecoverable HMAC secret.");
  const created = await eleven("/v1/workspace/webhooks", { method: "POST", body: JSON.stringify({ settings: { auth_type: "hmac", name, webhook_url: url } }) });
  if (!created.webhook_id || !created.webhook_secret) throw new Error("ElevenLabs did not return the new HMAC material.");
  saveLocalSecret(created.webhook_secret); await saveVercelSecret(created.webhook_secret);
  await eleven(`/v1/workspace/webhooks/${encodeURIComponent(created.webhook_id)}`, { method: "PATCH", body: JSON.stringify({ is_disabled: false, name, retry_enabled: true, events: ["post_call_transcription"] }) });
  console.log(JSON.stringify({ prepared: true, webhook_id: created.webhook_id, secret_saved_locally: true, secret_saved_to_vercel: true, attached: false }));
}

if (mode === "--attach") {
  const webhook = await find(); if (!webhook) throw new Error("Prepare the NBC webhook first.");
  await eleven("/v1/convai/settings", { method: "PATCH", body: JSON.stringify({ webhooks: { post_call_webhook_id: webhook.webhook_id, events: ["transcript"], transcript_format: "json", send_audio: false } }) });
  console.log(JSON.stringify({ attached: true, webhook_id: webhook.webhook_id, disabled: webhook.is_disabled, auto_disabled: webhook.is_auto_disabled }));
}

if (mode === "--verify") {
  const webhook = await find(), settings = await eleven("/v1/convai/settings");
  console.log(JSON.stringify({ exists: Boolean(webhook), webhook_id: webhook?.webhook_id ?? null, disabled: webhook?.is_disabled ?? null, auto_disabled: webhook?.is_auto_disabled ?? null, retry_enabled: webhook?.retry_enabled ?? null, attached: Boolean(webhook && settings.webhooks?.post_call_webhook_id === webhook.webhook_id), events: settings.webhooks?.events, transcript_format: settings.webhooks?.transcript_format, send_audio: settings.webhooks?.send_audio }));
}
