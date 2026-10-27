// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import Editor from '../../src/ui/Editor.svelte';
import { createStore } from '../../src/core/storage.js';
import { newScore } from '../../src/core/score.js';
import { Glyphs } from '../../src/core/glyphs.js';
import { NoteValue } from '../../src/core/noteValue.js';
import { yOf } from '../../src/core/layout.js';
import { partView } from '../../src/core/parts.js';

const loadView = (store, id) => { const f = store.load(id); return partView(f, f.parts[0].id); };

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
const spOf = (container) => Number(container.querySelectorAll('.stage .staffline')[1].getAttribute('y1'));
// a tap is a press and a release in place (a press that is held picks the note up to drag it)
const tapAt = async (container, x, y) => {
  const svg = container.querySelector('.stage svg');
  await fireEvent.pointerDown(svg, { clientX: x, clientY: y });
  await fireEvent.pointerUp(svg, { clientX: x, clientY: y });
};

describe('Editor', () => {
  it('places a snare on tap inside the focused beat and reports it', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    const svg = container.querySelector('.stage svg');
    const sp = spOf(container); // jsdom reports clientWidth 0 → the editor clamps to its 300 px minimum
    const lead = 5.5 * sp; // clef + time signature
    expect(heads(container).length).toBe(0);
    await tapAt(container, lead + 20, yOf(5, sp)); // snare line, first (focused) beat
    expect(heads(container).length).toBe(1);
    expect(container.querySelector('.status').textContent).toContain('Caixa');
    expect(loadView(store, 'a').bars[0].beats[0].cells[0].notes[0].slotId).toBe('snare');
  });

  it('a tap on another beat selects it; a second tap on it places the note', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    const sp = spOf(container);
    await tapAt(container, 5.5 * sp + (300 - 6 * sp) * 0.95, yOf(5, sp)); // far right = last beat
    expect(loadView(store, 'a').bars[0].beats[3].cells[0].notes).toEqual([]);
    expect(container.querySelector('.status').textContent).toContain('Toque de novo');
    const stage = container.querySelector('.stage svg');
    const cards = [...stage.querySelectorAll('rect.card')];
    const last = cards[3];
    await tapAt(container, Number(last.getAttribute('x')) + Number(last.getAttribute('width')) / 2, yOf(5, sp));
    expect(loadView(store, 'a').bars[0].beats[3].cells[0].notes[0].slotId).toBe('snare');
    expect(container.querySelector('.where').textContent).toContain('4');
  });

  it('selecting a value subdivides, › walks the cells, delete toggle removes', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByLabelText } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    await fireEvent.click(getByLabelText('Colcheia'));
    expect(loadView(store, 'a').bars[0].beats[0].cells.length).toBe(2);
    expect(container.querySelector('.where').textContent).toContain('tempo 1.1');
    await fireEvent.click(getByLabelText('Próxima posição'));
    expect(container.querySelector('.where').textContent).toContain('tempo 1.2');
    const sp = spOf(container), lead = 5.5 * sp;
    const focusedWidth = ((300 - lead - 0.5 * sp) / 5.5) * 2.5;
    await tapAt(container, lead + focusedWidth * 0.75, yOf(1, sp)); // kick, second cell
    expect(loadView(store, 'a').bars[0].beats[0].cells[1].notes[0].slotId).toBe('kick');
    await fireEvent.click(getByLabelText('Apagar'));
    await tapAt(container, lead + focusedWidth * 0.75, yOf(1, sp));
    expect(loadView(store, 'a').bars[0].beats[0].cells[1].notes.length).toBe(0);
    expect(container.querySelector('.status').textContent).toContain('Apagado');
  });

  it('adding a bar shows it in the full score, selects it and says so', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByLabelText } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    expect(container.querySelectorAll('.full .frame').length).toBe(1);
    await fireEvent.click(getByLabelText('Adicionar compasso no fim'));
    expect(container.querySelectorAll('.full .frame').length).toBe(2);
    expect(container.querySelector('.full .frame.current').getAttribute('aria-label')).toContain('2');
    expect(container.querySelector('.where').textContent).toContain('Compasso 2 de 2');
    expect(container.querySelector('.status').textContent).toContain('Compasso 2 adicionado');
  });

  it('time signature picker changes the current bar', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByLabelText, getByText } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    await fireEvent.click(getByLabelText('Mudar a fórmula de compasso deste compasso'));
    const [num] = container.querySelectorAll('.picker select');
    await fireEvent.change(num, { target: { value: '3' } });
    await fireEvent.click(getByText('Aplicar'));
    expect(loadView(store, 'a').bars[0].beats.length).toBe(3);
    expect(container.querySelector('.status').textContent).toContain('3/4');
  });

  it('Célula mode splits only the selected cell', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { getByLabelText, getByRole } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    await fireEvent.click(getByLabelText('Colcheia'));
    await fireEvent.click(getByLabelText('Próxima posição'));
    await fireEvent.click(getByRole('radio', { name: 'Célula' }));
    await fireEvent.click(getByLabelText('Semicolcheia'));
    const beat = loadView(store, 'a').bars[0].beats[0];
    expect(beat.cells[0].notes).toEqual([]);
    expect(beat.cells[1].cells.length).toBe(2);
  });
});

