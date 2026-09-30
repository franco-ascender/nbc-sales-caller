/** Shared editor/server contract. Keep business facts separate from execution permissions. */
export const CONTEXT_CHARACTER_LIMIT = 12000;
export const CONTEXT_ANSWER_LIMIT = 12;
export const callerContextFields = [
  { key: "business", label: "Business background", hint: "Who you represent, what you do, where you operate, and what makes the business different." },
  { key: "leadSource", label: "Lead origin", hint: "Where this lead came from and what they actually requested. Leave unknown details blank." },
  { key: "qualification", label: "Qualification criteria", hint: "Good fit, disqualifiers, and the few things you need to learn before suggesting a next step." },
  { key: "boundaries", label: "Commercial boundaries", hint: "Confirmed terms, exclusions, refund policy, and claims the caller must never make." },
  { key: "proof", label: "Approved proof", hint: "Real differentiators, results or examples you are authorized to quote. No invented testimonials." },
  { key: "nextStep", label: "Next step", hint: "What a successful conversation should lead to. Booking or sending requires a connected tool." },
] as const;
export type CallerContextField = typeof callerContextFields[number]["key"];
export interface CallerAnswer { kind: "question" | "objection"; question: string; answer: string }
export type CallerContext = Record<CallerContextField, string> & { answers: CallerAnswer[] };
export const emptyCallerContext = (): CallerContext => ({ business: "", leadSource: "", qualification: "", boundaries: "", proof: "", nextStep: "", answers: [] });
export function contextCharacterCount(context: CallerContext): number {
  return callerContextFields.reduce((n, field) => n + context[field.key].length, 0) + context.answers.reduce((n, row) => n + row.question.length + row.answer.length, 0);
}
function boundedText(value: unknown, name: string, max: number, required = false): string {
  if (typeof value !== "string") throw new Error(`${name} must be text.`);
  const result = value.trim().replace(/\r\n/g, "\n");
  if (required && !result) throw new Error(`Complete ${name.toLowerCase()} or remove the empty answer.`);
  if (result.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(result)) throw new Error(`${name} is too long or contains unsupported characters.`);
  return result;
}
export function parseCallerContext(value: unknown): CallerContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Use a valid caller context.");
  const input = value as Record<string, unknown>, context = emptyCallerContext();
  for (const field of callerContextFields) context[field.key] = boundedText(input[field.key] ?? "", field.label, 1800);
  const answers = input.answers ?? [];
  if (!Array.isArray(answers) || answers.length > CONTEXT_ANSWER_LIMIT) throw new Error(`Use up to ${CONTEXT_ANSWER_LIMIT} approved answers.`);
  context.answers = answers.map((row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Use a valid approved answer.");
    const entry = row as Record<string, unknown>;
    if (entry.kind !== "question" && entry.kind !== "objection") throw new Error("Choose question or objection.");
    return { kind: entry.kind, question: boundedText(entry.question, "Question or objection", 300, true), answer: boundedText(entry.answer, "Approved answer", 1200, true) };
  });
  if (contextCharacterCount(context) > CONTEXT_CHARACTER_LIMIT) throw new Error(`Keep the additional context under ${CONTEXT_CHARACTER_LIMIT.toLocaleString("en-US")} characters. Prioritize the facts and answers needed during the call.`);
  return context;
}
export function renderCallerContext(context?: CallerContext): string {
  if (!context) return "";
  return [
    ...callerContextFields.filter(field => context[field.key].trim()).map(field => `${field.label}: ${context[field.key]}`),
    ...context.answers.map((row, index) => `Approved ${row.kind} ${index + 1}\nProspect: ${row.question}\nAnswer guidance: ${row.answer}`),
  ].join("\n\n");
}
