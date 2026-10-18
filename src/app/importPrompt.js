const BASE = 'https://github.com/allan-valin/drum-notation-app/blob/main/docs/';

/** The photo-import prompt in the reader's language. */
export function importPromptUrl(lang) {
  return BASE + (lang === 'en' ? 'SCORE_IMPORT_PROMPT.en.md' : lang === 'de' ? 'SCORE_IMPORT_PROMPT.de.md' : 'SCORE_IMPORT_PROMPT.md');
}