describe('legend and help overlays', () => {
  it('the legend lists every symbol with its default and alternatives', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { getByLabelText, getByRole, queryByRole } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    await fireEvent.click(getByLabelText('Legenda dos símbolos'));
    const dialog = getByRole('dialog', { name: 'Legenda dos símbolos' });
    expect(dialog.querySelectorAll('tbody tr').length).toBe(23);
    expect(dialog.textContent).toContain('Outros autores usam para');
    await fireEvent.click(getByLabelText('Fechar'));
    expect(queryByRole('dialog')).toBeNull();
  });
  it('help shows its sections with drawn examples', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { getByLabelText, getByRole } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    await fireEvent.click(getByLabelText('Como usar'));
    const dialog = getByRole('dialog', { name: 'Como usar' });
    expect(dialog.querySelectorAll('section').length).toBe(8);
    expect(dialog.querySelectorAll('figure svg').length).toBe(3);
  });
  it('a technique toggle rides on the next note', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByLabelText } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    await fireEvent.click(getByLabelText('Aberto'));
    expect(container.querySelector('.status').textContent).toContain('Próximas notas: Aberto');
    const sp = spOf(container);
    await tapAt(container, 5.5 * sp + 20, yOf(8, sp));
    expect(loadView(store, 'a').bars[0].beats[0].cells[0].notes[0]).toMatchObject({ slotId: 'hihat', marks: ['open'] });
  });
});

describe('play mode', () => {
  function fakeAudio() {
    const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
    const node = () => ({ connect(n) { return n; }, start() {}, stop() {}, frequency: param(), Q: param(), gain: param(), playbackRate: param(), threshold: param(), ratio: param() });
    return class { constructor() { this.currentTime = 0; this.sampleRate = 8000; this.destination = node(); }
      createGain() { return node(); } createDynamicsCompressor() { return node(); } createBiquadFilter() { return node(); }
      createOscillator() { return node(); } createBufferSource() { return node(); }
      createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; } resume() {} close() {} };
  }
  it('a selection made in the full score plays, locks editing, and stops', async () => {
    window.AudioContext = fakeAudio();
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByLabelText, getByRole } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    await fireEvent.click(getByLabelText('Adicionar compasso no fim'));
    await fireEvent.click(getByLabelText('Adicionar compasso no fim'));
    await fireEvent.click(getByLabelText('Selecionar compassos'));
    expect(getByRole('radio', { name: 'Seleção' }).getAttribute('aria-checked')).toBe('true');
    await fireEvent.click(getByLabelText('Ir ao compasso 2'));
    await fireEvent.click(getByLabelText('Ir ao compasso 3'));
    expect(container.querySelector('.status').textContent).toContain('Seleção: compassos 2–3');
    expect(container.querySelectorAll('.full .frame.inrange').length).toBe(2);
    await fireEvent.click(getByLabelText('Tocar'));
    expect(container.querySelector('.status').textContent).toContain('Tocando compassos 2–3');
    const pal = () => container.querySelector('.palette-area .palette-scroll');
    expect(pal().inert === true || pal().hasAttribute('inert')).toBe(true);
    expect(pal().classList.contains('locked')).toBe(true);
    await fireEvent.click(getByLabelText('Próxima posição'));
    expect(container.querySelector('.status').textContent).toContain('pare para editar');
    await fireEvent.click(getByLabelText('Parar'));
    expect(container.querySelector('.status').textContent).toContain('Parado');
    expect(pal().inert === true || pal().hasAttribute('inert')).toBe(false);
    delete window.AudioContext;
  });
});

