import '../../i18n/pages.js';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui.jsx';
import { adminListBlockedWords, adminAddBlockedWord, adminRemoveBlockedWord } from '../classes/api.js';

/** Admin: the chat word filter's list (015_chat_word_filter.sql). Closed by default, because it is a list of offensive words. */
export default function AdminWords() {
  const { t } = useTranslation();
  const [words, setWords] = useState(null);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState(null);
  const load = useCallback(async () => {
    try { setWords(await adminListBlockedWords()); } catch { setWords([]); setMsg({ ok: false, text: t('safety.admin.failed') }); }
  }, [t]);
  const act = async (fn) => {
    setMsg(null);
    try { await fn(); await load(); setMsg({ ok: true, text: t('safety.admin.done') }); }
    catch (e) { setMsg({ ok: false, text: t(e.code === 'invalidInput' ? 'safety.words.invalid' : 'safety.admin.failed') }); }
  };
  const add = (e) => { e.preventDefault(); act(async () => { await adminAddBlockedWord(text); setText(''); }); };

  return (
    <section className="card stack-sm" aria-labelledby="bw-h" data-testid="admin-words">
      <h2 id="bw-h" className="h-md">{t('safety.words.title')}</h2>
      <p className="muted">{t('safety.words.text')}</p>
      <form className="stack-sm" onSubmit={add}>
        <label className="field"><span>{t('safety.words.label')}</span>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={60} dir="auto" data-testid="word-input" /></label>
        <div className="btn-row"><Button type="submit" disabled={text.trim().length < 2} data-testid="word-add">{t('safety.words.add')}</Button></div>
      </form>
      {msg && <p className={msg.ok ? 'ok-text' : 'err-text'} role={msg.ok ? 'status' : 'alert'} data-testid="words-msg">{msg.text}</p>}
      <details onToggle={(e) => { if (e.target.open && words === null) load(); }}>
        <summary data-testid="words-show">{t('safety.words.show')}</summary>
        {words === null && <p className="muted">{t('app.loading')}</p>}
        {words && words.length === 0 && <p className="muted">{t('safety.words.empty')}</p>}
        {words && words.length > 0 && (
          <ul className="word-list">
            {words.map((w) => (
              <li key={w.id} data-testid="word-row"><bdi>{w.term}</bdi>
                <Button variant="ghost" size="sm" aria-label={`${t('safety.words.remove')}: ${w.term}`} onClick={() => act(() => adminRemoveBlockedWord(w.id))}>{t('safety.words.remove')}</Button></li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
