import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DRUM_PROFILE, NOTEHEADS, INSTRUMENTS } from '../src/core/profile.js';
import { Mark, Roll, Grace } from '../src/core/score.js';
import { NOTE_VALUES } from '../src/core/noteValue.js';
import { decode } from '../src/core/json.js';
import { importPromptUrl } from '../src/app/importPrompt.js';

const DOCS = { pt: 'docs/SCORE_IMPORT_PROMPT.md', en: 'docs/SCORE_IMPORT_PROMPT.en.md', de: 'docs/SCORE_IMPORT_PROMPT.de.md' };

describe('import prompt in every language', () => {
  for (const [lang, path] of Object.entries(DOCS)) {
    const text = readFileSync(path, 'utf8');
    it(`${lang}: documents every id the importer accepts`, () => {
      const ids = [
        ...DRUM_PROFILE.staves[0].slots.map((s) => s.id),
        ...NOTEHEADS.filter((h) => h !== 'normal'),
        ...Object.values(Mark), ...Object.values(Roll), ...Object.values(Grace),
        'quarter', 'eighth', 'sixteenth', 'thirtySecond', 'timeSig', 'simile', 'repeatStart', 'repeatEnd', 'text',
        ...INSTRUMENTS, 'parts', 'instrument', 'alter', 'key', 'cont', 'dyn', 'wedge', 'lyric', 'slur', 'chord', 'swing', 'schema_version": 3',
      ];
      for (const id of ids) expect(text, `${lang} missing ${id}`).toContain(id);
      expect(NOTE_VALUES.length).toBe(6);
    });
    it(`${lang}: every example decodes`, () => {
      const blocks = [...text.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]);
      expect(blocks.length).toBeGreaterThanOrEqual(2);
      for (const json of blocks) expect(decode(json).bars[0].beats.length).toBe(4);
    });
  }
  it('the link follows the language', () => {
    expect(importPromptUrl('pt')).toMatch(/SCORE_IMPORT_PROMPT\.md$/);
    expect(importPromptUrl('en')).toMatch(/SCORE_IMPORT_PROMPT\.en\.md$/);
    expect(importPromptUrl('de')).toMatch(/SCORE_IMPORT_PROMPT\.de\.md$/);
  });
});
