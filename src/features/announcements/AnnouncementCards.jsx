import { useTranslation } from 'react-i18next';
import { Megaphone, X } from 'lucide-react';
import { useAnnouncements, dismiss, pick } from './store.js';
import { LANG_META } from '../../i18n/index.js';

/** Announcements from the admin. `compact` (home page): the two newest not yet closed, each with a close button. Otherwise all of them. */
export default function AnnouncementCards({ compact = false }) {
  const { t, i18n } = useTranslation();
  const { list, visible } = useAnnouncements();
  const rows = compact ? visible.slice(0, 2) : list;
  if (!rows.length) return null;
  const fmt = (d) => new Intl.DateTimeFormat(LANG_META[i18n.language].locale, { dateStyle: 'medium' }).format(new Date(d));
  return (
    <section className="news" aria-label={t('news.title')} data-testid="news">
      {rows.map((a) => (
        <article key={a.id} className="card news-card" data-testid="news-card">
          <span className="news-ico" aria-hidden="true"><Megaphone size={20} /></span>
          <div className="news-text">
            <h2 className="h-sm"><bdi>{pick(a.title, i18n.language)}</bdi></h2>
            <p className="news-body"><bdi>{pick(a.body, i18n.language)}</bdi></p>
            <p className="muted small">{a.class_name ? <>{t('news.forClass', { name: a.class_name })} · </> : null}{fmt(a.created_at)}</p>
          </div>
          {compact && <button type="button" className="icon-btn" onClick={() => dismiss(a.id)} aria-label={`${t('news.dismiss')}: ${pick(a.title, i18n.language)}`} data-testid="news-dismiss"><X size={18} aria-hidden="true" /></button>}
        </article>
      ))}
    </section>
  );
}
