import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar/ui.js';
import en from './en/ui.js';
import id from './id/ui.js';

export const UI_LANGS = ['ar', 'en', 'id'];
export const LANG_META = {
  ar: { label: 'العربية', dir: 'rtl', locale: 'ar-SA-u-nu-latn' },
  en: { label: 'English', dir: 'ltr', locale: 'en-US' },
  id: { label: 'Bahasa Indonesia', dir: 'ltr', locale: 'id-ID' },
};
export const LEGACY_LANG_KEY = 'mohleyla-ui-lang';

export function detectLang() {
  try {
    const saved = localStorage.getItem(LEGACY_LANG_KEY);
    if (UI_LANGS.includes(saved)) return saved;
  } catch { /* storage blocked */ }
  const nav = (typeof navigator !== 'undefined' && (navigator.language || '')).slice(0, 2).toLowerCase();
  return UI_LANGS.includes(nav) ? nav : 'en';
}

export function applyDocumentLang(lang) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.lang = lang;
  el.dir = LANG_META[lang].dir;
  const title = { ar: 'MohLeyla — تعلّم اللغات', en: 'MohLeyla — Learn languages', id: 'MohLeyla — Belajar bahasa' }[lang];
  document.title = title;
}

i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en }, id: { translation: id } },
  lng: detectLang(),
  fallbackLng: false, // never hide a missing translation behind another language
  supportedLngs: UI_LANGS,
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
});
applyDocumentLang(i18n.language);
i18n.on('languageChanged', (l) => {
  applyDocumentLang(l);
  try { localStorage.setItem(LEGACY_LANG_KEY, l); } catch { /* ignore */ }
});

export default i18n;
