import { emptyBar, barTimeSig } from './score.js';
import { leafSpans } from './tree.js';
import { profileById } from './profile.js';

/**
 * A full score holds parts (one per instrument) that share bars: signatures and repeats live
 * on the bar, each part's notes in `bar.parts[partId]` ({ beats, simile, text }).
 *
 * Editing never sees that shape. `partView` projects one part as the single-instrument score
 * every editing function already understands; `zipPart` writes a view back. Bar operations
 * (add, remove, move, signature) run on every part's view with `applyAll`, which keeps the
 * parts aligned because the same operation shapes every part the same way.
 */
const HEADER = ['id', 'title', 'timeSigNum', 'timeSigDen', 'defaultBpm', 'createdAt', 'updatedAt'];

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

/** Append an empty part for `instrument`, shaped like the bars it joins. */
export function addPart(full, instrument) {
  const id = newPartId(full);
  const probe = partView(full, full.parts[0].id);
  return touch({
    ...full,
    parts: [...full.parts, { id, instrument, muted: false }],
    bars: full.bars.map((b, i) => {
      const [num, den] = barTimeSig(probe, i);
      return { ...b, parts: { ...b.parts, [id]: content(emptyBar(num, den)) } };
    }),
  });
}

/** Remove a part. A score always keeps one. */
export function removePart(full, partId) {
  if (full.parts.length <= 1) return full;
  return touch({
    ...full,
    parts: full.parts.filter((p) => p.id !== partId),
    bars: full.bars.map((b) => {
      const { [partId]: _, ...rest } = b.parts;
      return { ...b, parts: rest };
    }),
  });
}

export function isEmptyPart(full, partId) {
  return full.bars.every((b) => b.parts[partId].beats.every((bt) => leafSpans(bt).every((l) => l.leaf.notes.length === 0)));
}

/**
 * Give a part another instrument. Notes written for one instrument mean nothing on another
 * (a kick has no place on a conga staff), so a written part is emptied; the caller asks first.
 */
export function setInstrument(full, partId, instrument) {
  const part = full.parts.find((p) => p.id === partId);
  if (!part || part.instrument === instrument) return full;
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
  return { ...full, parts: full.parts.map((p) => (p.id === partId ? { ...p, muted: !p.muted } : p)) };
}

/** 1, 2 … when an instrument appears more than once ("Bateria 2"); null when it is alone. */
export function partLabelIndex(full, partId) {
  const part = full.parts.find((p) => p.id === partId);
  const same = full.parts.filter((p) => p.instrument === part.instrument);
  return same.length > 1 ? same.indexOf(part) + 1 : null;
}

export function content(b) {
  return { beats: b.beats, simile: !!b.simile, text: b.text ?? '' };
}

function pick(score) {
  return Object.fromEntries(HEADER.map((k) => [k, score[k]]));
}

function touch(full) {
  return { ...full, updatedAt: Date.now() };
}

/** Assemble a full score from one decoded view per part (all with the same bars). */
export function fromViews(parts, views) {
  const lead = views[parts[0].id];
  return {
    ...pick(lead),
    parts: parts.map((p) => ({ id: p.id, instrument: p.instrument, muted: !!p.muted })),
    bars: lead.bars.map((b, i) => ({
      timeSig: b.timeSig ?? null,
      repeatStart: !!b.repeatStart,
      repeatEnd: !!b.repeatEnd,
      parts: Object.fromEntries(parts.map((p) => [p.id, content(views[p.id].bars[i])])),
    })),
  };
}
