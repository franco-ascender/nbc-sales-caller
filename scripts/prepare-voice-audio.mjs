import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

// Serve the SDK's exact audio processors from our origin. Blob/CDN fallbacks
// are blocked by the portal CSP; worker-src does not authorize AudioWorklets.
const require = createRequire(import.meta.url);
const sdk = dirname(dirname(require.resolve('@elevenlabs/client')));
const { version } = JSON.parse(readFileSync(resolve(sdk, 'package.json'), 'utf8'));
if (version !== '1.25.0') throw Error('Review the voice audio paths when upgrading the SDK.');
const destination = resolve('public/voice-audio', version);
mkdirSync(destination, { recursive: true });
for (const file of ['rawAudioProcessor.js', 'audioConcatProcessor.js']) {
  copyFileSync(resolve(sdk, 'worklets', file), resolve(destination, file));
}
