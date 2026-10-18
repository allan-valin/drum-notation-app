import { describe, it, expect } from 'vitest';
import { noteName, keyNames } from '../src/app/noteName.js';
import { STRINGS } from '../src/app/strings.js';

const n = (l) => STRINGS[l].noteNames;
describe('note names', () => {
  it('speak each language', () => {
    expect(noteName('F4', 1, 'pt', n('pt'))).toBe('Fá♯4');
    expect(noteName('F4', 1, 'en', n('en'))).toBe('F♯4');
    expect(noteName('B3', 0, 'de', n('de'))).toBe('H3');
    expect(noteName('B3', -1, 'de', n('de'))).toBe('B3');
    expect(noteName('E4', -0.5, 'en', n('en'))).toBe('E♭¼4');
  });
  it('names keys', () => {
    expect(keyNames(2, 'pt', n('pt'))).toEqual(['Ré', 'Si']);
    expect(keyNames(-2, 'de', n('de'))).toEqual(['B', 'G']);
    expect(keyNames(0, 'en', n('en'))).toEqual(['C', 'A']);
  });
});
