import { describe, it, expect } from 'vitest';
import { newScore, note } from '../src/core/score.js';
import { toFull, addPart, partView } from '../src/core/parts.js';
import { cursor, leafAt } from '../src/core/cursor.js';
import { placeNote, addBar, setLength, syllables, distributeLyrics } from '../src/core/edit.js';
import { initialState, reduce } from '../src/core/editorState.js';
import { NoteValue } from '../src/core/noteValue.js';

const n = (s) => ({ ...note(s), alter: 0 });
function melody() {
  const f = addPart(toFull(newScore({ id: 'l', title: 't' })), 'soprano');
  let v = addBar(partView(f, f.parts[1].id));
  for (let b = 0; b < 2; b++) for (let k = 0; k < 4; k++) if (!(b === 0 && k === 3)) v = placeNote(v, cursor(b, k, 0), n('G4'));
  v = setLength(v, cursor(0, 2, 0), NoteValue.HALF, false); // beat 3 holds into beat 4: one note
  return v;
}
const lyricsOf = (v) => v.bars.flatMap((b) => b.beats.map((bt) => bt.cells[0].lyric ?? (bt.cells[0].cont ? '~' : '')));

describe('lyrics from text', () => {
  it('splits words into syllables, keeping the hyphen on all but the last', () => {
    expect(syllables('Glo-ri-a in ex-cel-sis')).toEqual(['Glo-', 'ri-', 'a', 'in', 'ex-', 'cel-', 'sis']);
    expect(syllables('  a _ b\nc  ')).toEqual(['a', '_', 'b', 'c']);
  });
  it('spreads syllables over the notes from the cursor on, skipping held cells, across bars', () => {
    const r = distributeLyrics(melody(), cursor(0, 0, 0), 'Glo-ri-a in ex-cel-sis');
    expect(lyricsOf(r.score)).toEqual(['Glo-', 'ri-', 'a', '~', 'in', 'ex-', 'cel-', 'sis']);
    expect(r.placed).toBe(7);
    expect(r.left).toBe(0);
  });
  it('"_" skips a note (a melisma), and extra syllables are reported', () => {
    const r = distributeLyrics(melody(), cursor(0, 1, 0), 'A _ men too many words here');
    expect(lyricsOf(r.score).slice(0, 5)).toEqual(['', 'A', '', '~', 'men']);
    expect(r.left).toBeGreaterThan(0);
  });
  it('the editor pastes from the selected note, and one undo takes it all back', () => {
    let st = reduce(initialState(toFull(melody())), { type: 'setPart', part: 'p1' });
    st = reduce(st, { type: 'pasteLyrics', text: 'Ky-ri-e' });
    expect(lyricsOf(st.score).slice(0, 2)).toEqual(['Ky-', 'ri-']);
    expect(st.history.length).toBe(1);
  });
  it('a lyric can be typed under any note without moving there first', () => {
    let st = reduce(initialState(toFull(melody())), { type: 'setPart', part: 'p1' });
    st = reduce(st, { type: 'setLyricAt', beat: 1, path: [0], text: 'la' });
    expect(leafAt(st.score, cursor(0, 1, 0)).lyric).toBe('la');
    expect(st.cursor).toEqual(cursor(0, 1, 0));
  });
});
