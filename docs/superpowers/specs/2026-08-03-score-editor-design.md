# Score editor & practice tracker — design

**Date:** 2026-08-03
**Status:** approved in brainstorm, pending spec review
**Repo:** `projects/score-app` (directory name provisional)

A phone-first notation editor, drums first, built so other instruments fit later without a
rewrite. The editor is the product; the practice tracker is a port of machinery that already
works in `workout-app`.

---

## 1. Why this exists

Allan reads drum exercises off a page and wants to reproduce them on the phone — enter the
notation himself, practise against a metronome, and watch the BPM he can hold on a given score
climb over weeks.

Two constraints set before design started:

- **Open source only.** No commercial or proprietary dependencies, here or in future projects.
- **Drums first.** The data model must not assume drums, but v1 ships drums working properly
  rather than three instruments working badly.

## 2. Scope

| Release | Contents | Risk |
|---|---|---|
| **v1** | Score editor + score archive | High — novel interaction, unproven on a phone |
| **v2** | Training mode: sessions, metronome, per-score BPM, progression graph | Low — ported from `workout-app` |
| **Parallel** | AI-assisted image → JSON import (a prompt file, not a subsystem) | Low — costs one markdown file |

**Not in v1:** multi-staff instruments (piano), MusicXML interop, native OMR, audio playback of
a score.

### Why native OMR is out

Researched 2026-08-03. **Audiveris**, the only serious open-source OMR engine, states it has no
support for drum/percussion notation — no 1-line percussion staff, only a percussion clef on
5-line staves — and its MusicXML export is self-described as lossy. Commercial products
(Soundslice, PlayScore 2) do handle percussion, which proves the capability exists but is ruled
out by the open-source constraint.

The viable path is a documented prompt: `docs/SCORE_IMPORT_PROMPT.md` describes the import JSON
schema and how to read a page. Allan photographs a score, hands it to an AI, pastes the JSON
back. If that proves reliable, revisit; if not, nothing was invested. Attaching a reference
photo to a score is independently useful and stays regardless.

## 3. Data model

Subdivision is stored **per beat**, not as a global grid — this mirrors reading off a page,
where beat 1 may be a triplet and beat 2 two eighths in the same bar.

```
Score(id, title, profileId, timeSigNum, timeSigDen, defaultBpm, bars[])
Bar(index, beats[])
Beat(index, division: NoteValue, tuplet: Int?, cells[])
Cell(index, notes[])                    // notes in one cell sound together
Note(slotId, articulations[], sticking: R | L | null)
```

A beat's cell count is `tuplet ?: division.cellsPerBeat`. Ticks (PPQ, MIDI convention) are
**derived on demand** for the metronome and any future export — never stored, so the editor
never has to re-fit notes onto a grid.

Instrument profiles stay general without pretending drums are piano:

```
Profile(id, name, staves[])             // drums: 1 staff; piano later: 2
Staff(lineCount, slots[])
Slot(id, name, staffPosition: Int, notehead: Glyph)
```

`staffPosition` is the vertical slot: negative = below the staff (feet — kick, hi-hat pedal),
0..n = on the staff, positive above = cymbals. **There is no `voice` field** — in drum notation
the staff position *is* the instrument. Piano's per-hand split is a second `Staff`, which is why
`staves` is a list from day one even though v1 only ever builds one.

## 4. Editor

Landscape-locked, so a bar gets the width it needs. The focused beat is drawn large and
highlighted; neighbouring beats are dimmed and visibly out of reach, making it obvious that
movement happens with `<` / `>` rather than by tapping.

**Palette (left edge):** note values (whole → 32nd), tuplet toggle (3/5/6/7), rest, accent,
ghost note, dynamics (cresc., ff, pp), sticking `R`/`L`, and a **delete toggle**.

**Interaction rules:**

1. Selecting a note value **subdivides the focused beat** into that value's cells.
2. `<` / `>` step through positions, *including sub-positions inside a beat*.
3. Tapping the staff at a height places a note in the current cell at the slot nearest that
   height. Tapping the **same** height again **overwrites** — it does not advance and does not
   remove.
4. Tapping a **different** height in the same cell adds a **simultaneous** note. This is the
   normal case (kick + hi-hat together) and is why the cursor never auto-advances.
5. With the **delete toggle** active, tapping a note removes it.
6. Notes within a beat are auto-beamed, so a subdivided beat reads as one group.

**Colour per duration** is a user-editable map (8ths one colour, 16ths another). It applies on
screen and in exported PDFs, for practice reading.

Deliberately deferred: tap-anywhere-to-place. Start with `<` / `>` only, then relax it once the
interaction has been used against real exercises.

## 5. Rendering

Compose `Canvas` plus the **Bravura** SMuFL music font (SIL Open Font License). No WebView, no
NDK. Focusing one bar removes the genuinely hard part of engraving — line breaking and
cross-system justification — leaving glyph placement, which is tractable.

The critical split:

- **Layout is a pure function:** `(Bar, ProfileStaff, LayoutConfig) -> List<PlacedGlyph>` where
  `PlacedGlyph(glyph, x, y, colour)`. No Android types, no Canvas.
- **Draw is thin:** the Composable paints whatever layout returned, and hit-testing maps a tap
  back through the same placements.
- **PDF export calls the same layout** with a multi-bar page config and no focus highlight.

This means engraving correctness is JVM-unit-testable without an emulator, and screen and PDF
can never disagree. (Learned the hard way in `workout-app`: display logic buried in a Composable
had to be extracted before it could be asserted at all.)

## 6. Persistence & interchange

- **Room**, same as `workout-app`, offline-only, no accounts, no backend.
- **JSON import/export** with a `schema_version` field, treated as a contract the way
  `WORKOUT_PLAN_GENERATOR.md` is — the AI-import prompt targets this schema, so it cannot drift
  silently. Share/backup plumbing ports from `workout-app`.
- **PDF export** via Android `PdfDocument`, reusing the layout functions.
- **Reference image** attachable per score.

## 7. Training mode (v2)

Ported from `workout-app`'s session engine rather than reinvented: start/stop/resume, survives
process death, offline. Per score, the BPM used in each session is logged, giving a progression
graph per score — the drumming equivalent of the workout app's progression tracking. Metronome
via `AudioTrack`/`SoundPool` at the score's current BPM. Scores can be added to a running
session.

Navigation mirrors the workout app: **Training · Archive · Statistics**, with an instrument
switcher on the main screen selecting the active profile.

## 8. Testing strategy

Pure and JVM-testable, no emulator: subdivision math, cell counts, tuplets, tick derivation,
beam grouping, layout glyph positions, JSON round-trips, BPM progression aggregation.

Device-only, kept deliberately thin: glyph rendering, gesture wiring, PDF output, metronome
timing accuracy.

## 9. Open questions

- Directory/app name is provisional (`score-app`).
- Whether the delete toggle should auto-disable after one deletion, or latch until pressed
  again — decide from use, not in advance.
- Time signatures beyond 4/4 in v1: the model supports any `timeSigNum/Den`; the editor UI for
  changing it may slip to v2.
