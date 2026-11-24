// Chooses the service that makes the Egyptian Arabic recordings. ElevenLabs is preferred when its key AND an Egyptian voice id are set;
// otherwise Azure Speech when its key and region are set; otherwise none (the app then keeps using the Standard Arabic recordings).
// EG_TTS_ENGINE=elevenlabs|azure (environment or .env.local) forces one.
import { toCairene } from './eg-pronunciation.mjs';
import fs from 'node:fs';
import path from 'node:path';
import * as azure from './azure-tts.mjs';
import * as eleven from './elevenlabs-tts.mjs';

export function chooseEngine(root, env = process.env) {
  let forced = env.EG_TTS_ENGINE || '';
  const file = path.join(root, '.env.local');
  if (!forced && fs.existsSync(file)) forced = (fs.readFileSync(file, 'utf8').match(/^\s*EG_TTS_ENGINE\s*=\s*["']?(\w+)["']?\s*$/m) || [])[1] || '';
  const e = eleven.readConfig(root, env);
  const a = azure.readConfig(root, env);
  const haveEleven = !!(e.key && e.voiceId);
  const haveAzure = !!(a.key && a.region);
  const useEleven = forced === 'elevenlabs' ? true : forced === 'azure' ? false : haveEleven;
  if (useEleven && haveEleven) return { name: 'elevenlabs', label: `ElevenLabs ${e.model} (voice ${e.voiceId})`, convert: true, synthesize: (text) => eleven.synthesize(toCairene(text), e) };
  if (!useEleven && haveAzure) return { name: 'azure', label: `Azure Speech ${a.voice}`, convert: false, synthesize: (text) => azure.synthesize(toCairene(text), a) };
  if (forced === 'elevenlabs' || forced === 'azure') return { name: 'none', reason: `EG_TTS_ENGINE=${forced} but its settings are incomplete` };
  if (haveAzure) return { name: 'azure', label: `Azure Speech ${a.voice}`, convert: false, synthesize: (text) => azure.synthesize(toCairene(text), a) };
  return { name: 'none', reason: 'no ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID and no AZURE_SPEECH_KEY + AZURE_SPEECH_REGION found' };
}
