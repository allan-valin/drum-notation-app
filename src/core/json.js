import { newScore, note, leaf, group, bar } from './score.js';
import { isGroup } from './tree.js';
import { noteValueById, cellsPerBeat } from './noteValue.js';
import { profileById, NOTEHEADS } from './profile.js';
import { Mark, Roll, Grace } from './score.js';
import { toFull, partView, fromViews, isFull } from './parts.js';
import { PROFILES } from './profile.js';

/** Bump when the shape changes. docs/SCORE_IMPORT_PROMPT.md targets this schema. */
export const SCHEMA_VERSION = 3;

/** Write a score (one-part or full) as schema v3: parts listed once, notes per part per bar. */
export function encode(score) {
  const full = toFull(score);
  return JSON.stringify(
    {
      schema_version: SCHEMA_VERSION,
      id: full.id,
      title: full.title,
      timeSigNum: full.timeSigNum,
      timeSigDen: full.timeSigDen,
      defaultBpm: full.defaultBpm,
      createdAt: full.createdAt,
      updatedAt: full.updatedAt,
      parts: full.parts.map((p) => ({ id: p.id, instrument: p.instrument, ...(p.muted ? { muted: true } : {}) })),
      bars: full.bars.map((b) => ({
        ...(b.timeSig ? { timeSig: b.timeSig } : {}),
        ...(b.key !== null && b.key !== undefined ? { key: b.key } : {}),
        ...(b.repeatStart ? { repeatStart: true } : {}),
        ...(b.repeatEnd ? { repeatEnd: true } : {}),
        parts: Object.fromEntries(full.parts.map((p) => {
          const c = b.parts[p.id];
          return [p.id, { ...(c.simile ? { simile: true } : {}), ...(c.text ? { text: c.text } : {}), beats: c.beats.map(encodeGroup) }];
        })),
      })),
    },
    null,
    2,
  );
}

function encodeGroup(g) {
  return {
    division: g.division.id,
    ...(g.tuplet ? { tuplet: g.tuplet } : {}),
    cells: g.cells.map((c) => (isGroup(c) ? encodeGroup(c) : c.cont ? { cont: true } : c.notes.map(encodeNote))),
  };
}

function encodeNote(n) {
  const marks = n.marks ?? [];
  const hasAlter = typeof n.alter === 'number';
  if (n.articulations.length === 0 && !n.sticking && !n.head && marks.length === 0 && !n.roll && !n.grace && !hasAlter) return n.slotId;
  return {
    slot: n.slotId,
    ...(hasAlter ? { alter: n.alter } : {}),
    ...(n.articulations.length ? { articulations: n.articulations } : {}),
    ...(n.sticking ? { sticking: n.sticking } : {}),
    ...(n.head ? { head: n.head } : {}),
    ...(marks.length ? { marks } : {}),
    ...(n.roll ? { roll: n.roll } : {}),
    ...(n.grace ? { grace: n.grace } : {}),
  };
}

/**
 * Parse and validate into a full score. Reads v3 (parts) and v1/v2 (one drum part), including
 * the minimal hand-written form where a cell is a list of slot ids. Throws with a message
 * naming what is wrong, so the import dialog can show it.
 */
export function decodeFull(text) {
  const j = typeof text === 'string' ? JSON.parse(text) : text;
  if (typeof j !== 'object' || j === null) throw new Error('JSON não é um objeto');
  const version = j.schema_version ?? j.schemaVersion;
  if (version !== undefined && version > SCHEMA_VERSION) {
    throw new Error(`schema_version ${version} é mais nova do que a suportada (${SCHEMA_VERSION})`);
  }
  if (!Array.isArray(j.parts)) return toFull(decodeOnePart(j));
  if (j.parts.length === 0) throw new Error('parts precisa ter pelo menos um instrumento');
  const parts = j.parts.map((p, i) => {
    if (!PROFILES[p.instrument]) throw new Error(`instrumento ${i + 1}: "${p.instrument}" desconhecido (válidos: ${Object.keys(PROFILES).join(', ')})`);
    return { id: String(p.id ?? `p${i + 1}`), instrument: p.instrument, muted: !!p.muted };
  });
  if (!Array.isArray(j.bars) || j.bars.length === 0) throw new Error('bars precisa ser uma lista com pelo menos um compasso');
  const views = Object.fromEntries(parts.map((p) => {
    const bars = j.bars.map((b, bi) => {
      const c = b.parts?.[p.id];
      if (!c) throw new Error(`compasso ${bi + 1}: falta a parte "${p.id}"`);
      return { timeSig: b.timeSig, key: b.key, repeatStart: b.repeatStart, repeatEnd: b.repeatEnd, ...c };
    });
    try {
      return [p.id, decodeOnePart({ ...j, parts: undefined, profileId: p.instrument, bars })];
    } catch (e) {
      throw new Error(`${p.instrument} (${p.id}): ${e.message}`);
    }
  }));
  return fromViews(parts, views);
}

/** The first part as a one-instrument score: what the editor and older callers work with. */
export function decode(text) {
  const full = decodeFull(text);
  return partView(full, full.parts[0].id);
}

