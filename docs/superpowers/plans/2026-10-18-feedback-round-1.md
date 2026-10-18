# Feedback round 1 — implementation plan

**Date:** 2026-10-18, after Allan's first session on the live site.
**Status:** approved by Allan ("free choice" on order and details; synth sound first, samples
second, open licence only). Resume from the first unchecked checkpoint; each checkpoint is one
commit + push and leaves the site working.

Rules carried over: TDD on `src/core/` (test first, red, green), jsdom smoke on components,
headless phone shots (800×360, 390×844) before push, pt-BR/EN/DE for every string, every
action writes a status line, open-source only.

## Allan's feedback, verbatim intent → decision

| # | Feedback | Decision |
|---|---|---|
| F1 | Notes black on dark background, lines white; add light/dark toggle with sun/moon | Default colour of whole/half/quarter = theme ink; toggle in header, persisted |
| F2 | pt-BR, English, German | `src/app/i18n.js`, language pill, browser default, persisted |
| F3 | Archive hides the editor; make it an overlay over a faded editor | `#/` = editor + modal welcome overlay; "‹ Arquivo" reopens |
| F4 | `+` / `−` mean nothing; adding a bar shows nothing | Labelled buttons in a bar row under the big editor; new bar selected + scrolled + status |
| F5 | Palette needs labels | Group headings + short label per button |
| F6 | Full score like the PDF, bigger, 2 bars per row, always visible, click loads bar | Replaces the collapsed `<details>` |
| F7 | Tapping another section should select it and place the note | Tap = goTo + place with current tool |
| F8 | Time signature changeable, **per bar** | `bar.timeSig` nullable, inherits from previous |
| F9 | Sections need shades + borders; selected one distinct | Beat cards in the big editor |
| F10 | `%` ditto, `\|\|:` `:\|\|` repeats | `bar.simile`, `bar.repeatStart`, `bar.repeatEnd` |
| F11 | Finer subdivision: split only the focused cell, with an explicit toggle | Nested cell tree + "Tempo / Célula" toggle |
| F12 | Missing noteheads and technique marks (diamond, triangle, open hi-hat circle…) | `note.head`, `note.marks`, `note.roll`, `note.grace`; legend overlay |
| F13 | Playback: current bar, from start, from selected bar, selected range on loop; real-ish drum sounds | Web Audio, synth kit first, CC0 samples second |
| F14 | Legend overlay from the left toolbar; "?" help overlay with examples, per language; list defaults **and** alternatives per author | Two overlays, content in i18n |

## Checkpoints

### C1 — theme, languages, labels (small) — [x] 2026-10-18

- [x] `src/core/colours.js`: `DEFAULT_COLOURS.whole/half/quarter = 'ink'`; `colourFor` returns
  `'currentColor'` for `'ink'`. Test: default quarter is ink, eighth is not.
- [x] `src/app/theme.js`: `applyTheme('light'|'dark'|'system')` sets `data-theme` on `<html>`;
  stored in settings. Header pill: sun/moon inline SVG, three states collapse to a 2-way
  toggle (tap flips light/dark; system default only until first tap).
- [x] `src/app/i18n.js`: `t(key, params)`, tables `pt`, `en`, `de`; keys for UI, note value
  names, instrument names, status lines, help and legend text. `lang` store persisted, default
  from `navigator.language` (pt* → pt, de* → de, else en). Header pill PT · EN · DE.
  Test: every key present in all three tables (one test that diffs key sets).
- [x] Palette: headings (Figura · Quiáltera · Articulação · Mão · Edição) + label under each
  button; headings and labels via `t()`.
- [x] Print page stays light regardless of theme.

### C2 — nested subdivision + per-bar time signature (large, the core pass) — [x] 2026-10-18

Done: model, tree helpers, cursor paths, splitCell/splitBeat/mergeCell, setTimeSig with
inheritance, simile/repeat flags, nested beaming with stubs, layout over the tree with `%` and
repeat barlines, JSON v2 (v1 still read), reducer (`tapAt`, `setSplitMode`, `merge`, bar marks,
`refused` reasons), import prompt v2. The UI for the toggle and bar row is C3.

Model (`src/core/score.js`), schema v2:

