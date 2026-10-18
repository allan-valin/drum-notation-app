import { STRINGS, LANGS, format, pickLang } from './strings.js';

/**
 * Language and theme, reactive. `t()` reads `prefs.lang`, so any template that calls it
 * re-renders when the language changes. Persisted in the store's settings document.
 */
export const prefs = $state({ lang: 'pt', theme: null });
let store = null;

const lookup = (table, key) => key.split('.').reduce((o, p) => (o == null ? o : o[p]), table);

export function t(key, params) {
  const s = lookup(STRINGS[prefs.lang], key) ?? lookup(STRINGS.pt, key) ?? key;
  return format(s, params);
}

export function initPrefs(s) {
  store = s;
  const settings = store.loadSettings();
  prefs.lang = LANGS.includes(settings.lang) ? settings.lang : pickLang(globalThis.navigator?.language);
  prefs.theme = settings.theme === 'light' || settings.theme === 'dark' ? settings.theme : null;
  applyTheme();
}

export function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  prefs.lang = lang;
  save({ lang });
}

/** The theme in effect: the stored choice, else the system's. */
export function effectiveTheme() {
  if (prefs.theme) return prefs.theme;
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function toggleTheme() {
  prefs.theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
  applyTheme();
  save({ theme: prefs.theme });
  return prefs.theme;
}

function applyTheme() {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (prefs.theme) root.dataset.theme = prefs.theme;
  else delete root.dataset.theme;
  root.lang = { pt: 'pt-BR', en: 'en', de: 'de' }[prefs.lang];
}

function save(patch) {
  if (!store) return;
  store.saveSettings({ ...store.loadSettings(), ...patch });
  applyTheme();
}
