/**
 * Colour per note value, for reading practice: on screen and on the printed page alike.
 * `ink` means "the theme's text colour", so quarters and longer always match the staff lines,
 * in light mode and in dark mode.
 */
export const INK = 'ink';

export const DEFAULT_COLOURS = Object.freeze({
  whole: INK,
  half: INK,
  quarter: INK,
  eighth: '#3b7ddd',
  sixteenth: '#e0473c',
  thirtySecond: '#9b59d0',
});

/** Hex values that were once hard-coded defaults; stored settings holding them mean "ink". */
const LEGACY_INK = new Set(['#1c1c1e']);
const LEGACY_DEFAULTS = { eighth: '#1d5fd6', sixteenth: '#d6281d', thirtySecond: '#7a1dd6' };

export function colourFor(value, map = DEFAULT_COLOURS) {
  const c = map[value.id] ?? DEFAULT_COLOURS[value.id];
  return c === INK ? 'currentColor' : c;
}

export function withColour(map, value, colour) {
  return { ...map, [value.id]: colour };
}

/** Complete a stored map with defaults, migrating values from earlier versions. */
export function normaliseColours(stored = {}) {
  const out = { ...DEFAULT_COLOURS };
  for (const [k, v] of Object.entries(stored ?? {})) {
    if (!(k in DEFAULT_COLOURS) || typeof v !== 'string') continue;
    if (LEGACY_INK.has(v.toLowerCase())) out[k] = INK;
    else if (LEGACY_DEFAULTS[k] === v.toLowerCase()) out[k] = DEFAULT_COLOURS[k];
    else out[k] = v;
  }
  return out;
}

/** Only the entries that differ from the defaults, so future default changes reach the user. */
export function overridesOnly(map) {
  return Object.fromEntries(Object.entries(map).filter(([k, v]) => DEFAULT_COLOURS[k] !== v));
}