```
Bar   { beats[], timeSig: [num, den] | null, simile: bool, repeatStart: bool, repeatEnd: bool }
Beat  = Group at the root, its duration = one beat of the bar's signature
Group { division: NoteValue, tuplet: int|null, cells: (Leaf | Group)[] }
Leaf  { notes: Note[] }
Note  { slotId, articulations[], sticking, head: Head|null, marks: Mark[], roll: Roll|null, grace: Grace|null }
```

- A group's cells all have equal duration: `groupDuration / cells.length`.
- The effective written value of a leaf = `division` of its parent group.
- Cursor = `{ bar, path: int[] }`, `path[0]` is the beat, the rest descends groups to a leaf.
- `‹ ›` walk leaves depth-first; `goTo` clamps to the nearest leaf.
- Ticks: recursive, PPQ 960 still divides every nesting used in practice (2, 3, 4, 5, 6, 8 at
  each level); assert integer ticks in tests and round otherwise.
- Beaming: beam level of a leaf = flags of its effective value; a beam at level L spans the
  run of consecutive sounding leaves whose level ≥ L inside the same beat. This gives the
  textbook picture: eighth beat with a sixteenth pair = one long beam + one short beam.
- Layout: recursive widths; a group's cells split its width equally. Tuplet digit per group.
- JSON v2: a cell is `[]`, `["kick", …]`, `{ "notes": [...] }`, or
  `{ "division": "sixteenth", "tuplet": 3, "cells": [...] }`. Bars accept `timeSig`,
  `simile`, `repeatStart`, `repeatEnd`. v1 files still decode (flat cells → leaves). Notes
  accept `head`, `marks`, `roll`, `grace`.
- Edit actions: `splitCell(cursor, value, tuplet)` (only the focused leaf; refused if value ≥
  leaf's value), `splitBeat(cursor, value, tuplet)` (today's `subdivide`, flattens the beat),
  `setTimeSig(bar, [n, d] | null)` (append empty beats / truncate; truncation is confirmed in
  the UI, undo covers it), `toggleSimile(bar)`, `toggleRepeatStart(bar)`, `toggleRepeatEnd(bar)`.
- Reducer: `tool.splitMode: 'beat' | 'cell'`; `selectValue` dispatches to one of the two.
  Tap on a non-focused cell = goTo then place. Status lines for all of it.
- Import prompt doc updated to v2 with one nested example and one time-signature change.

Tests to write first (names): `nested.test.js` (group durations, leaf walk order, ticks of a
sixteenth pair inside an eighth beat = [0, 480, 720], refusal of a longer value in cell mode),
`beaming.test.js` additions (eighth+two sixteenths → beams [[0,2] level 1, [1,2] level 2]),
`layout.test.js` additions (nested widths, time signature drawn only at a change),
`json.test.js` (v2 round trip, v1 import), `edit.test.js` (setTimeSig append/truncate, simile,
repeats).

### C3 — editor surface (medium) — [ ]

- [ ] Big editor: one card per beat (alternating shade, 1 px border); selected card = accent
  border + warm fill; selected leaf = stronger fill. Time signature shown when the bar sets one.
- [ ] Bar row between big editor and full score: `+ compasso`, `− compasso`, `Fórmula 4/4`
  (picker num 1–12, den 2/4/8/16), `% repetir`, `||:`, `:||`, all labelled, all with status.
- [ ] Full score: PDF look, 2 bars per row ≥ 700 px, 1 below; staff spacing ~2× today; current
  bar framed; click loads it; new bar scrolls into view. Simile draws the `%` glyph on the
  middle line and hides cells; repeat barlines drawn.
- [ ] Toggle "Tempo | Célula" beside the figures, with a one-line explanation under it.
- [ ] Welcome overlay on `#/`: title, one sentence, Nova partitura, list, import, language and
  theme pills; editor faded behind. `‹ Arquivo` reopens.

### C4 — noteheads, marks, legend, help (medium) — [ ]

Defaults shipped (PAS/Weinberg), with alternatives named in the legend because books differ:

