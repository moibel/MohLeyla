import { useMemo } from 'react';
import { useSync } from '../sync/useSync.js';
import { useRewards } from '../rewards/store.js';
import { useAnnouncements } from '../announcements/store.js';
import { useChatUnread } from '../chat/unread.js';
import { lastOpened, useOpenedStamp } from './store.js';

/** Everything that is new for the person: unread chat messages, rewards and announcements that arrived since they last opened Notifications. */
export function useNotifications() {
  const { userId } = useSync();
  const rw = useRewards();
  const news = useAnnouncements();
  const chats = useChatUnread();
  const stamp = useOpenedStamp();
  return useMemo(() => {
    const since = lastOpened(userId);
    const isNew = (d) => new Date(d).getTime() > since;
    const newRewards = rw.list.filter((r) => isNew(r.created_at));
    const newNews = news.list.filter((a) => isNew(a.created_at));
    return { since, chats, newRewards, newNews, count: chats + newRewards.length + newNews.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, rw.list, news.list, chats, stamp]);
}
