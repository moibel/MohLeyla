import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Square, Play, RotateCcw, ThumbsUp, Repeat, Headphones } from 'lucide-react';
import { Button } from '../../components/ui.jsx';
import SpeakButton from '../../components/SpeakButton.jsx';
import { audio } from '../audio/audioService.js';
import { trackLang } from '../../data/content.js';
import { Recorder, MAX_RECORD_MS } from './recorder.js';
import { diagnoseMicBlock } from './diagnose.js';
import { refreshApp } from '../../utils/refreshApp.js';
import { useProgress } from '../../app/ProgressContext.jsx';
import { applySpeaking } from '../progress/engine.js';

/**
 * "Say it yourself": record -> compare with the model voice -> self-rate.
 * The recording stays in memory on this device only; leaving the screen discards it.
 */
export default function SpeakingPractice({ itemId, text, track }) {
  const { t } = useTranslation();
  const { commit } = useProgress();
  const recorderRef = useRef(null);
  const clipRef = useRef(null);
  const playerRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | recording | review
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState(null);
  const [error, setError] = useState(null);
  const [errorDetail, setErrorDetail] = useState(null);
  const [rated, setRated] = useState(null);
  const [playing, setPlaying] = useState(false);
  const lang = trackLang(track);

  if (!recorderRef.current) recorderRef.current = new Recorder();
  const supported = recorderRef.current.supported;

  const dropClip = useCallback(() => {
    if (clipRef.current) URL.revokeObjectURL(clipRef.current.url);
    clipRef.current = null;
    setClip(null);
  }, []);

  // New word / leaving the screen: stop the mic, discard the clip.
  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
      if (clipRef.current) URL.revokeObjectURL(clipRef.current.url);
      playerRef.current?.pause();
    };
  }, []);
  useEffect(() => {
    recorderRef.current.cancel();
    dropClip();
    setPhase('idle'); setError(null); setRated(null); setSeconds(0);
  }, [itemId, text, dropClip]);

  useEffect(() => {
    if (phase !== 'recording') return undefined;
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(id);
  }, [phase]);

  const finish = useCallback(async () => {
    try {
      const result = await recorderRef.current.stop();
      clipRef.current = result;
      setClip(result);
      setPhase('review');
    } catch (e) {
      setError(e.code || 'failed');
      setPhase('idle');
    }
  }, []);

  const start = async () => {
    setError(null); setRated(null);
    audio.stop(); // never record the model voice through the speakers
    dropClip();
    setErrorDetail(null);
    try {
      recorderRef.current.onAutoStop = finish;
      await recorderRef.current.start();
      setSeconds(0);
      setPhase('recording');
    } catch (e) {
      const code = e.code || 'failed';
      setError(code);
      if (code === 'denied') setErrorDetail(await diagnoseMicBlock());
      setPhase('idle');
    }
  };

  const playMine = () =>
    new Promise((resolve) => {
      if (!clipRef.current) return resolve();
      const el = playerRef.current || (playerRef.current = new Audio());
      el.pause();
      el.src = clipRef.current.url;
      setPlaying(true);
      const done = () => { setPlaying(false); el.onended = el.onerror = null; resolve(); };
      el.onended = done;
      el.onerror = done;
      el.play().catch(done);
    });

  const playBoth = async () => {
    await audio.play({ text, lang, track });
    await playMine();
  };

  const rate = (close) => {
    commit((s) => applySpeaking(s, itemId, close));
    setRated(close ? 'close' : 'more');
  };

  if (!supported) {
    return <p className="note-small" data-testid="speak-unsupported">{t('speaking.errors.unsupported')}</p>;
  }

  return (
    <section className="speaking" aria-label={t('speaking.title')} data-testid="speaking">
      <h3 className="h-xs"><Mic size={18} aria-hidden="true" /> {t('speaking.title')}</h3>
      <p className="note-small">{t('speaking.hint')}</p>

      {phase === 'idle' && (
        <Button variant="secondary" icon={<Mic size={18} aria-hidden="true" />} onClick={start} data-testid="rec-start">{t('speaking.record')}</Button>
      )}

      {phase === 'recording' && (
        <div className="rec-live" role="status">
          <span className="rec-dot" aria-hidden="true" />
          <span>{t('speaking.recording', { seconds, max: MAX_RECORD_MS / 1000 })}</span>
          <Button variant="primary" size="sm" icon={<Square size={16} aria-hidden="true" />} onClick={finish} data-testid="rec-stop">{t('speaking.stop')}</Button>
        </div>
      )}

      {phase === 'review' && clip && (
        <div className="rec-review" data-testid="rec-review">
          <div className="btn-row">
            <SpeakButton text={text} track={track} variant="pill" label={t('speaking.playModel')} />
            <Button variant="secondary" size="sm" icon={<Play size={16} aria-hidden="true" />} onClick={playMine} disabled={playing} data-testid="rec-play">{t('speaking.playMine')}</Button>
            <Button variant="ghost" size="sm" icon={<Headphones size={16} aria-hidden="true" />} onClick={playBoth} disabled={playing}>{t('speaking.playBoth')}</Button>
          </div>
          {rated === null ? (
            <fieldset className="choice-group">
              <legend>{t('speaking.rateQ')}</legend>
              <div className="btn-row">
                <Button size="sm" icon={<ThumbsUp size={16} aria-hidden="true" />} onClick={() => rate(true)} data-testid="rate-close">{t('speaking.close')}</Button>
                <Button size="sm" variant="secondary" icon={<Repeat size={16} aria-hidden="true" />} onClick={() => rate(false)} data-testid="rate-more">{t('speaking.more')}</Button>
              </div>
            </fieldset>
          ) : (
            <p className="ok-text" role="status" data-testid="rated">{t(rated === 'close' ? 'speaking.thanksClose' : 'speaking.thanksMore')}</p>
          )}
          <Button variant="ghost" size="sm" icon={<RotateCcw size={16} aria-hidden="true" />} onClick={start} data-testid="rec-again">{t('speaking.again')}</Button>
        </div>
      )}

      {phase === 'idle' && !error && <p className="note-small" data-testid="mic-hint">{t('speaking.permissionHint')}</p>}
      {error && (
        <div className="stack-sm" role="alert" data-testid="rec-error" data-detail={errorDetail || ''}>
          <p className="err-text">{t(error === 'denied' && ['policy', 'blocked', 'dismissed'].includes(errorDetail) ? `speaking.errors.${errorDetail}` : `speaking.errors.${error}`)}</p>
          {error === 'denied' && errorDetail === 'policy' && <Button size="sm" onClick={refreshApp} data-testid="fix-reload">{t('speaking.fixReload')}</Button>}
        </div>
      )}
      <p className="note-small">{t('speaking.privacy')}</p>
    </section>
  );
}
