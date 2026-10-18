<script>
  import { newScore } from '../core/score.js';
  import { encode, decode } from '../core/json.js';
  import { t } from '../app/prefs.svelte.js';
  import Prefs from './Prefs.svelte';

  let { store, onOpen, onPrint, last = null } = $props();
  let items = $state(store.list());
  let status = $state(t('archive.count', { n: store.list().length }));
  let importing = $state(false);
  let importText = $state('');

  const refresh = () => { items = store.list(); };
  const when = (ts) => new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

  function create() {
    const title = prompt(t('archive.newPrompt'), t('archive.newDefault'));
    if (title === null) { status = t('archive.cancelled'); return; }
    const s = newScore({ title: title.trim() || t('app.untitled') });
    store.save(s);
    status = t('archive.created', { title: s.title });
    onOpen(s.id);
  }

  function remove(item) {
    if (!confirm(t('archive.confirmRemove', { title: item.title }))) { status = t('archive.notRemoved'); return; }
    store.remove(item.id);
    refresh();
    status = t('archive.removed', { title: item.title });
  }

  function exportJson(item) {
    const s = store.load(item.id);
    const blob = new Blob([encode(s)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(s.title || 'partitura').replace(/[^\w\-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    status = t('archive.exported', { title: s.title, file: a.download });
  }

  function duplicate(item) {
    const s = store.load(item.id);
    const copy = newScore({ ...s, id: undefined, title: `${s.title} ${t('archive.copySuffix')}`, createdAt: undefined, updatedAt: undefined });
    store.save(copy);
    refresh();
    status = t('archive.duplicated', { title: copy.title });
  }

  function importFromText() {
    try {
      const s = decode(importText);
      const fresh = { ...s, id: store.load(s.id) ? newScore({}).id : s.id };
      store.save(fresh);
      refresh();
      importing = false;
      importText = '';
      status = t('archive.imported', { title: fresh.title || t('app.untitled'), n: fresh.bars.length });
    } catch (e) {
      status = t('archive.importFailed', { error: e.message });
    }
  }

  async function importFile(e) {
    const f = e.target.files?.[0];
    if (!f) { status = t('archive.noFile'); return; }
    importText = await f.text();
    status = t('archive.readFile', { name: f.name, n: importText.length });
    importFromText();
    e.target.value = '';
  }
</script>

<div class="archive">
  <header>
    <div class="top"><h1>{t('archive.heading')}</h1><Prefs onChange={(m) => (status = m)} /></div>
    <p class="intro">{t('welcome.intro')}</p>
    <p class="sub">{t('archive.sub')}</p>
  </header>

  {#if last}
    <button class="continue on" onclick={() => onOpen(last.id)}>{t('welcome.continue', { title: last.title || t('app.untitled') })} ›</button>
    <p class="or">{t('welcome.or')}</p>
  {/if}

  <div class="actions">
    <button class={last ? '' : 'on'} onclick={create}>{t('archive.newScore')}</button>
    <button onclick={() => (importing = !importing)}>{importing ? t('archive.importClose') : t('archive.importOpen')}</button>
    <a class="help" href="https://github.com/allan-valin/drum-notation-app/blob/main/docs/SCORE_IMPORT_PROMPT.md" target="_blank" rel="noopener">{t('archive.importHelp')}</a>
  </div>

  {#if importing}
    <div class="import">
      <label>{t('archive.importFile')} <input type="file" accept="application/json,.json" onchange={importFile} /></label>
      <textarea bind:value={importText} placeholder={t('archive.importPaste')}></textarea>
      <button onclick={importFromText} disabled={!importText.trim()}>{t('archive.importPasted')}</button>
    </div>
  {/if}

  <p class="status" aria-live="polite">{status}</p>

  {#if items.length === 0}
    <p class="empty">{t('archive.empty')}</p>
  {/if}

  <ul>
    {#each items as item (item.id)}
      <li>
        <button class="title" onclick={() => onOpen(item.id)}>
          <strong>{item.title || t('app.untitled')}</strong>
          <span class="meta">{t('archive.bars', { n: item.bars })} · {item.defaultBpm} BPM · {when(item.updatedAt)}</span>
        </button>
        <div class="row">
          <button onclick={() => onOpen(item.id)}>{t('archive.edit')}</button>
          <button onclick={() => onPrint(item.id)}>{t('archive.pdf')}</button>
          <button onclick={() => exportJson(item)}>{t('archive.json')}</button>
          <button onclick={() => duplicate(item)}>{t('archive.duplicate')}</button>
          <button class="danger" onclick={() => remove(item)}>{t('archive.remove')}</button>
        </div>
      </li>
    {/each}
  </ul>
</div>

<style>
  .archive { max-width: 720px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  h1 { font-size: 22px; margin: 0; }
  .top { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
  .sub { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
  .intro { margin: 8px 0 0; font-size: 16px; line-height: 1.45; }
  .continue { font-size: 17px; min-height: 52px; text-align: left; }
  .or { margin: 0; font-size: 13px; color: var(--muted); }
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
