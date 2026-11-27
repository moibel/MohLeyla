import i18next from 'i18next';
import strings from './strings.js';

for (const [lang, welcome] of Object.entries(strings)) i18next.addResourceBundle(lang, 'translation', { welcome }, true, true);
