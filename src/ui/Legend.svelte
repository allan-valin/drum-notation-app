<script>
  import Modal from './Modal.svelte';
  import { t } from '../app/prefs.svelte.js';
  import { Glyphs } from '../core/glyphs.js';
  import { Notehead } from '../core/profile.js';
  import { NoteValue } from '../core/noteValue.js';

  import { DRUM_PROFILE } from '../core/profile.js';
  let { onClose, profile = DRUM_PROFILE } = $props();
  const q = NoteValue.QUARTER;
  const head = (h) => Glyphs.notehead(h, q);
  const ROWS = [
    ['cross', head(Notehead.CROSS)],
    ['diamond', head(Notehead.DIAMOND)],
    ['triangle', head(Notehead.TRIANGLE)],
    ['circleX', head(Notehead.CIRCLE_X)],
    ['crossStick', head(Notehead.CROSS)],
    ['slashed', head(Notehead.SLASHED)],
    ['open', Glyphs.OPEN],
    ['closed', Glyphs.CLOSED],
    ['halfOpen', Glyphs.HALF_OPEN],
    ['choke', Glyphs.CHOKE],
    ['buzz', Glyphs.BUZZ],
    ['tremolo', Glyphs.TREMOLO3],
    ['flam', Glyphs.GRACE_SLASH + head(Notehead.NORMAL)],
    ['drag', Glyphs.GRACE + Glyphs.GRACE + head(Notehead.NORMAL)],
    ['ghost', Glyphs.PAREN_LEFT + head(Notehead.NORMAL) + Glyphs.PAREN_RIGHT],
    ['accent', Glyphs.ACCENT],
    ['simile', Glyphs.SIMILE],
    ['repeat', Glyphs.REPEAT_LEFT + '  ' + Glyphs.REPEAT_RIGHT],
    ['sharp', Glyphs.SHARP], ['flat', Glyphs.FLAT], ['natural', Glyphs.NATURAL],
    ['doubleSharp', Glyphs.DOUBLE_SHARP], ['doubleFlat', Glyphs.DOUBLE_FLAT],
    ['staccato', Glyphs.STACCATO], ['tenuto', Glyphs.TENUTO], ['marcato', Glyphs.MARCATO], ['fermata', Glyphs.FERMATA],
    ['congaSlap', head(Notehead.CROSS)],
    ['congaMute', Glyphs.CLOSED],
  ];
  /** Only the symbols this instrument uses, in the profile's order. */
  const rows = $derived(profile.legend.map((id) => ROWS.find(([r]) => r === id)).filter(Boolean));
</script>

<Modal title={t('legend.title')} closeLabel={t('legend.close')} {onClose}>
  <p class="note">{t('legend.note')}</p>
  <table>
    <thead><tr><th>{t('legend.symbol')}</th><th>{t('legend.meaning')}</th><th>{t('legend.also')}</th></tr></thead>
    <tbody>
      {#each rows as [id, glyph]}
        <tr><td class="smufl sym">{glyph}</td><td>{t(`legend.rows.${id}.meaning`)}</td><td class="also">{t(`legend.rows.${id}.also`)}</td></tr>
      {/each}
    </tbody>
  </table>
</Modal>

<style>
  .note { font-size: 14px; color: var(--muted); margin: 0 0 10px; line-height: 1.45; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; font-size: 12px; color: var(--muted); font-weight: 600; padding: 4px 6px; border-bottom: 1px solid var(--line); }
  td { padding: 4px 6px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  .sym { font-size: 30px; line-height: 1; width: 80px; height: 46px; text-align: center; white-space: nowrap; }
  .also { color: var(--muted); }
</style>