describe('symbol only, in the page', () => {
  it('adds an accent to an existing note without writing a new one', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByLabelText, getByRole } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    const sp = spOf(container);
    await tapAt(container, 5.5 * sp + 20, yOf(5, sp));
    await fireEvent.click(getByRole('radio', { name: 'Só símbolo' }));
    await fireEvent.click(getByLabelText('Acento'));
    await tapAt(container, 5.5 * sp + 20, yOf(5, sp));
    const notes = loadView(store, 'a').bars[0].beats[0].cells[0].notes;
    expect(notes.length).toBe(1);
    expect(notes[0].articulations).toEqual(['accent']);
    expect(container.querySelector('.status').textContent).toContain('Símbolos postos');
  });
});

describe('moving bars', () => {
  it('the arrows move the selected bars and the selection follows them', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByLabelText } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    const sp = spOf(container);
    await tapAt(container, 5.5 * sp + 20, yOf(1, sp)); // kick in bar 1
    await fireEvent.click(getByLabelText('Adicionar compasso no fim'));
    await fireEvent.click(getByLabelText('Adicionar compasso no fim'));
    await fireEvent.click(getByLabelText('Selecionar compassos'));
    await fireEvent.click(getByLabelText('Ir ao compasso 1'));
    await fireEvent.click(getByLabelText('Mover a seleção um compasso para a direita'));
    await fireEvent.click(getByLabelText('Mover a seleção um compasso para a direita'));
    const bars = loadView(store, 'a').bars;
    expect(bars[2].beats[0].cells[0].notes[0].slotId).toBe('kick');
    expect(bars[0].beats[0].cells[0].notes).toEqual([]);
    expect(container.querySelector('.status').textContent).toContain('agora 3–3');
    await fireEvent.click(getByLabelText('Mover a seleção um compasso para a direita'));
    expect(container.querySelector('.status').textContent).toContain('já está na ponta');
    expect(container.querySelectorAll('.full .frame.inrange').length).toBe(1);
  });
});

describe('silent practice', () => {
  it('Sem som mutes the drums but keeps the metronome and the playhead', async () => {
    const made = { osc: 0, src: 0 };
    const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
    const node = () => ({ connect(n) { return n; }, start() {}, stop() {}, frequency: param(), Q: param(), gain: param(), playbackRate: param(), threshold: param(), ratio: param() });
    window.AudioContext = class { constructor() { this.currentTime = 0; this.sampleRate = 8000; this.destination = node(); }
      createGain() { return node(); } createDynamicsCompressor() { return node(); } createBiquadFilter() { return node(); }
      createOscillator() { made.osc++; return node(); } createBufferSource() { made.src++; return node(); }
      createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; } decodeAudioData() { return Promise.reject(new Error('no')); } resume() {} close() {} };
    globalThis.fetch ??= async () => ({ ok: false, status: 404 });
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByLabelText, getByRole, getByText } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    const sp = spOf(container);
    await tapAt(container, 5.5 * sp + 20, yOf(1, sp)); // a kick on beat 1, sounding right at the start
    await fireEvent.click(getByRole('radio', { name: 'Sem som' }));
    expect(store.loadSettings().sound).toBe('none');
    await fireEvent.click(getByText('Metrônomo'));
    await fireEvent.click(getByLabelText('Tocar'));
    expect(container.querySelector('.status').textContent).toContain('Sem som');
    expect(made.osc).toBeGreaterThan(0); // the metronome click
    expect(made.src).toBe(0);            // no drum noise, no sample
    await fireEvent.click(getByLabelText('Parar'));
    delete window.AudioContext;
  });
});

