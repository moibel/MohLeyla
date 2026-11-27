import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload, Trash2, Smartphone } from 'lucide-react';
import { PageHeading, Button } from '../components/ui.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import AccountSection from '../features/sync/AccountSection.jsx';
import PlanSection from '../features/welcome/PlanSection.jsx';
import PushCard from '../features/push/PushCard.jsx';
import { sync } from '../features/sync/index.js';
import { LANG_META, UI_LANGS } from '../i18n/index.js';
import { useProgress } from '../app/ProgressContext.jsx';
import { exportBackup, parseBackup, GOALS } from '../features/progress/engine.js';

function Radios({ legend, name, value, options, onChange }) {
  return (
    <fieldset className="choice-group">
      <legend>{legend}</legend>
      <div className="seg seg-wrap">
        {options.map(([v, label, lang]) => (
          <label key={v} className={value === v ? 'on' : ''}>
            <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} />
            <span lang={lang}>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function Settings({ pwa }) {
  const { t, i18n } = useTranslation();
  const { state, updateSettings, replaceState, resetAll, storageBlocked } = useProgress();
  const s = state.settings;
  const fileRef = useRef(null);
  const dlg = useRef(null);
  const [msg, setMsg] = useState(null);

  const doExport = () => {
    const blob = new Blob([exportBackup(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mohleyla-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg({ ok: true, text: t('settings.exported') });
  };
  const doImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const next = parseBackup(await file.text());
    if (!next) return setMsg({ ok: false, text: t('settings.importFailed') });
    replaceState(next);
    setMsg({ ok: true, text: t('settings.imported') });
  };

  return (
    <div className="page narrow">
      <PageHeading title={t('settings.title')} subtitle={t('settings.subtitle')} />
      {storageBlocked && <p className="notice-soft" role="alert">{t('errors.storageUnavailable')}</p>}
      <section className="card stack-sm">
        <Radios legend={t('settings.interfaceLanguage')} name="ui" value={i18n.language} onChange={(v) => i18n.changeLanguage(v)} options={UI_LANGS.map((l) => [l, LANG_META[l].label, l])} />
        <p className="muted small">{t('settings.interfaceLanguageHelp')}</p>
      </section>
      <section className="card stack-sm">
        <h2 className="h-sm">{t('settings.audioSection')}</h2>
        <Radios legend={t('settings.sfx')} name="sfx" value={s.sfx || 'on'} onChange={(v) => updateSettings({ sfx: v })}
          options={[['on', t('settings.sfxOn')], ['off', t('settings.sfxOff')]]} />
        <Radios legend={t('settings.speed')} name="speed" value={s.speed} onChange={(v) => updateSettings({ speed: v })}
          options={[['slow', t('settings.speedSlow')], ['normal', t('settings.speedNormal')], ['fast', t('settings.speedFast')]]} />
        <Radios legend={t('settings.audioSource')} name="source" value={s.source} onChange={(v) => updateSettings({ source: v })}
          options={[['auto', t('settings.sourceAuto')], ['recorded', t('settings.sourceRecorded')], ['device', t('settings.sourceDevice')]]} />
        <p className="muted small">{t('settings.audioHelp')}</p>
        <div className="test-audio">
          <SpeakButton text="مَرْحَبًا، كَيْفَ حَالُكَ؟" track="ar" variant="pill" label={t('settings.testAudio')} />
        </div>
        <p className="note-small">{t('audio.saNote')}</p>
      </section>
      <section className="card stack-sm">
        <Radios legend={t('settings.dailyGoal')} name="goal" value={s.goal} onChange={(v) => updateSettings({ goal: v })} options={GOALS.map((g) => [g, t('settings.goalXp', { xp: g })])} />
        <Radios legend={t('settings.appearance')} name="theme" value={s.theme} onChange={(v) => updateSettings({ theme: v })}
          options={[['system', t('settings.themeSystem')], ['light', t('settings.themeLight')], ['dark', t('settings.themeDark')]]} />
      </section>
      <AccountSection />
      <PlanSection />
      <PushCard />
      <section className="card stack-sm">
        <h2 className="h-sm">{t('settings.data')}</h2>
        <p className="muted small">{t('settings.dataHelp')}</p>
        <div className="btn-row">
          <Button variant="secondary" icon={<Download size={18} aria-hidden="true" />} onClick={doExport}>{t('settings.export')}</Button>
          <Button variant="secondary" icon={<Upload size={18} aria-hidden="true" />} onClick={() => fileRef.current?.click()}>{t('settings.import')}</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} aria-label={t('settings.import')} />
          <Button variant="danger" icon={<Trash2 size={18} aria-hidden="true" />} onClick={() => dlg.current?.showModal()}>{t('settings.reset')}</Button>
        </div>
        {msg && <p className={msg.ok ? 'ok-text' : 'err-text'} role="status">{msg.text}</p>}
      </section>
      <section className="card stack-sm">
        <h2 className="h-sm">{t('settings.app')}</h2>
        <p className="muted small">{t('settings.installHelp')}</p>
        {pwa?.canInstall ? <Button icon={<Smartphone size={18} aria-hidden="true" />} onClick={pwa.install}>{t('settings.install')}</Button> : <p className="muted small">{t('settings.installUnavailable')}</p>}
        <p className="muted small">{t('settings.offlineNote')}</p>
        <p className="muted small">{t('settings.version', { version: __APP_VERSION__ })}</p>
      </section>
      <dialog ref={dlg} className="dialog" aria-labelledby="reset-t">
        <h2 id="reset-t">{t('settings.resetConfirmTitle')}</h2>
        <p>{t('settings.resetConfirmText')}</p>
        <div className="btn-row">
          <Button variant="ghost" onClick={() => dlg.current?.close()}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={async () => { if (sync.getSnapshot().userId && !(await sync.deleteCloudData())) { dlg.current?.close(); return setMsg({ ok: false, text: t('account.errors.syncFailed') }); } resetAll(); dlg.current?.close(); setMsg({ ok: true, text: t('settings.resetDone') }); }}>{t('settings.reset')}</Button>
        </div>
      </dialog>
    </div>
  );
}
