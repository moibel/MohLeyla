import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnnouncements, dismiss, markPopped, pick } from './store.js';
import { useProgress } from '../../app/ProgressContext.jsx';
import AnnouncementDialog from './AnnouncementDialog.jsx';

/** True while no other dialog (welcome, name question, sync choice, …) is open, so pop-ups never stack on top of each other. */
function useQuietMoment(active) {
  const [quiet, setQuiet] = useState(false);
  useEffect(() => {
    if (!active) { setQuiet(false); return undefined; }
    const check = () => setQuiet(!document.querySelector('dialog[open]:not(.announce)'));
    check();
    const id = setInterval(check, 400);
    return () => clearInterval(id);
  }, [active]);
  return quiet;
}

/** Opens the next pending special announcement (personal, celebration or important) as a pop-up, once. */
export default function AnnouncementPopup() {
  const { i18n } = useTranslation();
  const { queue } = useAnnouncements();
  const { state, updateSettings } = useProgress();
  const current = queue[0];
  const quiet = useQuietMoment(!!current);
  if (!current || !quiet) return null;
  const close = () => { markPopped(current.id); dismiss(current.id); };
  return (
    <AnnouncementDialog
      key={current.id}
      item={current}
      title={pick(current.title, i18n.language)}
      body={pick(current.body, i18n.language)}
      soundOn={state.settings.sfx !== 'off'}
      onSoundOff={() => updateSettings({ sfx: 'off' })}
      onClose={close}
    />
  );
}
