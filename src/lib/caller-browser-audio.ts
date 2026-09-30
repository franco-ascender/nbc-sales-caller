export const voiceAudioOptions = {
  workletPaths: {
    rawAudioProcessor: '/voice-audio/1.25.0/rawAudioProcessor.js',
    audioConcatProcessor: '/voice-audio/1.25.0/audioConcatProcessor.js',
  },
};

// Do not expose raw SDK exceptions: they may contain a signed connection URL.
export function voiceStartError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';
  if (name === 'NotAllowedError') return 'Allow microphone access in your browser, then start again.';
  if (name === 'NotFoundError') return 'No microphone was found. Connect a microphone, then start again.';
  if (name === 'NotReadableError') return 'Your microphone could not open. Close other apps using it, then start again.';
  if (/worklet|audioContext|audio context/i.test(message)) return 'Browser audio could not initialize. Reload the page to load the latest audio files, then try again.';
  if (/did not match its saved authorization/.test(message)) return 'The voice session could not be verified. Its result is being checked; try a new test once that finishes.';
  return 'The voice connection could not start. Its result is being checked automatically. Check your connection and try again.';
}
