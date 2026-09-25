#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PROVIDERS = new Set(['codex', 'claude']);
const RISKS = new Set(['low', 'high']);
const BILLING = new Set(['included', 'api', 'unknown']);
const STATUSES = new Set(['ready', 'needs_replan', 'needs_access', 'needs_exception_review', 'needs_billing_confirmation']);

function assert(condition, message) {
  if (!condition) throw new TypeError(message);
}

function validatePolicy(policy, requiresOrchestrator) {
  assert(policy && typeof policy === 'object' && !Array.isArray(policy), 'policy must be an object');
  assert(policy.version === 1, 'policy.version must be 1');
  assert(policy.defaults && PROVIDERS.has(policy.defaults.provider), 'policy.defaults.provider must be codex or claude');
  assert(Number.isSafeInteger(policy.defaults.maxAttempts) && policy.defaults.maxAttempts > 0, 'policy.defaults.maxAttempts must be a positive safe integer');
  assert(policy.tiers && typeof policy.tiers === 'object', 'policy.tiers must be an object');
  assert(policy.taskTiers && typeof policy.taskTiers === 'object', 'policy.taskTiers must be an object');
  const requiredTiers = ['routine', 'implementation', 'critical', 'exceptional'];
  assert(Array.isArray(policy.escalation) && policy.escalation.length === requiredTiers.length && new Set(policy.escalation).size === requiredTiers.length && requiredTiers.every((tier, index) => policy.escalation[index] === tier), 'policy.escalation must contain required tiers in order without duplicates');
  for (const tier of policy.escalation) {
    assert(typeof tier === 'string' && policy.tiers[tier], `policy tier ${tier} is missing`);
    for (const provider of PROVIDERS) {
      const choice = policy.tiers[tier][provider];
      assert(choice && typeof choice.model === 'string' && choice.model.trim() && typeof choice.effort === 'string' && choice.effort.trim(), `policy tier ${tier}.${provider} is invalid`);
    }
  }
  for (const [task, tier] of Object.entries(policy.taskTiers)) {
    assert(typeof task === 'string' && policy.escalation.includes(tier), `policy task tier for ${task} is invalid`);
  }
  if (requiresOrchestrator) {
    const route = policy.orchestrator;
    assert(route && route.provider === 'codex' && route.model === 'gpt-6-astra' && route.effort === 'high', 'policy.orchestrator must fix codex gpt-6-astra at high effort');
  }
}

function validateInput(policy, input) {
  assert(input && typeof input === 'object' && !Array.isArray(input), 'input must be an object');
  assert(typeof input.task === 'string' && Object.hasOwn(policy.taskTiers, input.task), 'task must be a configured task type');
  if (input.provider !== undefined) assert(PROVIDERS.has(input.provider), 'provider must be codex or claude');
  if (input.risk !== undefined) assert(RISKS.has(input.risk), 'risk must be low or high');
  if (input.billing !== undefined) assert(BILLING.has(input.billing), 'billing must be included, api, or unknown');
  if (input.attempts !== undefined) assert(Number.isInteger(input.attempts) && input.attempts >= 0, 'attempts must be a non-negative integer');
  if (input.claudeAvailable !== undefined) assert(typeof input.claudeAvailable === 'boolean', 'claudeAvailable must be a boolean');
  if (input.escalate !== undefined) assert(typeof input.escalate === 'boolean', 'escalate must be a boolean');
  if (input.exceptional !== undefined) assert(typeof input.exceptional === 'boolean', 'exceptional must be a boolean');
  if (input.reason !== undefined) assert(typeof input.reason === 'string', 'reason must be a string');
  if ((input.escalate || input.exceptional) && !input.reason?.trim()) throw new TypeError('reason is required for escalation or exceptional routing');
}

function response({ tier, provider, choice = null, billing, rationale, status }) {
  assert(STATUSES.has(status), 'invalid route status');
  return {
    tier,
    model: choice?.model ?? null,
    effort: choice?.effort ?? null,
    provider,
    billing,
    rationale,
    status,
    limitations: [
      'Does not change chats.',
      'Does not execute a provider API.',
      'Does not enforce a hard budget.',
      'Actual cost and remaining quota are not measured; billing is user-declared.',
    ],
  };
}

