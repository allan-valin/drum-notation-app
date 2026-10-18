// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import Palette from '../../src/ui/Palette.svelte';
import Prefs from '../../src/ui/Prefs.svelte';
import { initPrefs, prefs } from '../../src/app/prefs.svelte.js';
import { createStore } from '../../src/core/storage.js';
import { NoteValue } from '../../src/core/noteValue.js';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}
const tool = { value: NoteValue.QUARTER, tuplet: null, delete: false, accent: false, ghost: false, sticking: null };

afterEach(() => { cleanup(); prefs.lang = 'pt'; prefs.theme = null; delete document.documentElement.dataset.theme; });

describe('language and theme', () => {
  it('switching language relabels the palette and is remembered', async () => {
    const store = createStore(memoryStorage());
    initPrefs(store);
    prefs.lang = 'pt';
    const { getByText, queryByText } = render(Prefs);
    const pal = render(Palette, { tool, onAction: () => {} });
    expect(pal.getAllByText('Colcheia').length).toBeGreaterThan(0);
    await fireEvent.click(getByText('DE'));
    expect(pal.getAllByText('Achtel').length).toBeGreaterThan(0);
    expect(queryByText('Colcheia')).toBeNull();
    expect(store.loadSettings().lang).toBe('de');
    expect(document.documentElement.lang).toBe('de');
  });
  it('the sun/moon switch sets data-theme and is remembered', async () => {
    const store = createStore(memoryStorage());
    initPrefs(store);
    const { getByRole } = render(Prefs);
    const sw = getByRole('switch');
    await fireEvent.click(sw);
    const first = document.documentElement.dataset.theme;
    expect(['light', 'dark']).toContain(first);
    await fireEvent.click(sw);
    expect(document.documentElement.dataset.theme).not.toBe(first);
    expect(store.loadSettings().theme).toBe(document.documentElement.dataset.theme);
  });
  it('palette shows a heading per group', () => {
    const { getByText } = render(Palette, { tool, onAction: () => {} });
    for (const h of ['Figura', 'Quiáltera', 'Articulação', 'Mão', 'Edição']) expect(getByText(h)).toBeTruthy();
  });
});
