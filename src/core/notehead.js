/** Notehead shapes. Its own module so glyphs, pitch and profile can all import it without a cycle. */
export const Notehead = Object.freeze({
  NORMAL: 'normal', CROSS: 'cross', DIAMOND: 'diamond', DIAMOND_OPEN: 'diamondOpen', TRIANGLE: 'triangle', CIRCLE_X: 'circleX', SLASHED: 'slashed',
  SLASH: 'slash', // rhythm slash: "comp the chord in this rhythm"
});
export const NOTEHEADS = Object.freeze(Object.values(Notehead));
