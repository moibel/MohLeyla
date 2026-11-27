// Registers the texts of later-loaded screens. Every component that uses speaking.*, about.* or teach.* imports this file.
import i18next from 'i18next';
import ar from './ar/pages.js';
import en from './en/pages.js';
import id from './id/pages.js';

for (const [lang, res] of Object.entries({ ar, en, id })) i18next.addResourceBundle(lang, 'translation', res, true, true);
