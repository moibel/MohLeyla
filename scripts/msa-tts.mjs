// The service that makes the Modern Standard Arabic recordings (the "msa" clip set, used by the Arabic course): ElevenLabs, with a Standard
// Arabic voice chosen in its Voice Library, from ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID_AR (environment or the git-ignored .env.local).
// Without them nothing is made and the Arabic course keeps using the macOS (Majed) recordings it already has.
import * as eleven from './elevenlabs-tts.mjs';

export function chooseMsaEngine(root, env = process.env) {
  const c = eleven.readConfig(root, env, 'ELEVENLABS_VOICE_ID_AR');
  if (c.key && c.voiceId) return { name: 'elevenlabs', label: `ElevenLabs ${c.model} (voice ${c.voiceId})`, convert: true, synthesize: (text) => eleven.synthesize(text, c) };
  return { name: 'none', reason: 'no ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID_AR found' };
}
