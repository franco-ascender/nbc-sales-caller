import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voiceStartError } from '../src/lib/caller-browser-audio.ts';

test('audio setup errors explain the failed step instead of claiming authorization expired', () => {
  assert.match(voiceStartError(new Error('Failed to load the rawAudioProcessor worklet module')), /audio could not initialize/);
  assert.match(voiceStartError(new DOMException('denied', 'NotAllowedError')), /microphone access/);
  assert.match(voiceStartError(new DOMException('missing', 'NotFoundError')), /No microphone/);
  assert.match(voiceStartError(new DOMException('busy', 'NotReadableError')), /microphone could not open/);
});

test('provider exceptions never expose signed URLs or secrets', () => {
  const result = voiceStartError(new Error('wss://api.elevenlabs.io/?signature=private-test-token'));
  assert.doesNotMatch(result, /signature|private-test-token|elevenlabs/);
  assert.match(result, /checked automatically/);
});
