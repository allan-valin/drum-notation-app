/** Colour per note value, for reading practice: on screen and on the printed page alike. */
export const DEFAULT_COLOURS = Object.freeze({
  whole: '#1c1c1e',
  half: '#1c1c1e',
  quarter: '#1c1c1e',
  eighth: '#1d5fd6',
  sixteenth: '#d6281d',
  thirtySecond: '#7a1dd6',
});

export function colourFor(value, map = DEFAULT_COLOURS) {
  return map[value.id] ?? DEFAULT_COLOURS[value.id];
}

export function withColour(map, value, colour) {
  return { ...map, [value.id]: colour };
}
