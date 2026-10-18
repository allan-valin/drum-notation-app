import { Glyphs, Metrics } from './glyphs.js';
import { NoteValue } from './noteValue.js';
import { Articulation } from './score.js';
import { slotById } from './profile.js';
import { beamGroups } from './beaming.js';

/** Vertical centre of a staff position, measured down from the top line; 0 is the bottom line. */
export function yOf(staffPosition, spacing) {
  return (4 - staffPosition * 0.5) * spacing;
}

/** The inverse of `yOf`, rounded to the nearest half-step. How a tap height becomes a slot. */
export function staffPositionAt(y, spacing) {
  return Math.round((4 - y / spacing) * 2);
}

/** How many beams (or flag strokes) a value carries. */
function beamLevels(value) {
  if (value === NoteValue.EIGHTH) return 1;
  if (value === NoteValue.SIXTEENTH) return 2;
  if (value === NoteValue.THIRTY_SECOND) return 3;
  return 0;
}

/**
 * Turn a bar into glyphs and positions. Pure: no DOM, no SVG, so the whole of engraving is
 * unit-testable, and the print page reuses it unchanged.
 *
 * Glyph `x` is the glyph origin (its left edge for noteheads). Noteheads also carry
 * `beat`, `cell`, `slotId` and `value`, so a tap can be traced back and a colour chosen.
 * `focusedBeat` gets `focusScale` times the width of an ordinary beat, which is what makes one
 * beat large enough to edit on a phone while its neighbours stay visible.
 */
