import { emptyBar, barTimeSig } from './score.js';
import { leafSpans } from './tree.js';
import { profileById, GROUPS, groupName } from './profile.js';

/**
 * A full score holds parts (one per instrument) that share bars: signatures and repeats live
 * on the bar, each part's notes in `bar.parts[partId]` ({ beats, simile, text }).
 *
 * Editing never sees that shape. `partView` projects one part as the single-instrument score
 * every editing function already understands; `zipPart` writes a view back. Bar operations
 * (add, remove, move, signature) run on every part's view with `applyAll`, which keeps the
 * parts aligned because the same operation shapes every part the same way.
 */
const HEADER = ['id', 'title', 'timeSigNum', 'timeSigDen', 'defaultBpm', 'swing', 'createdAt', 'updatedAt'];

export function isFull(score) {
  return Array.isArray(score?.parts);
}

/** A one-instrument score (or a full one, unchanged) as a full score. */
export function toFull(score) {
  if (isFull(score)) return score;
  const id = 'p1';
  return {
    ...pick(score),
    parts: [{ id, instrument: score.profileId ?? 'drums', muted: false }],
    bars: score.bars.map((b) => ({
      timeSig: b.timeSig ?? null,
      key: b.key ?? null,
      repeatStart: !!b.repeatStart,
      repeatEnd: !!b.repeatEnd,
      parts: { [id]: content(b) },
    })),
  };
}

export function partView(full, partId) {
  const part = full.parts.find((p) => p.id === partId) ?? full.parts[0];
  return {
    ...pick(full),
    profileId: part.instrument,
    bars: full.bars.map((b) => ({
      timeSig: b.timeSig,
      key: b.key ?? null,
      repeatStart: b.repeatStart,
      repeatEnd: b.repeatEnd,
      ...b.parts[part.id],
    })),
  };
}

/** Write one part's view back. The view also carries the header and shared bar marks. */
export function zipPart(full, partId, view) {
  return zip(full, { [partId]: view });
}

/** Run a bar operation on every part; the result has every part changed the same way. */
export function applyAll(full, f) {
  const views = Object.fromEntries(full.parts.map((p) => [p.id, f(partView(full, p.id))]));
  if (full.parts.every((p) => views[p.id] === undefined)) return full;
  return zip(full, views);
}

function zip(full, views) {
  const ids = Object.keys(views);
  const lead = views[ids[0]];
  if (ids.some((id) => views[id].bars.length !== lead.bars.length)) throw new Error('parts out of step');
  return {
    ...full,
    ...pick(lead),
    bars: lead.bars.map((b, i) => ({
      timeSig: b.timeSig ?? null,
      key: b.key ?? null,
      repeatStart: !!b.repeatStart,
      repeatEnd: !!b.repeatEnd,
      parts: {
        ...(full.bars[i]?.parts ?? {}),
        ...Object.fromEntries(ids.map((id) => [id, content(views[id].bars[i])])),
      },
    })),
  };
}

function newPartId(full) {
  const used = new Set(full.parts.map((p) => p.id));
  let n = full.parts.length + 1;
  while (used.has(`p${n}`)) n += 1;
  return `p${n}`;
}

/** Append an empty part for `instrument` (both hands for a piano or harp), shaped like the bars it joins. */
export function addPart(full, instrument) {
  return insertParts(full, full.parts.length, instrument);
}

function insertParts(full, index, instrument) {
  const members = GROUPS[instrument] ?? [instrument];
  const probe = partView(full, full.parts[0].id);
  let next = full;
  const group = members.length > 1 ? newGroupId(full) : null;
  const added = [];
  for (const m of members) {
    const id = newPartId({ ...next, parts: [...next.parts, ...added] });
    added.push({ id, instrument: m, muted: false, ...(group ? { group } : {}) });
  }
  return touch({
    ...full,
    parts: [...full.parts.slice(0, index), ...added, ...full.parts.slice(index)],
    bars: full.bars.map((b, i) => {
      const [num, den] = barTimeSig(probe, i);
      return { ...b, parts: { ...b.parts, ...Object.fromEntries(added.map((p) => [p.id, content(emptyBar(num, den))])) } };
    }),
  });
}

function newGroupId(full) {
  const used = new Set(full.parts.map((p) => p.group).filter(Boolean));
  let n = 1;
  while (used.has(`g${n}`)) n += 1;
  return `g${n}`;
}

/** The parts played as one instrument with `partId` (both hands of a piano), or just that part. */
export function groupOf(full, partId) {
  const part = full.parts.find((p) => p.id === partId);
  if (!part) return [];
  return part.group ? full.parts.filter((p) => p.group === part.group) : [part];
}

/** One row per instrument for the band list: a grouped instrument shows once, by its group name. */
export function bandRows(full) {
  const seen = new Set();
  const rows = [];
  for (const p of full.parts) {
    if (p.group && seen.has(p.group)) continue;
    if (p.group) seen.add(p.group);
    const members = groupOf(full, p.id);
    rows.push({ id: p.id, instrument: p.group ? groupName(members.map((m) => m.instrument)) ?? p.instrument : p.instrument, muted: members.every((m) => m.muted), parts: members.map((m) => m.id) });
  }
  return rows;
}

/** Remove a part (both hands of a grouped instrument). A score always keeps one part. */
export function removePart(full, partId) {
  const ids = new Set(groupOf(full, partId).map((p) => p.id));
  if (full.parts.length - ids.size < 1) return full;
  return touch({
    ...full,
    parts: full.parts.filter((p) => !ids.has(p.id)),
    bars: full.bars.map((b) => ({ ...b, parts: Object.fromEntries(Object.entries(b.parts).filter(([id]) => !ids.has(id))) })),
  });
}

