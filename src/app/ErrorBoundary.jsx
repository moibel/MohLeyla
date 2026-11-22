import { Component } from 'react';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { Button } from '../components/ui.jsx';
import { refreshApp } from '../utils/refreshApp.js';

function CrashScreen({ onRetry }) {
  const { t } = useTranslation();
  return (
    <main className="gate" id="main" role="alert" data-testid="crash-screen">
      <section className="card gate-card">
        <TriangleAlert size={40} aria-hidden="true" className="accent" />
        <h1>{t('errors.crashTitle')}</h1>
        <p>{t('errors.crashText')}</p>
        <div className="btn-row">
          <Button onClick={onRetry} data-testid="crash-retry">{t('errors.crashRetry')}</Button>
          <Button variant="secondary" onClick={() => location.reload()} data-testid="crash-reload">{t('errors.crashReload')}</Button>
        </div>
        <p className="note-small">{t('errors.crashFixHint')}</p>
        <div className="btn-row"><Button variant="ghost" onClick={refreshApp} data-testid="crash-fix">{t('errors.crashFix')}</Button></div>
      </section>
    </main>
  );
}

/** A render error anywhere below shows a friendly, translated screen instead of a blank page. Progress is never touched. */
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('MohLeyla crashed:', error); }
  render() {
    if (this.state.failed) return <CrashScreen onRetry={() => this.setState({ failed: false })} />;
    return this.props.children;
  }
}
