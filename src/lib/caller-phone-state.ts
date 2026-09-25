export type PhoneDispatchState = "reserved" | "dispatching" | "dispatch_unknown" | "accepted" | "rejected";
export type PhoneCallState = "queued" | "ringing" | "in_progress" | "completed" | "busy" | "no_answer" | "failed" | "canceled";
export type PhoneResultState = "pending" | "available" | "unavailable";
export type PhoneCostState = "pending" | "settled";

export interface PhoneAttemptState {
  dispatch: PhoneDispatchState;
  call: PhoneCallState | null;
  result: PhoneResultState;
  cost: PhoneCostState;
  stopRequested: boolean;
}

export const initialPhoneAttemptState = (): PhoneAttemptState => ({ dispatch: "reserved", call: null, result: "pending", cost: "pending", stopRequested: false });

const terminal = new Set<PhoneCallState>(["completed", "busy", "no_answer", "failed", "canceled"]);
const rank: Record<PhoneCallState, number> = { queued: 1, ringing: 2, in_progress: 3, completed: 4, busy: 4, no_answer: 4, failed: 4, canceled: 4 };

export function acceptDispatch(state: PhoneAttemptState): PhoneAttemptState {
  if (state.dispatch !== "dispatching") return state;
  return { ...state, dispatch: "accepted", call: state.call ?? "queued" };
}

export function markDispatchUnknown(state: PhoneAttemptState): PhoneAttemptState {
  return state.dispatch === "dispatching" ? { ...state, dispatch: "dispatch_unknown" } : state;
}

export function rejectDispatch(state: PhoneAttemptState): PhoneAttemptState {
  return state.dispatch === "dispatching" ? { ...state, dispatch: "rejected", call: "failed" } : state;
}

export function applyTwilioCallState(state: PhoneAttemptState, incoming: PhoneCallState): PhoneAttemptState {
  if (state.call && terminal.has(state.call)) return state;
  if (state.call && !terminal.has(incoming) && rank[incoming] < rank[state.call]) return state;
  return { ...state, dispatch: state.dispatch === "reserved" || state.dispatch === "dispatching" ? "accepted" : state.dispatch, call: incoming };
}

export function requestPhoneStop(state: PhoneAttemptState, callSid: string | null): { state: PhoneAttemptState; requiresProviderStop: boolean } {
  if (state.stopRequested || state.call !== null && terminal.has(state.call)) return { state, requiresProviderStop: false };
  return { state: { ...state, stopRequested: true }, requiresProviderStop: Boolean(callSid) };
}

export function canRegisterElevenCall(state: PhoneAttemptState): boolean {
  return state.dispatch === "accepted" && state.call !== null && !state.stopRequested && !terminal.has(state.call);
}