function decodeOnePart(j) {
  const profileId = j.profileId ?? 'drums';
  const staff = profileById(profileId).staves[0];
  const timeSigNum = int(j.timeSigNum ?? 4, 'timeSigNum');
  const timeSigDen = int(j.timeSigDen ?? 4, 'timeSigDen');
  if (!Array.isArray(j.bars) || j.bars.length === 0) throw new Error('bars precisa ser uma lista com pelo menos um compasso');

  let sig = [timeSigNum, timeSigDen];
  const bars = j.bars.map((b, bi) => {
    const beats = Array.isArray(b) ? b : b.beats;
    if (!Array.isArray(beats)) throw new Error(`compasso ${bi + 1}: beats precisa ser uma lista`);
    const timeSig = Array.isArray(b.timeSig) ? [int(b.timeSig[0], `compasso ${bi + 1}: timeSig`), int(b.timeSig[1], `compasso ${bi + 1}: timeSig`)] : null;
    if (timeSig) sig = timeSig;
    if (beats.length !== sig[0]) {
      throw new Error(`compasso ${bi + 1}: ${sig[0]}/${sig[1]} precisa de ${sig[0]} tempos, veio ${beats.length}`);
    }
    return bar(
      beats.map((bt, ti) => {
        const where = `compasso ${bi + 1}, tempo ${ti + 1}`;
        const division = noteValueById(bt.division ?? 'quarter');
        const tuplet = bt.tuplet ? int(bt.tuplet, `${where}: tuplet`) : null;
        return decodeGroup(bt, cellsPerBeat(division, sig[1], tuplet), staff, where);
      }),
      { timeSig, key: Number.isInteger(b.key) && Math.abs(b.key) <= 7 ? b.key : null, simile: b.simile === true && bi > 0, repeatStart: b.repeatStart === true, repeatEnd: b.repeatEnd === true, text: typeof b.text === 'string' ? b.text.slice(0, 80) : '' },
    );
  });

  return newScore({
    id: typeof j.id === 'string' ? j.id : undefined,
    title: String(j.title ?? ''),
    profileId,
    timeSigNum,
    timeSigDen,
    defaultBpm: int(j.defaultBpm ?? 80, 'defaultBpm'),
    bars,
    createdAt: typeof j.createdAt === 'number' ? j.createdAt : undefined,
    updatedAt: typeof j.updatedAt === 'number' ? j.updatedAt : undefined,
  });
}

function decodeGroup(g, expected, staff, where) {
  const division = noteValueById(g.division ?? 'quarter');
  const tuplet = g.tuplet ? int(g.tuplet, `${where}: tuplet`) : null;
  if (!Array.isArray(g.cells)) throw new Error(`${where}: cells precisa ser uma lista`);
  if (g.cells.length !== expected) {
    throw new Error(`${where}: ${division.id}${tuplet ? ` (quiáltera ${tuplet})` : ''} precisa de ${expected} cells, veio ${g.cells.length}`);
  }
  return group(division, tuplet, g.cells.map((c, ci) => {
    const here = `${where}.${ci + 1}`;
    if (c && !Array.isArray(c) && Array.isArray(c.cells)) {
      const inner = noteValueById(c.division ?? 'sixteenth');
      const count = c.tuplet ? int(c.tuplet, `${here}: tuplet`) : inner.divisionsPerWhole / division.divisionsPerWhole;
      if (!Number.isInteger(count) || count < 2) throw new Error(`${here}: ${inner.id} não cabe dentro de ${division.id}`);
      return decodeGroup(c, count, staff, here);
    }
    if (c && !Array.isArray(c) && c.cont === true) return leaf([], { cont: true });
    const notes = Array.isArray(c) ? c : (c?.notes ?? []);
    return leaf(notes.map((n) => decodeNote(n, staff, here)));
  }));
}

function decodeNote(n, staff, where) {
  const slotId = typeof n === 'string' ? n : n?.slot ?? n?.slotId;
  if (!staff.slots.some((s) => s.id === slotId)) {
    throw new Error(`${where}: slot desconhecido "${slotId}" (válidos: ${staff.slots.map((s) => s.id).join(', ')})`);
  }
  if (typeof n === 'string') return note(slotId);
  const oneOf = (v, allowed, name) => {
    if (v == null) return null;
    if (!allowed.includes(v)) throw new Error(`${where}: ${name} desconhecido "${v}" (válidos: ${allowed.join(', ')})`);
    return v;
  };
  return note(slotId, {
    articulations: n.articulations ?? [],
    sticking: n.sticking ?? null,
    head: oneOf(n.head, NOTEHEADS, 'head'),
    marks: (n.marks ?? []).map((m) => oneOf(m, Object.values(Mark), 'mark')),
    roll: oneOf(n.roll, Object.values(Roll), 'roll'),
    grace: oneOf(n.grace, Object.values(Grace), 'grace'),
    alter: n.alter === undefined ? undefined : oneOf(n.alter, [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2], 'alter'),
  });
}

function int(v, name) {
  if (!Number.isInteger(v) || v <= 0) throw new Error(`${name} precisa ser um inteiro positivo`);
  return v;
}
