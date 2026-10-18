import { decode } from './json.js';

/** Shown behind the welcome overlay when there is nothing to continue: a basic rock groove. */
export function demoScore(title) {
  const hh = (x) => [x, 'hihat'].filter(Boolean);
  const beat = (a, b) => ({ division: 'eighth', cells: [hh(a), hh(b)] });
  return decode({
    schema_version: 2,
    id: 'demo',
    title,
    defaultBpm: 90,
    bars: [
      { repeatStart: true, beats: [beat('kick'), beat('snare'), beat('kick'), { division: 'eighth', cells: [hh('snare'), { division: 'sixteenth', cells: [['hihat'], ['kick']] }] }] },
      { simile: true, repeatEnd: true, beats: [beat('kick'), beat('snare'), beat('kick'), beat('snare')] },
    ],
  });
}
