import { useTranslation } from 'react-i18next';

/** Links to the public privacy policy and terms (static pages, readable without signing in; ar/en/id on the same page). */
export default function LegalLinks({ className = '' }) {
  const { t } = useTranslation();
  return (
    <p className={`legal-links ${className}`.trim()} data-testid="legal-links">
      <a href="/privacy.html">{t('app.privacy')}</a>
      <span aria-hidden="true"> · </span>
      <a href="/terms.html">{t('app.terms')}</a>
    </p>
  );
}
