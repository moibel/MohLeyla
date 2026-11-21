import { useTranslation } from 'react-i18next';
import { EmptyState, Button } from '../components/ui.jsx';

export default function NotFound() {
  const { t } = useTranslation();
  return <EmptyState icon="🧭" title={t('errors.notFoundTitle')} text={t('errors.notFoundText')} action={<Button to="/">{t('errors.goHome')}</Button>} />;
}