| Symbol | Default meaning | Also used for |
|---|---|---|
| X head | closed hi-hat, ride, crash | any cymbal |
| diamond head | ride bell / cymbal bell | hi-hat bell, china (some books) |
| triangle head | cowbell | bell, wood block |
| circled X head | china | splash, stacked cymbals |
| X on the snare line | cross-stick (rim click) | side stick |
| slashed head | rimshot | stick shot |
| ○ above | open hi-hat | open cymbal, let ring |
| + above | closed hi-hat | choke in some jazz charts |
| ø above | half-open hi-hat | loose hi-hat |
| ' above (choke) | cymbal choke | — |
| 3 strokes on the stem | buzz / press roll | single-stroke tremolo (books mark with z) |
| small grace head | flam; two heads = drag | ruff |

- [ ] Glyph table additions, each codepoint verified against SMuFL `glyphnames.json` at
  implementation time (`noteheadDiamondBlack`, `noteheadTriangleUpBlack`, `noteheadCircleX`,
  `noteheadSlashedBlack1`, `brassMuteOpen`, `brassMuteClosed`, `brassMuteHalfClosed`,
  `articLaissezVibrer`/choke, `tremolo3`, `buzzRoll`, `graceNoteSlashStemUp`).
- [ ] Palette groups "Cabeça" and "Técnica": toggles that ride on the next placed note, like
  accent today. Status says what the next note will carry.
- [ ] Layout draws head override, marks above the stem top, roll strokes on the stem, grace
  heads before the cell.
- [ ] Legend overlay from a `☰ legenda` button at the top of the palette: the table above in
  the current language, glyphs drawn with Bravura.
- [ ] `?` help overlay (palette top): how to enter a bar in six steps with a drawn example per
  step, the Tempo/Célula rule, tap rules, playback modes, import from a photo. pt/en/de.
- [ ] Free text per bar (`bar.text`, e.g. "vassouras") shown above the bar; stick changes are
  text in real scores.

### C5 — playback, synth kit (medium) — [ ]

- [ ] `src/core/schedule.js` (pure): `events(score, range)` → `[{ tick, slotId, note, barIndex, path }]`
  with simile expanded to the previous bar and repeat sections played twice; `secondsAt(tick, bpm)`.
  Tests: a 4/4 bar of eighth hi-hats at 120 BPM → 8 events at 0, 0.25 s …; simile copies;
  repeat doubles; range `[2, 3]` starts at bar 2.
- [ ] `src/audio/kit.js`: Web Audio synth per slot (kick: swept sine + click; snare: noise burst
  + 180 Hz body; hi-hat closed/open: high-passed noise, 60 ms / 400 ms; toms: decaying sines
  by pitch; crash/ride/china: band-passed metallic noise; bell: inharmonic partials). Accent =
  louder, ghost = quieter, open/closed marks pick hi-hat length, roll = repeated hits, flam =
  grace hit 30 ms early.
- [ ] `src/audio/player.js`: look-ahead scheduler (25 ms tick, 120 ms ahead) on the
  AudioContext clock; count-in option; metronome click option; loop; playhead callback.
- [ ] Transport bar under the bar row: ▶ ■ ⟲, BPM, click, count-in; modes: compasso atual ·
  do início · a partir daqui · seleção (tap first then last bar in the full score). Playhead
  highlights the bar and the cell, separate from the edit cursor.
- [ ] AudioContext created on the first ▶ tap (browser rule); status explains iOS mute switch.

### C6 — sampled kit (small, after C5 works) — [ ]

- [ ] Find a CC0 (or CC-BY) one-shot drum kit on Freesound or similar; record source + licence
  in `docs/SOUNDS.md`; ~10 short OGG files in `public/sounds/`, under 400 KB total.
- [ ] `src/audio/samples.js` same interface as `kit.js`; settings toggle "Som: sintético /
  amostras"; synth stays as fallback while samples load.

### C7 — phone pass and docs — [ ]

- [ ] Headless shots both orientations, then Allan on the Redmi.
- [ ] README, import prompt, memory updated; this file's boxes ticked.

## Open questions (decide from use, not in advance)

- Whether tapping a different bar in the full score should also place a note (today: only load).
- Whether the delete toggle should auto-release after one deletion.
- Whether grace notes (flam/drag) need their own cell in the model or stay as a note flag
  (plan: flag; revisit if layout collides).