describe('metronome sound', () => {
  it('the dropdown lists every voice, remembers the choice and says it', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByLabelText } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    const select = getByLabelText('Som do metrônomo');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Bipe', 'Bloco de madeira', 'Clique', 'Cowbell', 'Aro (cross-stick)', 'Chimbal fechado']);
    await fireEvent.change(select, { target: { value: 'woodblock' } });
    expect(store.loadSettings().metronomeVoice).toBe('woodblock');
    expect(container.querySelector('.status').textContent).toContain('Metrônomo: Bloco de madeira');
  });
});

describe('instruments', () => {
  it('adding congas switches the palette to conga tools only, and the full score stacks both parts', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByText, getByLabelText, queryByLabelText } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    expect(getByLabelText('Losango')).toBeTruthy();
    await fireEvent.click(getByText('+ Adicionar instrumento'));
    expect(container.querySelector('.status').textContent).toContain('Congas adicionado');
    const select = getByLabelText('Instrumento');
    expect([...select.options].filter((o) => !o.value.startsWith('add:')).map((o) => o.textContent)).toEqual(['Bateria', 'Congas']);
    expect(select.value).toBe(store.load('a').parts[1].id);
    expect(queryByLabelText('Losango')).toBeNull();      // drum-only head gone from the palette
    expect(queryByLabelText('Aberto')).toBeNull();       // hi-hat technique gone
    expect(getByLabelText('Slap')).toBeTruthy();         // conga name for the X head
    expect(getByLabelText('Abafado')).toBeTruthy();
    expect(getByLabelText('Mão direita')).toBeTruthy();  // hands stay
    expect(container.querySelectorAll('.full .frame')[0].querySelectorAll('.staff').length).toBe(2);
    await fireEvent.change(select, { target: { value: 'p1' } });
    expect(getByLabelText('Losango')).toBeTruthy();      // back on drums, everything is back
  });
  it('a conga note lands in the conga part only', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByText } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    await fireEvent.click(getByText('+ Adicionar instrumento'));
    const sp = spOf(container);
    await tapAt(container, 5.5 * sp + 20, yOf(5, sp));
    const full = store.load('a');
    expect(partView(full, full.parts[1].id).bars[0].beats[0].cells[0].notes[0].slotId).toBe('conga');
    expect(partView(full, 'p1').bars[0].beats[0].cells[0].notes).toEqual([]);
  });
  it('changing the instrument of a written part asks first', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByLabelText } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    const sp = spOf(container);
    await tapAt(container, 5.5 * sp + 20, yOf(1, sp));
    window.confirm = () => false;
    await fireEvent.change(getByLabelText('Instrumento 1'), { target: { value: 'congas' } });
    expect(store.load('a').parts[0].instrument).toBe('drums');
    window.confirm = () => true;
    await fireEvent.change(getByLabelText('Instrumento 1'), { target: { value: 'congas' } });
    expect(store.load('a').parts[0].instrument).toBe('congas');
  });
});

