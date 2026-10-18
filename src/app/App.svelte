<script>
  import Archive from '../ui/Archive.svelte';
  import Editor from '../ui/Editor.svelte';
  import PrintPage from '../ui/PrintPage.svelte';
  import { createStore } from '../core/storage.js';

  const store = createStore(window.localStorage);

  let route = $state(parse(location.hash));
  function parse(hash) {
    const m = /^#\/(s|print)\/([^/]+)/.exec(hash || '');
    if (m) return { page: m[1] === 's' ? 'editor' : 'print', id: decodeURIComponent(m[2]) };
    return { page: 'archive' };
  }
  window.addEventListener('hashchange', () => { route = parse(location.hash); });
  const go = (hash) => { location.hash = hash; };
</script>

{#if route.page === 'editor'}
  <Editor {store} id={route.id} onBack={() => go('#/')} onPrint={() => go(`#/print/${encodeURIComponent(route.id)}`)} />
{:else if route.page === 'print'}
  <PrintPage {store} id={route.id} onBack={() => go(`#/s/${encodeURIComponent(route.id)}`)} />
{:else}
  <Archive {store} onOpen={(id) => go(`#/s/${encodeURIComponent(id)}`)} onPrint={(id) => go(`#/print/${encodeURIComponent(id)}`)} />
{/if}
