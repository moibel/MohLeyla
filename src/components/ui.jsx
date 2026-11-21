import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trackLang } from '../data/content.js';

/** Brand logo. `compact` shows only the mark. Always the same bundled asset: no external paths that can break. */
export function Logo({ compact = false, size = 40, onDark = false, className = '' }) {
  const src = onDark ? '/icons/logo-mark-on-dark-128.png' : '/icons/logo-mark-128.webp';
  return (
    <span className={`logo ${className}`}>
      <img src={src} width={size} height={size} alt="" decoding="async" />
      {!compact && <span className="logo-word">MohLeyla</span>}
    </span>
  );
}

/** Text in a given language, direction-isolated so Arabic and Latin text never reorder each other. */
export function Bidi({ lang, children, className = '', as: Tag = 'bdi', ...rest }) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  return (
    <Tag lang={lang} dir={dir} className={`${lang === 'ar' ? 'is-ar ' : ''}${className}`} {...rest}>
      {children}
    </Tag>
  );
}
/** Text in the language a track teaches. */
export const TargetText = ({ track, children, className = '', as = 'span' }) => (
  <Bidi lang={trackLang(track)} className={`target-text ${className}`} as={as}>{children}</Bidi>
);

export function Button({ variant = 'primary', size = 'md', icon, iconEnd, children, className = '', to, ...rest }) {
  const cls = `btn btn-${variant} btn-${size} ${className}`;
  const inner = (
    <>
      {icon}
      {children && <span>{children}</span>}
      {iconEnd}
    </>
  );
  if (to) return <Link to={to} className={cls} {...rest}>{inner}</Link>;
  return <button type="button" className={cls} {...rest}>{inner}</button>;
}

export function ProgressBar({ value, max = 100, label, tone = 'brand', className = '' }) {
  const { t } = useTranslation();
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`bar bar-${tone} ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={label || t('a11y.progressbar')}>
      <span style={{ inlineSize: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, size = 96, stroke = 10, label, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="ring" style={{ inlineSize: size, blockSize: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-fg" strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export const Chip = ({ tone = 'neutral', icon, children, className = '' }) => (
  <span className={`chip chip-${tone} ${className}`}>{icon}{children}</span>
);

export const EmptyState = ({ icon, title, text, action }) => (
  <div className="empty">
    <div className="empty-icon" aria-hidden="true">{icon}</div>
    <h2>{title}</h2>
    {text && <p>{text}</p>}
    {action}
  </div>
);

export function PageHeading({ title, subtitle, actions }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Wraps a directional arrow so it mirrors in RTL. */
export const Flip = ({ children }) => <span className="rtl-flip" aria-hidden="true">{children}</span>;

export function Spinner({ label }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
