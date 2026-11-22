import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/index.js';
import App from './app/App.jsx';
import ErrorBoundary from './app/ErrorBoundary.jsx';
import { refreshApp } from './utils/refreshApp.js';
import './styles/index.css';

// After a new version is deployed, an old cached copy may ask for a file that no longer exists. Heal it once automatically
// (drop the cached copy and reload); the guard stops a reload loop if the network itself is the problem.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  try {
    if (sessionStorage.getItem('mohleyla-healed')) return;
    sessionStorage.setItem('mohleyla-healed', '1');
  } catch { /* no sessionStorage: reload once anyway below is risky, so do nothing */ return; }
  refreshApp();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
