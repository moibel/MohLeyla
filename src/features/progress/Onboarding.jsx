import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo, Button } from '../../components/ui.jsx';
import { LANG_META, UI_LANGS } from '../../i18n/index.js';
import { orderedTracks, defaultTrack } from '../../data/trackOrder.js';
import { useAvailability } from '../../data/availability.js';
import { useProgress } from '../../app/ProgressContext.jsx';

/** First-run dialog. Existing learners (any progress) are never interrupted. */
export default function Onboarding() {
  const { t, i18n } = useTranslation();
  useAvailability();
  const { state, updateSettings } = useProgress();
  const ref = useRef(null);
  const hasProgress = state.xp > 0 || Object.keys(state.completed).length > 0 || Object.keys(state.saved).length > 0;
  const needed = !state.settings.onboarded && !hasProgress;
  const [goal, setGoal] = useState(50);
  const [pickedTrack, setPickedTrack] = useState(null); // until the learner chooses, the suggested path follows the interface language
  const track = pickedTrack || defaultTrack(i18n.language);
  const setTrack = setPickedTrack;

  useEffect(() => {
    if (!state.settings.onboarded && hasProgress) updateSettings({ onboarded: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProgress]);
  useEffect(() => {
    const d = ref.current;
    if (needed && d && !d.open) d.showModal();
  }, [needed]);
  if (!needed) return null;

  const goals = [[30, 'goalCasual'], [50, 'goalRegular'], [100, 'goalSerious']];
  return (
    <dialog ref={ref} className="dialog onboarding" aria-labelledby="ob-title" onCancel={(e) => e.preventDefault()} data-testid="onboarding">
      <Logo size={56} />
      <h2 id="ob-title">{t('onboarding.title')}</h2>
      <p className="muted">{t('onboarding.subtitle')}</p>
      <fieldset className="choice-group">
        <legend>{t('onboarding.languageQ')}</legend>
        <div className="seg">
          {UI_LANGS.map((l) => (
            <label key={l} className={i18n.language === l ? 'on' : ''}>
              <input type="radio" name="ob-lang" checked={i18n.language === l} onChange={() => i18n.changeLanguage(l)} />
              <span lang={l}>{LANG_META[l].label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="choice-group">
        <legend>{t('onboarding.goalQ')}</legend>
        <div className="seg">
          {goals.map(([g, k]) => (
            <label key={g} className={goal === g ? 'on' : ''}>
              <input type="radio" name="ob-goal" checked={goal === g} onChange={() => setGoal(g)} />
              <span>{t(`onboarding.${k}`)} · {t('settings.goalXp', { xp: g })}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="choice-group">
        <legend>{t('onboarding.trackQ')}</legend>
        <div className="seg seg-wrap">
          {orderedTracks(i18n.language).map((k) => (
            <label key={k} className={track === k ? 'on' : ''}>
              <input type="radio" name="ob-track" checked={track === k} onChange={() => setTrack(k)} />
              <span>{t(`tracks.${k}.short`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button size="lg" onClick={() => { updateSettings({ onboarded: true, goal, lastTrack: track }); ref.current?.close(); }}>{t('onboarding.go')}</Button>
    </dialog>
  );
}
