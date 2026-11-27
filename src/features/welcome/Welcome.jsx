import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './register.js';
import { Logo, Button } from '../../components/ui.jsx';
import { LangSwitcher } from '../../app/Layout.jsx';
import { orderedTracks } from '../../data/trackOrder.js';
import { useAvailability } from '../../data/availability.js';
import { TRACK_META, trackHtmlLang, isBeta, trackOfItem, lessonMeta } from '../../data/content.js';
import { useProgress } from '../../app/ProgressContext.jsx';
import { sync } from '../sync/index.js';
import { useSync } from '../sync/useSync.js';
import SyncDialogs from '../sync/SyncDialogs.jsx';
import { MAX_NAME } from '../sync/profile.js';
import { TERMS_VERSION, LEVEL_CHOICES, GOALS } from './plan.js';
import './welcome.css';

/** Languages the person has already worked on, to pre-select them for someone who used the app before this screen existed. */
const startedTracks = (state) => [...new Set([state.settings.lastTrack, ...Object.keys(state.completed).map((id) => lessonMeta(id)?.track), ...Object.keys(state.saved).map(trackOfItem)])].filter(Boolean);

/** Shown after sign-in until the person has confirmed their age, accepted the terms and chosen what to learn. `editing` = change the plan later. */
export default function Welcome({ editing = false }) {
  const { t, i18n } = useTranslation();
  useAvailability();
  const s = useSync();
  const { state, updateSettings } = useProgress();
  const available = orderedTracks(i18n.language);
  const old = s.profile?.learning;
  const [step, setStep] = useState(editing ? 1 : 0);
  const [name, setName] = useState('');
  const [adult, setAdult] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [tracks, setTracks] = useState(() => (old?.tracks || startedTracks(state)).filter((k) => available.includes(k)));
  const [levels, setLevels] = useState(old?.levels || {});
  const [goal, setGoal] = useState(state.settings.goal || 50);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, [step]);

  const first = editing ? 1 : 0;
  const total = 4 - first;
  const toggle = (k) => setTracks((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const canNext = [adult && accepted, tracks.length > 0, true, true][step];

  const finish = async () => {
    setBusy(true);
    setFailed(false);
    const plan = { terms: TERMS_VERSION, adult13: true, tracks, levels: Object.fromEntries(tracks.map((k) => [k, levels[k] || 'beginner'])) };
    const ok = await sync.saveLearning(plan, name);
    setBusy(false);
    if (!ok) return setFailed(true);
    updateSettings({ onboarded: true, goal, lastTrack: tracks[0] });
    sync.set({ editPlan: false });
  };

  return (
    <main className="gate welcome" id="main" data-testid="welcome">
      <div className="gate-lang"><LangSwitcher /></div>
      <section className="card gate-card welcome-card" aria-labelledby="wl-title">
        <Logo size={48} />
        <p className="note-small">{t('welcome.step', { n: step - first + 1, total })}</p>
        <h1 id="wl-title" tabIndex={-1} ref={heading}>{t(`welcome.${['termsTitle', 'langTitle', 'levelTitle', 'goalTitle'][step]}`)}</h1>

        {step === 0 && (
          <div className="stack-sm">
            {!s.profile?.name && (
              <label className="field"><span>{t('welcome.name')}</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} autoComplete="given-name" data-testid="wl-name" /></label>
            )}
            <label className="check-row"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} data-testid="wl-age" /><span>{t('welcome.age')}</span></label>
            <label className="check-row"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} data-testid="wl-terms" /><span>{t('welcome.accept')}</span></label>
            <p className="welcome-links"><a href="/terms.html" target="_blank" rel="noopener">{t('welcome.terms')}</a><a href="/privacy.html" target="_blank" rel="noopener">{t('welcome.privacy')}</a></p>
            <p className="note-small">{t('welcome.underAge')}</p>
          </div>
        )}

        {step === 1 && (
          <fieldset className="choice-group">
            <legend className="note-small">{t('welcome.langHint')}</legend>
            <div className="welcome-langs">
              {available.map((k) => (
                <label key={k} className={tracks.includes(k) ? 'on' : ''} style={{ '--tile': TRACK_META[k].color }}>
                  <input type="checkbox" checked={tracks.includes(k)} onChange={() => toggle(k)} data-testid={`wl-track-${k}`} />
                  <span className="track-glyph" aria-hidden="true" lang={trackHtmlLang(k)}>{TRACK_META[k].glyph}</span>
                  <span>{t(`tracks.${k}.short`)}{isBeta(k) && <span className="beta-chip">{t('tracks.betaChip')}</span>}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <div className="stack-sm">
            <p className="note-small">{t('welcome.levelHint')}</p>
            {tracks.map((k) => (
              <fieldset key={k} className="choice-group">
                <legend>{t(`tracks.${k}.name`)}</legend>
                <div className="welcome-levels">
                  {LEVEL_CHOICES.map((l) => (
                    <label key={l} className={(levels[k] || 'beginner') === l ? 'on' : ''}>
                      <input type="radio" name={`wl-level-${k}`} checked={(levels[k] || 'beginner') === l} onChange={() => setLevels((cur) => ({ ...cur, [k]: l }))} data-testid={`wl-level-${k}-${l}`} />
                      <strong>{t(`welcome.${l}`)}</strong>
                      <small>{t(`welcome.${l}Hint`)}</small>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        {step === 3 && (
          <fieldset className="choice-group">
            <legend className="sr-only">{t('welcome.goalTitle')}</legend>
            <div className="seg seg-wrap">
              {GOALS.map((g, i) => (
                <label key={g} className={goal === g ? 'on' : ''}>
                  <input type="radio" name="wl-goal" checked={goal === g} onChange={() => setGoal(g)} />
                  <span>{t(`onboarding.${['goalCasual', 'goalRegular', 'goalSerious'][i]}`)} · {t('settings.goalXp', { xp: g })}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {failed && <p className="err-text" role="alert" data-testid="wl-error">{t('welcome.failed')}</p>}
        <div className="btn-row">
          {step > first && <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={busy}>{t('welcome.back')}</Button>}
          {step < 3
            ? <Button onClick={() => setStep(step + 1)} disabled={!canNext} data-testid="wl-next">{t('welcome.next')}</Button>
            : <Button onClick={finish} disabled={busy} data-testid="wl-finish">{t(editing ? 'welcome.save' : 'welcome.finish')}</Button>}
          {editing
            ? <Button variant="ghost" onClick={() => sync.set({ editPlan: false })}>{t('welcome.cancel')}</Button>
            : <Button variant="ghost" onClick={() => sync.signOutAndClear({ force: false }).then((r) => { if (!r.ok) sync.signOut(); })} data-testid="wl-signout">{t('welcome.signOut')}</Button>}
        </div>
      </section>
      <SyncDialogs />
    </main>
  );
}
