# Partitura de bateria

A phone-first drum notation editor that runs in the browser. One beat is in focus and drawn
large; `‹` `›` move through beats and their subdivisions; picking a note value in the palette
subdivides the focused beat; tapping the staff places a hit at the nearest instrument, and
tapping another height in the same cell adds a simultaneous one. Hollow versus filled
noteheads, beams, flags, rests and tuplets are drawn for you, which is the whole point:
entering a bar must be faster than writing it on paper.

Live: https://allan-valin.github.io/drum-notation-app/ — nothing to install, works offline
after the first load, scores stay in the browser (export JSON to back them up). pt-BR, English
and German; light and dark.

Also: cells split further one at a time ("Cell" mode), time signature per bar, `%` and repeat
barlines, drum noteheads and technique marks with a legend of what other authors use them for,
a help overlay with examples, and playback (this bar, from the start, from here, or a looped
selection) with a recorded kit or a synthesized one.

Beyond drums: 42 instruments in one score, each with its own synthesized sound — rock band,
choir (SATB with lyrics), jazz (transposing horns, chord symbols, rhythm slashes, swing),
orchestra (strings, winds, brass, percussion, piano and harp on braced staves), Arabic music
(quarter tones, maqam key signatures, oud, qanun, ney, darbuka) and Japanese instruments on a
Western staff (koto, shamisen, shakuhachi, taiko). Plan: `docs/superpowers/plans/2026-10-18-instruments.md`.

- Design: `docs/superpowers/specs/2026-08-03-score-editor-design.md`
- Web platform decision: `docs/superpowers/specs/2026-10-18-web-platform.md`
- Plan and checklist: `docs/superpowers/plans/2026-10-18-v1-web-editor.md`
- Import from a photo via an AI assistant: `docs/SCORE_IMPORT_PROMPT.md`
- Feedback round 1 (theme, languages, nesting, symbols, playback): `docs/superpowers/plans/2026-10-18-feedback-round-1.md`
- Sounds and their licence: `docs/SOUNDS.md`

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
`docs/BRAVURA-LICENSE.txt`). The recorded drums are Hydrogen's GMRockKit (GPL v3 or later,
`docs/SOUNDS.md`).