describe('a pitched instrument in the page', () => {
  it('keyboard: accidentals instead of drum tools, pitch names in the status, key picker', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByText, getByLabelText, queryByLabelText } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    await fireEvent.click(getByText('+ Adicionar instrumento'));
    await fireEvent.change(getByLabelText('Instrumento 2'), { target: { value: 'keys' } });
    expect(getByLabelText('Instrumento').selectedOptions[0].textContent).toBe('Teclado');
    expect(getByLabelText('Sustenido')).toBeTruthy();
    expect(getByLabelText('Staccato')).toBeTruthy();
    expect(queryByLabelText('Mão direita')).toBeNull();
    expect(queryByLabelText('Losango')).toBeNull();
    await fireEvent.change(getByLabelText('Armadura de clave deste compasso em diante'), { target: { value: '2' } });
    expect(container.querySelector('.status').textContent).toContain('Ré maior');
    const sp = spOf(container);
    const keyW = 2 * 1.0 + 0.6; // two sharps
    await tapAt(container, (5.5 + keyW) * sp + 20, yOf(1, sp)); // F4 line-space: position 1
    expect(container.querySelector('.status').textContent).toContain('Fá♯4');
    const full = store.load('a');
    expect(partView(full, full.parts[1].id).bars[0].beats[0].cells[0].notes[0]).toMatchObject({ slotId: 'F4', alter: 1 });
  });
});

describe('round 4', () => {
  it('a new instrument can be added from the Editing dropdown, and is opened for writing', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { getByLabelText } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    const sel = getByLabelText('Instrumento');
    await fireEvent.change(sel, { target: { value: 'add:violin' } });
    const full = store.load('a');
    expect(full.parts.map((p) => p.instrument)).toEqual(['drums', 'violin']);
    expect(getByLabelText('Instrumento').value).toBe(full.parts[1].id);
    expect(getByLabelText('Instrumento 2').value).toBe('violin'); // and it is in the band list
  });
  it('"This instrument only" moves just the edited part', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container, getByLabelText, getByText } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    const sp = spOf(container);
    await tapAt(container, 5.5 * sp + 20, yOf(1, sp)); // kick in bar 1 (drums)
    await fireEvent.click(getByLabelText('Adicionar compasso no fim'));
    await fireEvent.click(getByText('+ Adicionar instrumento'));            // congas, now being edited
    await fireEvent.change(getByLabelText('Instrumento'), { target: { value: 'p1' } }); // back to drums
    await fireEvent.click(getByLabelText('Selecionar compassos'));
    await fireEvent.click(getByLabelText('Só este instrumento'));
    await fireEvent.click(getByLabelText('Ir ao compasso 1'));
    await fireEvent.click(getByLabelText('Mover a seleção um compasso para a direita'));
    const full = store.load('a');
    expect(partView(full, 'p1').bars[1].beats[0].cells[0].notes[0].slotId).toBe('kick');
    expect(full.bars.length).toBe(2);
  });

  it('the palette sidebar folds away with « and comes back with » where it was scrolled to', async () => {
    const store = createStore(memoryStorage());
    store.save(newScore({ id: 'a', title: 'T' }));
    const { container } = render(Editor, { store, id: 'a', onBack: () => {}, onPrint: () => {} });
    const aside = container.querySelector('.palette-area');
    const scroller = aside.querySelector('.palette-scroll');
    let top = 0; // jsdom does not scroll: a plain property stands in
    Object.defineProperty(scroller, 'scrollTop', { get: () => top, set: (v) => (top = v), configurable: true });
    const toggle = aside.querySelector('.palette-toggle');
    expect(toggle.textContent.trim()).toBe('«');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    top = 420;
    await fireEvent.click(toggle);
    expect(aside.classList.contains('collapsed')).toBe(true);
    expect(toggle.textContent.trim()).toBe('»');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    top = 0; // display: none drops the scroll position in a real browser
    await fireEvent.click(toggle);
    expect(aside.classList.contains('collapsed')).toBe(false);
    expect(top).toBe(420);
  });
});
