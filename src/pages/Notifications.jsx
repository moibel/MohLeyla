import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, MessageCircle, Gift, Megaphone } from 'lucide-react';
import { PageHeading, Chip, EmptyState } from '../components/ui.jsx';
import RequireAccount from '../features/classes/RequireAccount.jsx';
import { useSync } from '../features/sync/useSync.js';
import { useRewards } from '../features/rewards/store.js';
import { useAnnouncements, pick } from '../features/announcements/store.js';
import { describe } from '../features/rewards/format.js';
import { lastOpened, markOpened } from '../features/notifications/store.js';
import { myChats } from '../features/classes/api.js';
import { callText } from '../features/calls/format.js';
import { LANG_META } from '../i18n/index.js';

function Inner() {
  const { t, i18n } = useTranslation();
  const { userId } = useSync();
  const rw = useRewards();
  const news = useAnnouncements();
  const [chats, setChats] = useState(null);
  const since = useRef(lastOpened(userId)); // items newer than this are "New" for the whole visit
  const fmt = (d) => new Intl.DateTimeFormat(LANG_META[i18n.language].locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));
  const isNew = (d) => new Date(d).getTime() > since.current;

  useEffect(() => { myChats().then(setChats).catch(() => setChats([])); }, []);
  useEffect(() => { const id = setTimeout(() => markOpened(userId), 1200); return () => clearTimeout(id); }, [userId]); // clears the bell after the person has seen the page

  const unreadChats = (chats || []).filter((c) => c.unread > 0);
  const nothing = chats && !unreadChats.length && !rw.list.length && !news.list.length;
  return (
    <div className="page narrow" data-testid="notifications-page">
      <PageHeading title={t('notifications.title')} subtitle={t('notifications.subtitle')} />
      {nothing && <EmptyState icon={<Bell size={44} />} title={t('notifications.emptyTitle')} text={t('notifications.emptyText')} />}
      {unreadChats.length > 0 && (
        <section className="card stack-sm" aria-labelledby="n-chat">
          <h2 id="n-chat" className="h-sm"><MessageCircle size={20} aria-hidden="true" /> {t('notifications.messages')}</h2>
          <ul className="notif-list">
            {unreadChats.map((c) => (
              <li key={c.conversation_id}><Link to={`/chat/${c.conversation_id}`} className="notif-item" data-testid="notif-chat">
                <span><strong><bdi>{c.other_name}</bdi></strong> <span className="muted">· {t('chat.unreadCount', { count: c.unread })}</span><br /><span className="muted small"><bdi>{c.last_kind === 'call' ? callText(t, c.last_body) : c.last_body}</bdi></span></span>
                <Chip tone="brand">{t('notifications.new')}</Chip>
              </Link></li>
            ))}
          </ul>
        </section>
      )}
      {rw.list.length > 0 && (
        <section className="card stack-sm" aria-labelledby="n-rw">
          <h2 id="n-rw" className="h-sm"><Gift size={20} aria-hidden="true" /> {t('notifications.rewards')}</h2>
          <ul className="notif-list">
            {rw.list.slice(0, 10).map((r) => (
              <li key={r.id} className="notif-item" data-testid="notif-reward">
                <span><bdi>{describe(t, r)}</bdi>{r.reason ? <span className="muted"> · <bdi>{r.reason}</bdi></span> : null}<br /><span className="muted small">{fmt(r.created_at)}</span></span>
                {isNew(r.created_at) && <Chip tone="brand">{t('notifications.new')}</Chip>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {news.list.length > 0 && (
        <section className="card stack-sm" aria-labelledby="n-news">
          <h2 id="n-news" className="h-sm"><Megaphone size={20} aria-hidden="true" /> {t('notifications.announcements')}</h2>
          <ul className="notif-list">
            {news.list.map((a) => (
              <li key={a.id} className="notif-item" data-testid="notif-news">
                <span><strong><bdi>{pick(a.title, i18n.language)}</bdi></strong><br /><span className="small"><bdi>{pick(a.body, i18n.language)}</bdi></span><br /><span className="muted small">{fmt(a.created_at)}</span></span>
                {isNew(a.created_at) && <Chip tone="brand">{t('notifications.new')}</Chip>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function Notifications() {
  const { t } = useTranslation();
  return <RequireAccount title={t('notifications.title')}><Inner /></RequireAccount>;
}
