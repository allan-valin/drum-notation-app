/**
 * Chord symbols as jazz and pop charts write them: root, quality, extensions, optional bass
 * ("C7", "B♭maj7", "F♯m7♭5", "C/E"). `parseChord` returns the root (0 = C) and the chord's
 * intervals in semitones, or null when the text is not a chord it knows.
 */
const ROOTS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUALITIES = [
  // longest first, so "maj7" wins over "maj" and "m7b5" over "m7"
  ['maj9', [0, 4, 7, 11, 14]], ['maj7', [0, 4, 7, 11]], ['M7', [0, 4, 7, 11]], ['Δ7', [0, 4, 7, 11]], ['Δ', [0, 4, 7, 11]],
  ['m7b5', [0, 3, 6, 10]], ['ø7', [0, 3, 6, 10]], ['ø', [0, 3, 6, 10]],
  ['mMaj7', [0, 3, 7, 11]], ['m9', [0, 3, 7, 10, 14]], ['m7', [0, 3, 7, 10]], ['m6', [0, 3, 7, 9]], ['min', [0, 3, 7]], ['m', [0, 3, 7]], ['-7', [0, 3, 7, 10]], ['-', [0, 3, 7]],
  ['dim7', [0, 3, 6, 9]], ['°7', [0, 3, 6, 9]], ['dim', [0, 3, 6]], ['°', [0, 3, 6]],
  ['aug', [0, 4, 8]], ['+', [0, 4, 8]],
  ['7sus4', [0, 5, 7, 10]], ['sus4', [0, 5, 7]], ['sus2', [0, 2, 7]], ['sus', [0, 5, 7]],
  ['7#9', [0, 4, 7, 10, 15]], ['7b9', [0, 4, 7, 10, 13]], ['13', [0, 4, 7, 10, 14, 21]], ['11', [0, 4, 7, 10, 14, 17]], ['9', [0, 4, 7, 10, 14]],
  ['add9', [0, 4, 7, 14]], ['69', [0, 4, 7, 9, 14]], ['6', [0, 4, 7, 9]], ['7', [0, 4, 7, 10]], ['5', [0, 7]],
  ['', [0, 4, 7]],
];

function note(text) {
  const m = /^([A-G])(#|b|♯|♭)?/.exec(text);
  if (!m) return null;
  const shift = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  return { pc: (ROOTS[m[1]] + shift + 12) % 12, rest: text.slice(m[0].length) };
}

export function parseChord(text) {
  const raw = String(text ?? '').trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  const [main, bassText] = raw.split('/');
  const root = note(main);
  if (!root) return null;
  const q = QUALITIES.find(([name]) => root.rest === name);
  if (!q) return null;
  let bass = null;
  if (bassText !== undefined) {
    const b = note(bassText);
    if (!b || b.rest) return null;
    bass = b.pc;
  }
  return { root: root.pc, intervals: q[1], bass };
}

/** "Bbmaj7" → "B♭maj7": sharps and flats as the signs, for printing. */
export function prettyChord(text) {
  return String(text).replace(/([A-G])#/g, '$1♯').replace(/([A-G])b/g, '$1♭').replace(/([#b])(\d)/g, (m, a, d) => (a === '#' ? '♯' : '♭') + d);
}

/**
 * MIDI notes of a chord as a comping instrument plays it: close position around `centre`;
 * a bass instrument plays the root (or the slash bass) only.
 */
export function chordMidis(chord, { centre = 60, bassOnly = false } = {}) {
  const lowest = (pc) => { let m = centre - 12 + ((pc - (centre - 12)) % 12 + 12) % 12; return m; };
  if (bassOnly) return [lowest(chord.bass ?? chord.root) - 12];
  const root = lowest(chord.root);
  const tones = chord.intervals.map((i) => root + i);
  return chord.bass !== null ? [lowest(chord.bass) - 12, ...tones] : tones;
}
