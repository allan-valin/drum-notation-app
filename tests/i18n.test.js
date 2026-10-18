import { describe, it, expect } from 'vitest';
import { STRINGS, LANGS, format, pickLang } from '../src/app/strings.js';

const keys = (o, prefix = '') =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

describe('strings', () => {
  it('has pt, en and de', () => {
    expect(LANGS).toEqual(['pt', 'en', 'de']);
  });
  it('every language has exactly the same keys as pt', () => {
    const pt = keys(STRINGS.pt).sort();
    for (const l of ['en', 'de']) expect(keys(STRINGS[l]).sort()).toEqual(pt);
  });
  it('no string is empty', () => {
    for (const l of LANGS) for (const k of keys(STRINGS[l])) {
      const v = k.split('.').reduce((o, p) => o[p], STRINGS[l]);
      expect(v, `${l}.${k}`).not.toBe('');
    }
  });
  it('placeholders match across languages', () => {
    const ph = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const k of keys(STRINGS.pt)) {
      const get = (l) => k.split('.').reduce((o, p) => o[p], STRINGS[l]);
      for (const l of ['en', 'de']) expect(ph(get(l)), `${l}.${k}`).toBe(ph(get('pt')));
    }
  });
  it('formats placeholders', () => {
    expect(format('Compasso {n} de {total}', { n: 2, total: 5 })).toBe('Compasso 2 de 5');
  });
  it('picks a language from the browser', () => {
    expect(pickLang('pt-BR')).toBe('pt');
    expect(pickLang('de-AT')).toBe('de');
    expect(pickLang('fr-FR')).toBe('en');
    expect(pickLang(undefined)).toBe('en');
  });
  it('uses Brazilian forms, never European Portuguese ones', () => {
    const all = JSON.stringify(STRINGS.pt);
    for (const bad of ['ficheiro', 'carregue', 'está a ', 'ecrã', 'utilizador', 'guardar']) {
      expect(all.toLowerCase()).not.toContain(bad);
    }
  });
});
