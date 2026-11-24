// ElevenLabs-only clip sets ("msa" = Modern Standard Arabic course, "idn" = Indonesian course, "sau" = Saudi course, "zhn" = Chinese course): the key is ELEVENLABS_API_KEY and each set has
// its own voice id chosen in the Voice Library (ELEVENLABS_VOICE_ID_AR, _ID, _SA, _ZH), from the environment or the git-ignored .env.local.
// Without them nothing is made and the course keeps using the macOS recordings it already has.
import * as eleven from './elevenlabs-tts.mjs';

export function chooseVoiceEngine(root, voiceVar, env = process.env) {
  const c = eleven.readConfig(root, env, voiceVar);
  if (c.key && c.voiceId) return { name: 'elevenlabs', label: `ElevenLabs ${c.model} (voice ${c.voiceId})`, convert: true, synthesize: (text) => eleven.synthesize(text, c) };
  return { name: 'none', reason: `no ELEVENLABS_API_KEY + ${voiceVar} found` };
}
export const chooseMsaEngine = (root, env = process.env) => chooseVoiceEngine(root, 'ELEVENLABS_VOICE_ID_AR', env);
export const chooseIdnEngine = (root, env = process.env) => chooseVoiceEngine(root, 'ELEVENLABS_VOICE_ID_ID', env);
export const chooseSauEngine = (root, env = process.env) => chooseVoiceEngine(root, 'ELEVENLABS_VOICE_ID_SA', env);
export const chooseZhnEngine = (root, env = process.env) => chooseVoiceEngine(root, 'ELEVENLABS_VOICE_ID_ZH', env);
