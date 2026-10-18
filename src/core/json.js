import { newScore, note, cell, beat, bar } from './score.js';
import { noteValueById, cellsPerBeat } from './noteValue.js';
import { profileById } from './profile.js';

/** Bump when the shape changes. docs/SCORE_IMPORT_PROMPT.md targets this schema. */
export const SCHEMA_VERSION = 1;

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
        beats: b.beats.map((bt) => ({
          division: bt.division.id,
          ...(bt.tuplet ? { tuplet: bt.tuplet } : {}),
          cells: bt.cells.map((c) => c.notes.map(encodeNote)),
        })),
      })),
    },
    null,
    2,
  );
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

  const bars = j.bars.map((b, bi) => {
    const beats = b.beats ?? b;
    if (!Array.isArray(beats)) throw new Error(`compasso ${bi + 1}: beats precisa ser uma lista`);
    return bar(
      beats.map((bt, ti) => {
        const where = `compasso ${bi + 1}, tempo ${ti + 1}`;
        const division = noteValueById(bt.division ?? 'quarter');
        const tuplet = bt.tuplet ? int(bt.tuplet, `${where}: tuplet`) : null;
        const expected = cellsPerBeat(division, timeSigDen, tuplet);
        if (!Array.isArray(bt.cells)) throw new Error(`${where}: cells precisa ser uma lista`);
        if (bt.cells.length !== expected) {
          throw new Error(`${where}: ${division.id}${tuplet ? ` (quiáltera ${tuplet})` : ''} precisa de ${expected} cells, veio ${bt.cells.length}`);
        }
        return beat(
          division,
          tuplet,
          bt.cells.map((c, ci) => {
            const notes = Array.isArray(c) ? c : (c?.notes ?? []);
            return cell(notes.map((n) => decodeNote(n, staff, `${where}, célula ${ci + 1}`)));
          }),
        );
      }),
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
