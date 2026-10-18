import { newScore, note, leaf, group, bar } from './score.js';
import { isGroup } from './tree.js';
import { noteValueById, cellsPerBeat } from './noteValue.js';
import { profileById } from './profile.js';

/** Bump when the shape changes. docs/SCORE_IMPORT_PROMPT.md targets this schema. */
export const SCHEMA_VERSION = 2;

export function encode(score) {
  return JSON.stringify(
    {
      schema_version: SCHEMA_VERSION,
      id: score.id,
      title: score.title,
      profileId: score.profileId,
      timeSigNum: score.timeSigNum,
      timeSigDen: score.timeSigDen,
      defaultBpm: score.defaultBpm,
      createdAt: score.createdAt,
      updatedAt: score.updatedAt,
      bars: score.bars.map((b) => ({
        ...(b.timeSig ? { timeSig: b.timeSig } : {}),
        ...(b.simile ? { simile: true } : {}),
        ...(b.repeatStart ? { repeatStart: true } : {}),
        ...(b.repeatEnd ? { repeatEnd: true } : {}),
        beats: b.beats.map(encodeGroup),
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
    cells: g.cells.map((c) => (isGroup(c) ? encodeGroup(c) : c.notes.map(encodeNote))),
  };
}

function encodeNote(n) {
  if (n.articulations.length === 0 && !n.sticking) return n.slotId;
  return {
    slot: n.slotId,
    ...(n.articulations.length ? { articulations: n.articulations } : {}),
    ...(n.sticking ? { sticking: n.sticking } : {}),
  };
}

/**
 * Parse and validate. Accepts the full form `encode` writes and the minimal hand-written form
 * where a cell is a list of slot ids. Throws with a message naming what is wrong, so the
 * import dialog can show it.
 */
export function decode(text) {
  const j = typeof text === 'string' ? JSON.parse(text) : text;
  if (typeof j !== 'object' || j === null) throw new Error('JSON não é um objeto');
  const version = j.schema_version ?? j.schemaVersion;
  if (version !== undefined && version > SCHEMA_VERSION) {
    throw new Error(`schema_version ${version} é mais nova do que a suportada (${SCHEMA_VERSION})`);
  }
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
      { timeSig, simile: b.simile === true && bi > 0, repeatStart: b.repeatStart === true, repeatEnd: b.repeatEnd === true },
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
    const notes = Array.isArray(c) ? c : (c?.notes ?? []);
    return leaf(notes.map((n) => decodeNote(n, staff, here)));
  }));
}

function decodeNote(n, staff, where) {
  const slotId = typeof n === 'string' ? n : n?.slot ?? n?.slotId;
  if (!staff.slots.some((s) => s.id === slotId)) {
    throw new Error(`${where}: slot desconhecido "${slotId}" (válidos: ${staff.slots.map((s) => s.id).join(', ')})`);
  }
  const articulations = typeof n === 'string' ? [] : n.articulations ?? [];
  const sticking = typeof n === 'string' ? null : n.sticking ?? null;
  return note(slotId, { articulations, sticking });
}

function int(v, name) {
  if (!Number.isInteger(v) || v <= 0) throw new Error(`${name} precisa ser um inteiro positivo`);
  return v;
}
