# Platform change: the editor runs in the browser

**Date:** 2026-10-18
**Status:** decided by Allan ("make it like casus where everything works online … possible to use on phone browser")
**Supersedes:** the platform parts (§5 Compose/Canvas, §6 Room/PdfDocument) of
`2026-08-03-score-editor-design.md`. Everything else in that spec stands: data model, interaction
rules, pure layout, open-source only, drums first.

## Why

Casus proved the shape: a static bundle on GitHub Pages, no install, opens on any phone browser,
works offline after the first load. The score editor gets the same. Nothing in the design
needed Android — the pure core was already Android-free by design.

## What changes

| Old (Android) | New (web) | Why |
|---|---|---|
| Kotlin core, JUnit | ES modules, vitest | same purity, same tests, one language |
| Compose `Canvas` | **SVG** in Svelte 5 | crisp on any DPI, hit-testing is a tap on an element, prints natively |
| Bravura.otf asset | `public/fonts/Bravura.woff2` via `@font-face` | same font, SIL OFL, licence in `docs/BRAVURA-LICENSE.txt` |
| Room | `localStorage` (JSON per score) | offline, no backend, no accounts; export/import JSON for backup |
| Android `PdfDocument` | browser **print → PDF** of a multi-bar SVG page | zero deps; the same layout function draws it |
| landscape-locked Activity | landscape *layout* when the viewport is wide; portrait stacks palette below | the browser cannot lock orientation reliably; a landscape prompt is shown on narrow portrait |
| Gradle, emulator | `npm run dev` + phone on the LAN (`--host`), Pages for the live site | |

## What does not change

- Per-beat subdivision, no voice field, cursor never auto-advances, delete is a toggle,
  same-height overwrites, different height adds a simultaneous note.
- `layoutBar(bar, staff, config) → { glyphs, beams, beatBounds }` is a pure function; the
  SVG component only paints it and the print page calls it with `focusedBeat: null`.
- JSON schema with `schema_version`; `docs/SCORE_IMPORT_PROMPT.md` targets it.
- UI text in pt-BR.

## Phone constraints taken on

- Touch targets ≥ 44 px; the staff tap area is the whole SVG, mapped to the nearest slot.
- Offline: a tiny service worker caches the bundle + font after first visit (added once the
  editor works, not before).
- No hover; every state is visible (active palette item, focused beat, delete mode).

## Live site

https://allan-valin.github.io/drum-notation-app/ — built by `.github/workflows/pages.yml`
on every push to `main`, exactly like casus.
