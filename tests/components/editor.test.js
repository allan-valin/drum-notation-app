// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import Editor from '../../src/ui/Editor.svelte';
import { createStore } from '../../src/core/storage.js';
import { newScore } from '../../src/core/score.js';
import { Glyphs } from '../../src/core/glyphs.js';
import { NoteValue } from '../../src/core/noteValue.js';
import { yOf } from '../../src/core/layout.js';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}

afterEach(cleanup);

beforeAll(() => {
  Element.prototype.getAnimations ??= () => [];
  window.PointerEvent ??= window.MouseEvent; // jsdom has no PointerEvent; MouseEvent carries clientX/Y
  window.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  // jsdom has no SVG geometry: identity transform, so client coords are SVG user units
  // (the editor SVG viewBox starts at x=0, so x maps 1:1; y is offset by viewBox.y which we read back)
  window.SVGElement.prototype.createSVGPoint = function () {
    return { x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } };
  };
  window.SVGElement.prototype.getScreenCTM = () => ({ inverse: () => ({}) });
});

const heads = (container) => [...container.querySelectorAll('.stage text')].filter((t) => t.textContent === Glyphs.notehead('normal', NoteValue.QUARTER) || t.textContent === Glyphs.notehead('cross', NoteValue.QUARTER));
const tapAt = (container, x, y) => fireEvent.pointerDown(container.querySelector('.stage svg'), { clientX: x, clientY: y });

describe('Editor', () => {
  it('places a snare on tap inside the focused beat and reports it', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    const svg = container.querySelector('.stage svg');
    const sp = 14; // jsdom reports clientWidth 0 → the editor clamps to its 300 px minimum → sp = 14
    const lead = 5.5 * sp; // clef + time signature
    expect(heads(container).length).toBe(0);
    await tapAt(container, lead + 20, yOf(4, sp)); // snare line, first (focused) beat
    expect(heads(container).length).toBe(1);
    expect(container.querySelector('.status').textContent).toContain('Caixa');
    expect(store.load('a').bars[0].beats[0].cells[0].notes[0].slotId).toBe('snare');
  });

  it('refuses a tap outside the focused beat and says why', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    await tapAt(container, 5.5 * 14 + (300 - 5.5 * 14 - 7) * 0.95, yOf(4, 14)); // far right = last beat, not focused
    expect(heads(container).length).toBe(0);
    expect(container.querySelector('.status').textContent).toContain('não está em foco');
  });

  it('selecting a value subdivides, › walks the cells, delete toggle removes', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByLabelText } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    await fireEvent.click(getByLabelText('Colcheia'));
    expect(store.load('a').bars[0].beats[0].cells.length).toBe(2);
    expect(container.querySelector('.where').textContent).toContain('tempo 1.1');
    await fireEvent.click(getByLabelText('Próxima posição'));
    expect(container.querySelector('.where').textContent).toContain('tempo 1.2');
    const sp = 14, lead = 5.5 * sp;
    const focusedWidth = ((300 - lead - 0.5 * sp) / 5.5) * 2.5;
    await tapAt(container, lead + focusedWidth * 0.75, yOf(-2, sp)); // kick, second cell
    expect(store.load('a').bars[0].beats[0].cells[1].notes[0].slotId).toBe('kick');
    await fireEvent.click(getByLabelText('Apagar'));
    await tapAt(container, lead + focusedWidth * 0.75, yOf(-2, sp));
    expect(store.load('a').bars[0].beats[0].cells[1].notes.length).toBe(0);
    expect(container.querySelector('.status').textContent).toContain('Apagado');
  });

  it('adds a bar and the overview grows', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByLabelText } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    await fireEvent.click(getByLabelText('Adicionar compasso'));
    expect(container.querySelectorAll('.barthumb').length).toBe(2);
    expect(container.querySelector('.where').textContent).toContain('Compasso 2 de 2');
  });
});
