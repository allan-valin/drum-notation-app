<script>
  /** A sheet over the page; Escape, the close button or a tap outside closes it. */
  let { title, closeLabel, onClose, children } = $props();
  function key(e) { if (e.key === 'Escape') onClose(); }
</script>

<svelte:window onkeydown={key} />
<div class="backdrop" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
    <header><h2>{title}</h2><button onclick={onClose} aria-label={closeLabel}>✕ {closeLabel}</button></header>
    <div class="content">{@render children()}</div>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 20; display: flex; justify-content: center; align-items: flex-start; padding: 16px 8px; overflow-y: auto; background: rgba(0, 0, 0, 0.45); }
  .sheet { width: 100%; max-width: 820px; background: var(--bg); color: var(--ink); border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35); }
  header { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: var(--bg); border-radius: 16px 16px 0 0; }
  h2 { margin: 0; font-size: 19px; }
  .content { padding: 12px 14px 18px; }
</style>
