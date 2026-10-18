# Partitura de bateria

A phone-first drum notation editor that runs in the browser. One beat is in focus and drawn
large; `‹` `›` move through beats and their subdivisions; picking a note value in the palette
subdivides the focused beat; tapping the staff places a hit at the nearest instrument, and
tapping another height in the same cell adds a simultaneous one. Hollow versus filled
noteheads, beams, flags, rests and tuplets are drawn for you, which is the whole point:
entering a bar must be faster than writing it on paper.

Live: https://allan-valin.github.io/drum-notation-app/ — nothing to install, works offline
after the first load, scores stay in the browser (export JSON to back them up).

- Design: `docs/superpowers/specs/2026-08-03-score-editor-design.md`
- Web platform decision: `docs/superpowers/specs/2026-10-18-web-platform.md`
- Plan and checklist: `docs/superpowers/plans/2026-10-18-v1-web-editor.md`
- Import from a photo via an AI assistant: `docs/SCORE_IMPORT_PROMPT.md`

## Development

Requires Node 20+.

```bash
npm ci
npm test                 # vitest: the pure core (model, editing, layout, JSON) and jsdom smoke tests
npm run dev              # http://localhost:5173, also on the LAN for a phone
npm run build            # static bundle in dist/
```

`src/core/` has no DOM or Svelte imports: engraving is a pure function from a bar to glyph
positions, so it is unit-tested and the print page uses the very same layout as the editor.

The music font is [Bravura](https://github.com/steinbergmedia/bravura) (SIL Open Font License,
`docs/BRAVURA-LICENSE.txt`).
