import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '../src/core/storage.js';
import { newScore } from '../src/core/score.js';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

describe('score store', () => {
  let store;
  beforeEach(() => { store = createStore(memoryStorage()); });

  it('starts empty', () => {
    expect(store.list()).toEqual([]);
  });
  it('saves and loads a score by id', () => {
    const s = newScore({ id: 'a', title: 'A' });
    store.save(s);
    expect(store.load('a')).toEqual(s);
  });
  it('lists summaries newest first', () => {
    store.save(newScore({ id: 'a', title: 'A', updatedAt: 1 }));
    store.save(newScore({ id: 'b', title: 'B', updatedAt: 2 }));
    expect(store.list().map((x) => x.id)).toEqual(['b', 'a']);
    expect(store.list()[0]).toMatchObject({ id: 'b', title: 'B', bars: 1 });
  });
  it('overwrites on save with the same id', () => {
    store.save(newScore({ id: 'a', title: 'A' }));
    store.save(newScore({ id: 'a', title: 'A2' }));
    expect(store.list().length).toBe(1);
    expect(store.load('a').title).toBe('A2');
  });
  it('removes', () => {
    store.save(newScore({ id: 'a', title: 'A' }));
    store.remove('a');
    expect(store.load('a')).toBeNull();
    expect(store.list()).toEqual([]);
  });
  it('ignores foreign keys in the same storage', () => {
    const raw = memoryStorage();
    raw.setItem('other', 'x');
    expect(createStore(raw).list()).toEqual([]);
  });
  it('skips a corrupt entry instead of throwing', () => {
    const raw = memoryStorage();
    const st = createStore(raw);
    st.save(newScore({ id: 'ok', title: 'ok' }));
    raw.setItem('drum.score.bad', '{not json');
    expect(st.list().map((x) => x.id)).toEqual(['ok']);
  });
  it('keeps user settings as a separate document', () => {
    store.saveSettings({ colours: { eighth: '#ff0000' } });
    expect(store.loadSettings()).toEqual({ colours: { eighth: '#ff0000' } });
    expect(store.list()).toEqual([]);
  });
});
