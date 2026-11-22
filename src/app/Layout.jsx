import { useEffect, useRef } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, GraduationCap, Brain, Bookmark, BarChart3, Settings as Cog, Flame, Star } from 'lucide-react';
import { Logo } from '../components/ui.jsx';
import { LANG_META, UI_LANGS } from '../i18n/index.js';
import { useDerived } from '../features/progress/selectors.js';
import { useProgress } from './ProgressContext.jsx';
import { AudioNotice, OfflineBar, UpdateBanner } from '../components/Notices.jsx';
import Onboarding from '../features/progress/Onboarding.jsx';
import SyncDialogs from '../features/sync/SyncDialogs.jsx';
import NamePrompt from '../features/sync/NamePrompt.jsx';
import Avatar from '../components/Avatar.jsx';
import { useSync } from '../features/sync/useSync.js';
import { displayName } from '../features/sync/profile.js';

const NAV = [
  { to: '/', key: 'home', Icon: Home, end: true },
  { to: '/learn', key: 'learn', Icon: GraduationCap },
  { to: '/review', key: 'review', Icon: Brain, badge: true },
  { to: '/words', key: 'vocabulary', Icon: Bookmark },
  { to: '/progress', key: 'progress', Icon: BarChart3 },
];

export function LangSwitcher() {
  const { t, i18n } = useTranslation();
  return (
    <label className="lang-switch">
      <span className="sr-only">{t('a11y.langSwitcher')}</span>
      <select value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)} aria-label={t('a11y.langSwitcher')} data-testid="lang-switch">
        {UI_LANGS.map((l) => (
          <option key={l} value={l} lang={l}>{LANG_META[l].label}</option>
        ))}
      </select>
    </label>
  );
}

function NavItems({ variant }) {
  const { t } = useTranslation();
  const { dueCount } = useDerived();
  return NAV.map(({ to, key, Icon, end, badge }) => (
    <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item nav-${variant} ${isActive ? 'active' : ''}`}>
      <span className="nav-icon">
        <Icon size={variant === 'side' ? 20 : 22} aria-hidden="true" />
        {badge && dueCount > 0 && <span className="nav-badge" aria-hidden="true">{dueCount > 9 ? '9+' : dueCount}</span>}
      </span>
      <span>{t(`nav.${key}`)}</span>
    </NavLink>
  ));
}

export default function Layout({ pwa }) {
  const { t } = useTranslation();
  const { state } = useProgress();
  const { streak, todayXp } = useDerived();
  const sy = useSync();
  const loc = useLocation();
  const main = useRef(null);
  const first = useRef(true);
  useEffect(() => {
    // Move focus to <main> after in-app navigation (not on first load, so the skip link stays first in tab order).
    if (first.current) { first.current = false; return; }
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [loc.pathname]);

  return (
    <div className="shell">
      <a href="#main" className="skip-link">{t('app.skip')}</a>
      <aside className="sidebar" aria-label={t('nav.main')}>
        <Link to="/" className="sidebar-brand" aria-label={t('nav.backHome')}><Logo size={44} /></Link>
        <nav className="side-nav" aria-label={t('nav.main')}><NavItems variant="side" /></nav>
        <div className="side-card">
          <Logo compact size={36} />
          <strong>{t('app.tagline')}</strong>
        </div>
      </aside>
      <div className="main-col">
        <header className="topbar">
          <Link to="/" className="topbar-brand" aria-label={t('nav.backHome')}><Logo compact size={36} /></Link>
          <div className="topbar-spacer" />
          <div className="topbar-stats">
            <span className="stat-pill" title={t('home.streak')}><Flame size={16} aria-hidden="true" /><b>{streak}</b><span className="sr-only">{t('home.streak')}</span></span>
            <span className="stat-pill stat-xp"><Star size={16} aria-hidden="true" /><b>{state.xp}</b><span className="pill-label" aria-hidden="true">{t('common.xp')}</span><span className="sr-only">{t('common.xp')}</span></span>
          </div>
          <LangSwitcher />
          {sy.profile && (
            <NavLink to="/profile" className="avatar-link" aria-label={`${t('nav.profile')}: ${displayName(sy.profile)}`} data-testid="avatar-link"><Avatar profile={sy.profile} size={36} /></NavLink>
          )}
          <NavLink to="/settings" className="icon-btn" aria-label={t('nav.settings')}><Cog size={22} aria-hidden="true" /></NavLink>
        </header>
        <OfflineBar />
        <main id="main" ref={main} tabIndex={-1} className="content" data-today-xp={todayXp}>
          <Outlet />
        </main>
        <footer className="footer">{t('app.footer')}</footer>
      </div>
      <nav className="bottom-nav" aria-label={t('nav.main')}><NavItems variant="bottom" /></nav>
      <AudioNotice />
      <UpdateBanner pwa={pwa} />
      <Onboarding />
      <SyncDialogs />
      <NamePrompt />
    </div>
  );
}
