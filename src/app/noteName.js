import { parseSlot, STEPS } from '../core/pitch.js';

const SIGNS = { '-2': '𝄫', '-1.5': '♭¾', '-1': '♭', '-0.5': '♭¼', 0: '', 0.5: '♯¼', 1: '♯', 1.5: '♯¾', 2: '𝄪' };

/**
 * "Fá♯4", "F♯4", "Fis4"-style names in the reader's language. German calls B natural H and
 * B flat B, so those two are spelled without a sign.
 */
export function noteName(slotId, alter, lang, names) {
  const { step, octave } = parseSlot(slotId);
  const letter = STEPS[step];
  if (lang === 'de' && letter === 'B') {
    if (alter === -1) return `B${octave}`;
    return `H${SIGNS[String(alter ?? 0)] ?? ''}${octave}`;
  }
  return `${names[letter]}${SIGNS[String(alter ?? 0)] ?? ''}${octave}`;
}

/** Major and relative minor of a key signature in fifths, e.g. 2 → ["Ré", "Si m"]. */
export function keyNames(fifths, lang, names) {
  const MAJOR = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯'];
  const MAJOR_FLAT = ['C', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭'];
  const MINOR = ['A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'A♯'];
  const MINOR_FLAT = ['A', 'D', 'G', 'C', 'F', 'B♭', 'E♭', 'A♭'];
  const spell = (s) => {
    const letter = s[0];
    const sign = s.slice(1);
    if (lang === 'de' && letter === 'B') return sign === '♭' ? 'B' : 'H' + sign;
    return names[letter] + sign;
  };
  const major = fifths >= 0 ? MAJOR[fifths] : MAJOR_FLAT[-fifths];
  const minor = fifths >= 0 ? MINOR[fifths] : MINOR_FLAT[-fifths];
  return [spell(major), spell(minor)];
}
