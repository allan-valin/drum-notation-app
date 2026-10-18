import { encode, decodeFull } from './json.js';

const PREFIX = 'drum.score.';
const SETTINGS = 'drum.settings';

/**
 * Scores live one per key in localStorage, as the same JSON the export writes, so a backup
 * and the store are the same bytes. `storage` is injected so tests run without a browser.
 */
export function createStore(storage) {
  const keys = () => {
    const out = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(PREFIX)) out.push(k);
    }
    return out;
  };

  return {
    /** Summaries, newest first. A corrupt entry is skipped, never fatal. `load` returns the full score, every part. */
    list() {
      const out = [];
      for (const k of keys()) {
        try {
          const s = decodeFull(storage.getItem(k));
          out.push({ id: s.id, title: s.title, bars: s.bars.length, updatedAt: s.updatedAt, defaultBpm: s.defaultBpm, instruments: s.parts.map((p) => p.instrument) });
        } catch {
          // ignore
        }
      }
      return out.sort((a, b) => b.updatedAt - a.updatedAt);
    },
    load(id) {
      const raw = storage.getItem(PREFIX + id);
      if (raw === null) return null;
      try {
        return decodeFull(raw);
      } catch {
        return null;
      }
    },
    save(score) {
      storage.setItem(PREFIX + score.id, encode(score));
    },
    remove(id) {
      storage.removeItem(PREFIX + id);
    },
    loadSettings() {
      try {
        return JSON.parse(storage.getItem(SETTINGS) ?? '{}');
      } catch {
        return {};
      }
    },
    saveSettings(settings) {
      storage.setItem(SETTINGS, JSON.stringify(settings));
    },
  };
}
