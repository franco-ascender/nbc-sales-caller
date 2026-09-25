export const TRANSCRIPT_NOTICE = "This call is being transcribed for educational purposes.";
export const RECORDING_NOTICE = "This call is going to be recorded for educational purposes.";
export function openingDisclosure(recordVoice: boolean): string {
  return `${recordVoice ? RECORDING_NOTICE : TRANSCRIPT_NOTICE} Hi, I'm NBC's AI assistant. This is an internal voice test. What does your lead follow-up process look like today?`;
}