export function isEmptyPart(full, partId) {
  return full.bars.every((b) => [...b.parts[partId].beats, ...(b.parts[partId].lower ?? [])].every((bt) => leafSpans(bt).every((l) => l.leaf.notes.length === 0)));
}

/**
 * Give a part another instrument. Notes written for one instrument mean nothing on another
 * (a kick has no place on a conga staff), so a written part is emptied; the caller asks first.
 */
export function setInstrument(full, partId, instrument) {
  const part = full.parts.find((p) => p.id === partId);
  if (!part || part.instrument === instrument) return full;
  // to or from a grouped instrument: replace the whole instrument in place, empty
  if (part.group || GROUPS[instrument]) {
    const members = groupOf(full, partId);
    if (members.length > 1 && groupName(members.map((m) => m.instrument)) === instrument) return full;
    const index = full.parts.indexOf(members[0]);
    const ids = new Set(members.map((m) => m.id));
    const without = {
      ...full,
      parts: full.parts.filter((p) => !ids.has(p.id)),
      bars: full.bars.map((b) => ({ ...b, parts: Object.fromEntries(Object.entries(b.parts).filter(([id]) => !ids.has(id))) })),
    };
    if (!without.parts.length) {
      // the only instrument: keep a placeholder long enough to shape the new parts' bars
      const shaped = insertParts(full, index, instrument);
      return removeIds(shaped, ids);
    }
    return insertParts(without, index, instrument);
  }
  const sameStaff = profileById(part.instrument).staves[0] === profileById(instrument).staves[0];
  const parts = full.parts.map((p) => (p.id === partId ? { ...p, instrument } : p));
  if (sameStaff || isEmptyPart(full, partId)) return touch({ ...full, parts });
  const probe = partView(full, partId);
  return touch({
    ...full,
    parts,
    bars: full.bars.map((b, i) => {
      const [num, den] = barTimeSig(probe, i);
      return { ...b, parts: { ...b.parts, [partId]: content(emptyBar(num, den)) } };
    }),
  });
}

export function toggleMute(full, partId) {
  const ids = new Set(groupOf(full, partId).map((p) => p.id));
  const muted = !full.parts.find((p) => p.id === partId)?.muted;
  return { ...full, parts: full.parts.map((p) => (ids.has(p.id) ? { ...p, muted } : p)) };
}

function removeIds(full, ids) {
  return {
    ...full,
    parts: full.parts.filter((p) => !ids.has(p.id)),
    bars: full.bars.map((b) => ({ ...b, parts: Object.fromEntries(Object.entries(b.parts).filter(([id]) => !ids.has(id))) })),
  };
}

/** 1, 2 … when an instrument appears more than once ("Bateria 2"); null when it is alone. */
export function partLabelIndex(full, partId) {
  const part = full.parts.find((p) => p.id === partId);
  const same = full.parts.filter((p) => p.instrument === part.instrument);
  return same.length > 1 ? same.indexOf(part) + 1 : null;
}

export function content(b) {
  // `lower`: a drum part's lower voice in its own rhythm (voices.js)
  return { beats: b.beats, simile: !!b.simile, text: b.text ?? '', ...(b.lower ? { lower: b.lower } : {}) };
}

function pick(score) {
  return Object.fromEntries(HEADER.map((k) => [k, k === 'swing' ? !!score[k] : score[k]]));
}

function touch(full) {
  return { ...full, updatedAt: Date.now() };
}

/** Assemble a full score from one decoded view per part (all with the same bars). */
export function fromViews(parts, views) {
  const lead = views[parts[0].id];
  return {
    ...pick(lead),
    parts: parts.map((p) => ({ id: p.id, instrument: p.instrument, muted: !!p.muted, ...(p.group ? { group: p.group } : {}) })),
    bars: lead.bars.map((b, i) => ({
      timeSig: b.timeSig ?? null,
      key: b.key ?? null,
      repeatStart: !!b.repeatStart,
      repeatEnd: !!b.repeatEnd,
      parts: Object.fromEntries(parts.map((p) => [p.id, content(views[p.id].bars[i])])),
    })),
  };
}

/**
 * Move bars `from..to` of one part only, to before the bar that was at `gap`; every other part
 * and the bars themselves (signatures, repeats) stay put. Only between bars of one signature,
 * since a part's beats are shaped by it: otherwise { refused: 'signaturesDiffer' }.
 */
export function movePartBars(full, partId, from, to, gap) {
  if (gap >= from && gap <= to + 1) return { full, range: [from, to] };
  const view = partView(full, partId);
  const lo = Math.min(from, gap);
  const hi = Math.max(to, gap - 1);
  const sig = barTimeSig(view, lo).join('/');
  for (let i = lo; i <= hi; i++) if (barTimeSig(view, i).join('/') !== sig) return { refused: 'signaturesDiffer' };
  const contents = full.bars.map((b) => b.parts[partId]);
  const block = contents.slice(from, to + 1);
  const rest = [...contents.slice(0, from), ...contents.slice(to + 1)];
  const at = gap > to ? gap - block.length : gap;
  let moved = [...rest.slice(0, at), ...block, ...rest.slice(at)];
  if (moved[0].simile) moved = moved.map((c, i) => (i === 0 ? { ...c, simile: false } : c));
  return {
    full: touch({ ...full, bars: full.bars.map((b, i) => ({ ...b, parts: { ...b.parts, [partId]: moved[i] } })) }),
    range: [at, at + block.length - 1],
  };
}