/** Pure policy decision: no filesystem, network, or provider calls. */
export function routeTask(policy, input) {
  validatePolicy(policy, input?.task === 'orchestration');
  validateInput(policy, input);
  const provider = input.provider ?? policy.defaults.provider;
  const billing = input.billing ?? 'unknown';
  const risk = input.risk ?? 'low';
  const attempts = input.attempts ?? 0;
  let tier = policy.taskTiers[input.task];
  const isOrchestrator = input.task === 'orchestration';
  const criticalTask = new Set(['auth', 'billing', 'migration', 'architecture']);
  const reasons = [`task ${input.task} maps to ${tier}`];

  if (isOrchestrator && input.provider && input.provider !== 'codex') {
    throw new TypeError('orchestration has a fixed Codex role and does not accept another provider');
  }
  if (isOrchestrator) {
    tier = 'orchestration';
    reasons.push('orchestrator uses the fixed Codex route');
    if (attempts >= policy.defaults.maxAttempts) {
      return response({ tier, provider: 'codex', billing, status: 'needs_replan', rationale: [...reasons, `attempt limit ${policy.defaults.maxAttempts} reached; replan before another selection`] });
    }
    return response({ tier, provider: 'codex', choice: policy.orchestrator, billing, status: 'ready', rationale: reasons });
  }

  if (criticalTask.has(input.task) || risk === 'high') {
    tier = 'critical';
    reasons.push(criticalTask.has(input.task) ? 'protected task requires critical review' : 'high risk requires critical review');
  }
  if (attempts >= policy.defaults.maxAttempts) {
    return response({ tier, provider, billing, status: 'needs_replan', rationale: [...reasons, `attempt limit ${policy.defaults.maxAttempts} reached; replan before another selection`] });
  }
  if (tier === 'exceptional' && !input.exceptional) {
    return response({ tier, provider, billing, status: 'needs_exception_review', rationale: [...reasons, 'exceptional routing requires --exceptional and a concrete reason'] });
  }
  if (input.exceptional) {
    tier = 'exceptional';
    reasons.push(`exceptional review requested: ${input.reason.trim()}`);
  } else if (input.escalate) {
    const index = policy.escalation.indexOf(tier);
    const nextTier = policy.escalation[index + 1];
    if (!nextTier) {
      return response({ tier, provider, billing, status: 'needs_exception_review', rationale: [...reasons, 'exceptional routing requires --exceptional and a concrete reason'] });
    }
    if (nextTier === 'exceptional') {
      return response({ tier, provider, billing, status: 'needs_exception_review', rationale: [...reasons, 'exceptional routing requires --exceptional and a concrete reason'] });
    }
    tier = nextTier;
    reasons.push(`one-tier escalation requested: ${input.reason.trim()}`);
  }
  const choice = policy.tiers[tier][provider];
  if (provider === 'claude' && input.claudeAvailable !== true) {
    return response({ tier, provider, choice, billing, status: 'needs_access', rationale: [...reasons, 'Claude availability has not been explicitly confirmed'] });
  }
  if (provider === 'claude' && billing === 'unknown') {
    return response({ tier, provider, choice, billing, status: 'needs_billing_confirmation', rationale: [...reasons, 'Claude billing is unknown and requires confirmation'] });
  }
  return response({ tier, provider, choice, billing, status: 'ready', rationale: reasons });
}

function parseArguments(argv) {
  const input = {};
  const values = new Set(['--task', '--risk', '--provider', '--billing', '--attempts', '--reason']);
  const flags = new Set(['--claude-available', '--escalate', '--exceptional']);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (values.has(token)) {
      const value = argv[++index];
      assert(value !== undefined && !value.startsWith('--'), `${token} requires a value`);
      const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      assert(input[key] === undefined, `${token} may only be provided once`);
      input[key] = token === '--attempts' ? parseAttempts(value) : value;
    } else if (flags.has(token)) {
      const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      assert(input[key] === undefined, `${token} may only be provided once`);
      input[key] = true;
    } else {
      throw new TypeError(`unknown argument: ${token}`);
    }
  }
  return input;
}

function parseAttempts(value) {
  assert(/^(0|[1-9]\d*)$/.test(value), 'attempts must be a non-negative integer');
  const attempts = Number(value);
  assert(Number.isSafeInteger(attempts), 'attempts must be a safe integer');
  return attempts;
}

async function main() {
  try {
    const input = parseArguments(process.argv.slice(2));
    const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
    const policyPath = path.resolve(scriptDirectory, '../docs/lanes/model-routing-policy.json');
    const policy = JSON.parse(await readFile(policyPath, 'utf8'));
    process.stdout.write(`${JSON.stringify(routeTask(policy, input))}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'invalid_input', error: error instanceof Error ? error.message : String(error) })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
