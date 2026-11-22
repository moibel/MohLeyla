import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui.jsx';
import { sync } from './index.js';
import { useSync } from './useSync.js';

/** The "this device already has progress" question. Mounted app-wide so it appears wherever sign-in completes. */
export default function SyncDialogs() {
  const { t } = useTranslation();
  const s = useSync();
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (s.pendingChoice && d && !d.open) d.showModal();
    if (!s.pendingChoice && d?.open) d.close();
  }, [s.pendingChoice]);
  if (!s.configured) return null;
  return (
    <dialog ref={ref} className="dialog" aria-labelledby="choice-t" onCancel={(e) => e.preventDefault()} data-testid="acc-choice">
      <h2 id="choice-t">{t('account.choiceTitle')}</h2>
      <p>{t('account.choiceText')}</p>
      <p className="note-small">{t('account.choiceTip')}</p>
      <div className="stack-sm">
        <Button onClick={() => sync.resolveChoice('merge')} data-testid="choice-merge">{t('account.choiceMerge')}</Button>
        <Button variant="secondary" onClick={() => sync.resolveChoice('replace')} data-testid="choice-replace">{t('account.choiceReplace')}</Button>
        <Button variant="ghost" onClick={() => sync.resolveChoice('cancel')} data-testid="choice-cancel">{t('account.choiceCancel')}</Button>
      </div>
    </dialog>
  );
}
