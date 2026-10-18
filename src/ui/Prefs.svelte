<script>
  /** Language pill and the sun/moon theme switch, shown in every header. */
  import { prefs, t, setLang, toggleTheme, effectiveTheme } from '../app/prefs.svelte.js';
  import { LANGS } from '../app/strings.js';

  let { onChange = () => {} } = $props();
  let dark = $state(effectiveTheme() === 'dark');

  function flip() {
    dark = toggleTheme() === 'dark';
    onChange(t('status.theme', { theme: dark ? t('theme.dark') : t('theme.light') }));
  }
  function choose(l) {
    setLang(l);
    onChange(t('status.lang'));
  }
</script>

<div class="prefs">
  <div class="langs" role="group" aria-label={t('lang.choose')}>
    {#each LANGS as l}
      <button class="lang" class:on={prefs.lang === l} aria-pressed={prefs.lang === l} onclick={() => choose(l)}>{t(`lang.${l}`)}</button>
    {/each}
  </div>
  <button class="switch" class:dark role="switch" aria-checked={dark} aria-label={t('theme.toggle')} title={dark ? t('theme.dark') : t('theme.light')} onclick={flip}>
    <span class="icon sun" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v2.5M12 20v2.5M1.5 12h2.5M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/></g></svg>
    </span>
    <span class="icon moon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" fill="currentColor"/></svg>
    </span>
    <span class="knob" aria-hidden="true"></span>
  </button>
</div>

<style>
  .prefs { display: flex; gap: 6px; align-items: center; }
  .langs { display: flex; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; }
  .lang { border: none; border-radius: 0; min-width: 36px; padding: 0 8px; font-size: 13px; font-weight: 600; background: var(--panel); }
  .lang.on { background: var(--accent); color: var(--accent-ink); }
  .switch {
    position: relative; width: 64px; min-width: 64px; height: 32px; min-height: 32px; padding: 0;
    border-radius: 999px; background: #dfe6f3; border: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between;
  }
  .switch.dark { background: #2b3242; }
  .icon { width: 50%; display: flex; justify-content: center; z-index: 1; transition: color 0.2s; }
  .sun { color: #d48a00; }
  .moon { color: #8a93a6; }
  .switch.dark .sun { color: #8a93a6; }
  .switch.dark .moon { color: #f3f0d8; }
  .knob {
    position: absolute; top: 2px; left: 2px; width: 28px; height: 26px; border-radius: 999px;
    background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); transition: transform 0.2s;
  }
  .switch.dark .knob { transform: translateX(32px); background: #11151d; }
</style>
