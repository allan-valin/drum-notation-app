<script>
  import Archive from '../ui/Archive.svelte';
  import Editor from '../ui/Editor.svelte';
  import PrintPage from '../ui/PrintPage.svelte';
  import { createStore } from '../core/storage.js';
  import { demoScore } from '../core/demo.js';
  import { initPrefs, t, prefs } from './prefs.svelte.js';

  const store = createStore(window.localStorage);
  initPrefs(store);
  $effect(() => { document.title = t('app.title'); });
  // the page's language follows the chosen one, so long words hyphenate correctly (Unter-teilung)
  $effect(() => { document.documentElement.lang = { pt: 'pt-BR', en: 'en', de: 'de' }[prefs.lang] ?? 'pt-BR'; });

  let route = $state(parse(location.hash));
  function parse(hash) {
    const m = /^#\/(s|print)\/([^/]+)/.exec(hash || '');
    if (m) return { page: m[1] === 's' ? 'editor' : 'print', id: decodeURIComponent(m[2]) };
    return { page: 'welcome' };
  }
  window.addEventListener('hashchange', () => { route = parse(location.hash); });
  const go = (hash) => { location.hash = hash; };

  // behind the welcome overlay: the score last worked on, else a demo groove
  const last = $derived.by(() => {
    route;
    const id = store.loadSettings().lastId;
    const s = id ? store.load(id) : null;
    return s ? { id: s.id, title: s.title } : null;
  });
</script>

{#if route.page === 'editor'}
  {#key route.id}
    <Editor {store} id={route.id} onBack={() => go('#/')} onPrint={() => go(`#/print/${encodeURIComponent(route.id)}`)} />
  {/key}
{:else if route.page === 'print'}
  <PrintPage {store} id={route.id} onBack={() => go(`#/s/${encodeURIComponent(route.id)}`)} />
{:else}
  <div class="behind" inert aria-hidden="true">
    {#key last?.id}
      <Editor {store} id={last?.id ?? 'demo'} fallback={demoScore(t('app.title'))} background onBack={() => {}} onPrint={() => {}} />
    {/key}
  </div>
  <div class="overlay" role="dialog" aria-modal="true" aria-label={t('archive.heading')}>
    <div class="sheet">
      <Archive {store} {last}
        onOpen={(id) => go(`#/s/${encodeURIComponent(id)}`)}
        onPrint={(id) => go(`#/print/${encodeURIComponent(id)}`)} />
    </div>
  </div>
{/if}

<style>
  .behind { filter: blur(2px) saturate(0.6); opacity: 0.35; pointer-events: none; user-select: none; max-height: 100vh; overflow: hidden; }
  .overlay { position: fixed; inset: 0; display: flex; justify-content: center; align-items: flex-start; overflow-y: auto; padding: 24px 12px; background: color-mix(in srgb, var(--bg) 35%, transparent); }
  .sheet { width: 100%; max-width: 720px; background: var(--bg); border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25); }
</style>
