// Small sound effects made on the fly with the Web Audio API: no audio files, so nothing to download, license or cache.
// Browsers only let a page make sound after the person has touched it once, so when a sound is blocked it waits for the first tap or key
// and then plays. Everything fails quietly: a missing or blocked sound never breaks the page.
const NOTES = {
  celebrate: [[523.25, 0, 0.32], [659.25, 0.11, 0.32], [783.99, 0.22, 0.32], [1046.5, 0.33, 0.6]], // a rising happy arpeggio
  alert: [[880, 0, 0.22], [622.25, 0.2, 0.22], [880, 0.4, 0.34]], // two clear tones that ask for attention
  info: [[659.25, 0, 0.25], [880, 0.12, 0.4]], // a soft ding
  reward: [[698.46, 0, 0.25], [880, 0.1, 0.25], [1174.66, 0.2, 0.5]],
};

let ctx = null;
let armed = null;

function context() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) { try { ctx = new AC(); } catch { return null; } }
  return ctx;
}

function schedule(c, kind) {
  const t0 = c.currentTime + 0.02;
  const master = c.createGain();
  master.gain.value = 0.16;
  master.connect(c.destination);
  for (const [freq, at, len] of NOTES[kind] || NOTES.info) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = kind === 'alert' ? 'triangle' : 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0 + at);
    g.gain.exponentialRampToValueAtTime(1, t0 + at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
    osc.connect(g); g.connect(master);
    osc.start(t0 + at);
    osc.stop(t0 + at + len + 0.05);
  }
}

function disarm() {
  if (!armed) return;
  for (const [type, fn] of armed) window.removeEventListener(type, fn, true);
  armed = null;
}
function armOnGesture(kind) {
  disarm();
  const fire = () => { disarm(); play(kind, { retry: false }); };
  armed = ['pointerdown', 'keydown', 'touchstart'].map((type) => { window.addEventListener(type, fire, true); return [type, fire]; });
}

/** Plays a sound: 'celebrate' | 'alert' | 'info' | 'reward'. Returns true when it started now, false when it is waiting for a tap or is unavailable. */
export function play(kind, { retry = true } = {}) {
  const c = context();
  if (!c) return false;
  try {
    if (c.state === 'running') { schedule(c, kind); return true; }
    c.resume().then(() => {
      if (c.state === 'running') schedule(c, kind);
      else if (retry) armOnGesture(kind);
    }).catch(() => { if (retry) armOnGesture(kind); });
  } catch { /* no sound */ }
  return false;
}
export const stopWaiting = disarm;
