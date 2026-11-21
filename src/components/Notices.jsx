import { useEffect, useState } from 'react';
import { Info, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audio } from '../features/audio/audioService.js';
import { useAudioState } from '../features/audio/useAudio.js';
import { Button } from './ui.jsx';

/** Shows every audio error in the interface language: the speaker button never fails silently. */
export function AudioNotice() {
  const { t } = useTranslation();
  const st = useAudioState();
  const [fallbackShown, setFallbackShown] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (st.error) setNotice({ tone: 'error', text: t(`audio.errors.${st.error}`, { lang: t(`audio.voiceLang.${st.lang || 'ar'}`) }) });
  }, [st.error, st.errorId, st.lang, t]);
  useEffect(() => {
    if (st.fallback && !fallbackShown && !st.error) {
      setFallbackShown(true);
      setNotice({ tone: 'info', text: t('audio.fallbackUsed') });
    }
  }, [st.fallback, st.status, fallbackShown, t]);
  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(null), notice.tone === 'error' ? 9000 : 5000);
    return () => clearTimeout(id);
  }, [notice]);

  if (!notice) return null;
  const Icon = notice.tone === 'error' ? AlertTriangle : Info;
  return (
    <div className={`toast toast-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      <Icon size={20} aria-hidden="true" />
      <p>{notice.text}</p>
      <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={() => { setNotice(null); audio.clearError(); }}>
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

export function UpdateBanner({ pwa }) {
  const { t } = useTranslation();
  if (!pwa.needRefresh && !pwa.offlineReady) return null;
  if (pwa.needRefresh) {
    return (
      <div className="toast toast-update" role="alertdialog" aria-labelledby="upd-title">
        <RefreshCw size={20} aria-hidden="true" />
        <div>
          <strong id="upd-title">{t('pwa.updateTitle')}</strong>
          <p>{t('pwa.updateText')}</p>
          <div className="toast-actions">
            <Button size="sm" onClick={pwa.reload}>{t('pwa.reload')}</Button>
            <Button size="sm" variant="ghost" onClick={pwa.dismissUpdate}>{t('pwa.later')}</Button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="toast toast-info" role="status">
      <Info size={20} aria-hidden="true" />
      <p>{t('pwa.offlineReady')}</p>
      <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={pwa.dismissOffline}><X size={18} aria-hidden="true" /></button>
    </div>
  );
}

export function OfflineBar() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return <div className="offline-bar" role="status">{t('app.offlineBanner')}</div>;
}