export function layoutBar(bar, staff, config) {
  const sp = config.staffSpacing;
  const focusScale = config.focusScale ?? 2.5;
  const glyphs = [];
  const stems = [];
  const beams = [];
  const texts = [];
  const beatBounds = [];
  const headW = Metrics.noteheadWidth * sp;
  const weights = bar.beats.map((_, i) => (i === config.focusedBeat ? focusScale : 1));
  const unit = config.width / weights.reduce((a, b) => a + b, 0);
  let x = 0;

  bar.beats.forEach((beat, beatIndex) => {
    const beatWidth = unit * weights[beatIndex];
    beatBounds.push([x, x + beatWidth]);
    const cellWidth = beatWidth / beat.cells.length;
    const centreX = (i) => x + cellWidth * i + cellWidth / 2;
    const headX = (i) => centreX(i) - headW / 2;
    const stemX = (i) => headX(i) + Metrics.stemUpSE.x * sp - (Metrics.stemThickness * sp) / 2;
    const levels = beamLevels(beat.division);
    const groups = beamGroups(beat);
    const groupOf = (i) => groups.find(([a, b]) => i >= a && i <= b);
    const beamY = {};
    // a beam sits above the highest head in its group, at stem length
    groups.forEach(([a, b]) => {
      let top = Infinity;
      for (let i = a; i <= b; i++) {
        beat.cells[i].notes.forEach((n) => {
          top = Math.min(top, yOf(slotById(staff, n.slotId).staffPosition, sp));
        });
      }
      beamY[a] = top - Metrics.stemLength * sp;
    });

    beat.cells.forEach((cell, cellIndex) => {
      if (cell.notes.length === 0) {
        const restY = beat.division === NoteValue.WHOLE ? sp : 2 * sp;
        glyphs.push({ kind: 'rest', glyph: Glyphs.rest(beat.division), x: centreX(cellIndex) - 0.5 * sp, y: restY, beat: beatIndex, cell: cellIndex, value: beat.division });
        return;
      }
      let topY = Infinity;
      let bottomY = -Infinity;
      cell.notes.forEach((n) => {
        const slot = slotById(staff, n.slotId);
        const y = yOf(slot.staffPosition, sp);
        topY = Math.min(topY, y);
        bottomY = Math.max(bottomY, y);
        glyphs.push({
          kind: 'note', glyph: Glyphs.notehead(slot.notehead, beat.division),
          x: headX(cellIndex), y, slotId: slot.id, beat: beatIndex, cell: cellIndex, value: beat.division,
          staffPosition: slot.staffPosition,
        });
        if (n.articulations.includes(Articulation.GHOST)) {
          glyphs.push({ kind: 'paren', glyph: Glyphs.PAREN_LEFT, x: headX(cellIndex) - 0.5 * sp, y, beat: beatIndex, cell: cellIndex, value: beat.division, slotRef: slot.id });
          glyphs.push({ kind: 'paren', glyph: Glyphs.PAREN_RIGHT, x: headX(cellIndex) + headW + 0.1 * sp, y, beat: beatIndex, cell: cellIndex, value: beat.division, slotRef: slot.id });
        }
      });
      // stem: up, from the lowest head to the beam or to stem length above the highest head
      const group = groupOf(cellIndex);
      const beamed = group && group[0] !== group[1];
      const stemTop = beamed ? beamY[group[0]] : topY - Metrics.stemLength * sp;
      if (beat.division !== NoteValue.WHOLE) {
        stems.push({ x: stemX(cellIndex), y1: bottomY - Metrics.stemUpSE.y * sp, y2: stemTop, beat: beatIndex, cell: cellIndex });
      }
      if (!beamed && levels > 0) {
        glyphs.push({ kind: 'flag', glyph: Glyphs.flag(beat.division), x: stemX(cellIndex) - (Metrics.stemThickness * sp) / 2, y: stemTop, beat: beatIndex, cell: cellIndex, value: beat.division });
      }
      const accented = cell.notes.some((n) => n.articulations.includes(Articulation.ACCENT));
      if (accented) {
        glyphs.push({ kind: 'accent', glyph: Glyphs.ACCENT, x: centreX(cellIndex) - 0.68 * sp, y: stemTop - 0.5 * sp, beat: beatIndex, cell: cellIndex, value: beat.division });
      }
      const sticking = cell.notes.map((n) => n.sticking).find((s) => s);
      if (sticking) {
        texts.push({ kind: 'sticking', text: sticking, x: centreX(cellIndex), y: yOf(-6, sp), beat: beatIndex, cell: cellIndex });
      }
    });

    groups.filter(([a, b]) => a !== b).forEach(([a, b]) => {
      for (let level = 0; level < levels; level++) {
        const y = beamY[a] + level * (Metrics.beamThickness + Metrics.beamSpacing) * sp;
        beams.push({ x1: stemX(a) - (Metrics.stemThickness * sp) / 2, x2: stemX(b) + (Metrics.stemThickness * sp) / 2, y1: y, y2: y, level, beat: beatIndex });
      }
    });

    if (beat.tuplet) {
      const tops = [...stems.filter((s) => s.beat === beatIndex).map((s) => s.y2), 0];
      const y = Math.min(...tops) - 0.6 * sp;
      glyphs.push({ kind: 'tuplet', glyph: Glyphs.tupletDigit(beat.tuplet), x: x + beatWidth / 2 - 0.4 * sp, y, beat: beatIndex });
    }
    x += beatWidth;
  });

  glyphs.push({ kind: 'barline', glyph: Glyphs.BARLINE, x: config.width - Metrics.barlineThickness * sp, y: yOf(0, sp) });

  const ys = [...glyphs.map((g) => g.y), ...stems.map((s) => s.y2), ...texts.map((t) => t.y), 0, 4 * sp];
  const top = Math.min(...ys) - sp;
  const bottom = Math.max(...ys) + sp;
  return { glyphs, stems, beams, texts, beatBounds, top, bottom };
}

/** Leger lines a notehead needs: positions outside 0..8 on even half-steps up to its own. */
export function legerLines(staffPosition) {
  const lines = [];
  if (staffPosition < 0) for (let p = -2; p >= staffPosition; p -= 2) lines.push(p);
  if (staffPosition > 8) for (let p = 10; p <= staffPosition; p += 2) lines.push(p);
  return lines;
}
