<script>
  import { newScore } from '../core/score.js';
  import { encode, decode } from '../core/json.js';

  let { store, onOpen, onPrint } = $props();
  let items = $state(store.list());
  let status = $state(`${store.list().length} partitura(s) neste navegador`);
  let importing = $state(false);
  let importText = $state('');

  const refresh = () => { items = store.list(); };
  const when = (t) => new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  function create() {
    const title = prompt('Título da partitura', 'Novo exercício');
    if (title === null) { status = 'Criação cancelada'; return; }
    const s = newScore({ title: title.trim() || 'Sem título' });
    store.save(s);
    status = `Criada: ${s.title}`;
    onOpen(s.id);
  }

  function remove(item) {
    if (!confirm(`Apagar "${item.title}"? Não dá para desfazer.`)) { status = 'Nada apagado'; return; }
    store.remove(item.id);
    refresh();
    status = `Apagada: ${item.title}`;
  }

  function exportJson(item) {
    const s = store.load(item.id);
    const blob = new Blob([encode(s)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(s.title || 'partitura').replace(/[^\w\-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    status = `Exportada: ${s.title} (${a.download})`;
  }

  function duplicate(item) {
    const s = store.load(item.id);
    const copy = newScore({ ...s, id: undefined, title: `${s.title} (cópia)`, createdAt: undefined, updatedAt: undefined });
    store.save(copy);
    refresh();
    status = `Duplicada: ${copy.title}`;
  }

  function importFromText() {
    try {
      const s = decode(importText);
      const fresh = { ...s, id: store.load(s.id) ? newScore({}).id : s.id };
      store.save(fresh);
      refresh();
      importing = false;
      importText = '';
      status = `Importada: ${fresh.title || 'sem título'} (${fresh.bars.length} compasso(s))`;
    } catch (e) {
      status = `Importação falhou: ${e.message}`;
    }
  }

  async function importFile(e) {
    const f = e.target.files?.[0];
    if (!f) { status = 'Nenhum arquivo escolhido'; return; }
    importText = await f.text();
    status = `Lido ${f.name} (${importText.length} caracteres)`;
    importFromText();
    e.target.value = '';
  }
</script>

<div class="archive">
  <header>
    <h1>Partituras de bateria</h1>
    <p class="sub">Tudo fica neste navegador. Exporte em JSON para guardar ou levar a outro aparelho.</p>
  </header>

  <div class="actions">
    <button class="on" onclick={create}>+ Nova partitura</button>
    <button onclick={() => (importing = !importing)}>{importing ? 'Fechar importação' : 'Importar JSON'}</button>
    <a class="help" href="https://github.com/allan-valin/drum-notation-app/blob/main/docs/SCORE_IMPORT_PROMPT.md" target="_blank" rel="noopener">Como importar de uma foto</a>
  </div>

  {#if importing}
    <div class="import">
      <label>Arquivo .json <input type="file" accept="application/json,.json" onchange={importFile} /></label>
      <textarea bind:value={importText} placeholder={'ou cole o JSON aqui'}></textarea>
      <button onclick={importFromText} disabled={!importText.trim()}>Importar o texto colado</button>
    </div>
  {/if}

  <p class="status" aria-live="polite">{status}</p>

  {#if items.length === 0}
    <p class="empty">Nenhuma partitura ainda. Crie uma nova ou importe um JSON.</p>
  {/if}

  <ul>
    {#each items as item (item.id)}
      <li>
        <button class="title" onclick={() => onOpen(item.id)}>
          <strong>{item.title || 'Sem título'}</strong>
          <span class="meta">{item.bars} compasso{item.bars === 1 ? '' : 's'} · {item.defaultBpm} BPM · {when(item.updatedAt)}</span>
        </button>
        <div class="row">
          <button onclick={() => onOpen(item.id)}>Editar</button>
          <button onclick={() => onPrint(item.id)}>PDF</button>
          <button onclick={() => exportJson(item)}>JSON</button>
          <button onclick={() => duplicate(item)}>Duplicar</button>
          <button class="danger" onclick={() => remove(item)}>Apagar</button>
        </div>
      </li>
    {/each}
  </ul>
</div>

<style>
  .archive { max-width: 720px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  h1 { font-size: 22px; margin: 0; }
  .sub { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .help { font-size: 14px; color: var(--accent); }
  .import { display: flex; flex-direction: column; gap: 8px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px; }
  .status { font-size: 14px; color: var(--muted); margin: 0; min-height: 1.4em; }
  .empty { color: var(--muted); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  li { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 10px; display: flex; flex-direction: column; gap: 8px; }
  .title { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; border: none; background: none; padding: 4px; text-align: left; }
  .meta { font-size: 13px; color: var(--muted); }
  .row { display: flex; flex-wrap: wrap; gap: 6px; }
  .danger { color: var(--danger); }
</style>
