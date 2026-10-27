# Progress

What has been built, newest first. Rounds before 3 are in `docs/superpowers/plans/`.

## Round 3: a professional drummer's feedback (2026-10-27)

Source: the TODO.md written on 2026-10-26 (now deleted; everything in it is below). 489 tests.

| # | Asked for | Done | How to use it |
|---|---|---|---|
| 1 | Stem up/down per note, defaults snare and kick down, the rest up | yes | Palette › Hastes e vozes: Auto / Para cima / Para baixo for the next notes. In "Só símbolo" mode it flips the stem of the note tapped (tap again: back to the default). Defaults live on each slot in `profile.js` (`stem`). |
| 2 | Split the staff into an upper and a lower voice, each with its own subdivision; 2×2 cells | yes | Palette › Separar vozes. Strips above (↑) and below (↓) the staff show each voice's cells; tap one to pick the voice and cell. Figura then splits only that voice. With the switch off, editing works on one tree as before. |
| 3 | Rock Band drum key positions (`docs/drum-key-reference.png`) | yes | 18 pieces at the heights measured from the image. Pieces sharing a height differ by notehead: choose the head (triangle, open diamond, circled X…) and tap that height. |
| 4 | Right click deletes a note | yes | Desktop: right click deletes the note nearest the click in that cell, in either voice; no context menu on the staff. |
| 5 | Note value `bar` | yes | Figura › Compasso: the value splits every beat of the bar. |
| 6 | Drag notes; delayed column change; select cells or beats and move them keeping spacing | yes | Press and hold a note (450 ms) to pick it up; up and down changes the instrument; another column takes effect after resting on it 650 ms; resting past the bar's edge 900 ms goes to the next/previous bar. Palette › Seleção › Células or Tempos: taps mark, hold a marked one and drag. |
| 7 | Clearer AI import prompt: one JSON with all bars, every field, full example, step by step | yes | `docs/SCORE_IMPORT_PROMPT*.md`, eleven steps, field tables, a checklist, a 4-bar example with a lower voice and a stem override. |
| 8 | Autofill a bar: piece + pattern dropdowns, patterns from the time signature | yes | Palette › Preencher compasso. Patterns: every cell, beats only, every other beat from 1 or 2, and for odd/compound meters every grouping into 2s and 3s (7/8: 2+2+3, 2+3+2, 3+2+2). The rock groove: Figura › Compasso › colcheia, then hi-hat on every cell, snare from 2, kick from 1. |
| — | (Allan, same day) see-through preview before writing | yes | Mouse/stylus hover over the selected cell shows the note a click would write. On a phone the preview shows while the finger presses, and the status line says what lifting writes (browsers cannot sense a finger before it touches). |

### Decisions taken, worth a second look

- **Ride and hi-hat heights follow the image, not the TODO's text.** The TODO read the key as
  "ride on the top line, closed hi-hat in the space above"; the image (stated as the source of
  truth) shows the reverse, measured to the pixel: closed and open hi-hat on the top line, ride
  and ride bell in the space above. Swapping is two numbers in `profile.js`.
- **Hi-hat pedal stems up**, because the TODO says "every other piece up". Standard practice
  writes it with the feet, stem down; changing it is one word in `profile.js`.
- **Tap now writes on release** (it was on press), so that press-and-hold can pick a note up
  without first writing one.
- **Two voices in one rhythm are drawn with lengthened notes**: a kick on every beat under
  eighths on the hi-hat reads as quarters, not eighth + eighth rest. Only drawing; the cells
  stay as written. Split voices are drawn exactly as written.
- **Schema 4**: `bar.lower` (lower voice in its own rhythm) and `note.stem`. Version 3 files still
  load. A bar keeps `lower` only while the rhythms differ; the same rhythm folds back into one
  tree.
- The old `floorTom` id is Tom 5, `kick` is the right bass drum (bottom space), so older scores
  open with their notes on the new heights.

### Open

- Real-phone check of the touch gestures (press-and-hold drag, the voice strips, the press
  preview). Checked in Chromium with a mouse; not on a finger.
- Moving a selection to another bar works by dragging past the bar's edge; marked cells in
  other bars are kept but only the shown bar highlights them.

## Next: tasks (start here next session)

Allan, 2026-10-27: add all the missing notation as tasks. Mark `[x]` when done, with the date.
Order is the suggested order (most used in drum charts first); each task is TDD and ends with a
real-browser check.

- [ ] **T1. Beaming by meter (defect).** Six eighths in 6/8 draw as six flagged notes, because
  each eighth is its own beat and beams never cross beats. Beam by the meter's groups: 6/8 and
  12/8 in threes, 9/8 3+3+3, 7/8 and 5/8 by a grouping the bar carries (default 2+2+3 / 3+2),
  x/4 by the beat as now.
- [ ] **T2. Endings and road map.** 1st/2nd endings (volta brackets over one or more bars), D.C.,
  D.S., segno, coda, To Coda, Fine; drawn, in JSON (schema bump), in the import prompt, and
  followed by playback.
- [ ] **T3. Tuplets across beats.** A quarter-note triplet over two beats, half-note triplets, any
  n-tuplet spanning several beats; drawn with a bracket, played in time.
- [ ] **T4. Multi-bar rests and the two-bar repeat (%%).**
- [ ] **T5. Tempo inside the score.** A new ♩ = at any bar, rit. and accel.; playback follows.
- [ ] **T6. Dynamics completed.** Hairpins drawn as wedges (cresc./dim. are words today), plus
  `ppp`, `fff`, `sf`, `sffz`, `rfz`.
- [ ] **T7. Pickup bar (anacrusis)** and other incomplete bars.
- [ ] **T8. Two voices for pitched instruments on one staff** (guitar, a piano hand with
  polyphony), reusing the drum voices (`voices.js`).
- [ ] **T9. Ornaments and lines.** Mordent, turn, grace notes for pitched instruments,
  glissando/slide, arpeggio, 8va/8vb/15ma lines.
- [ ] **T10. Rehearsal marks and bar lines.** Boxed rehearsal letters (A, B…), double and final
  bar lines.
- [ ] **T11. Real-phone check** of round 3's touch gestures: press-and-hold drag, the voice strips,
  the press preview (Allan's Redmi).
- [ ] **T12. Name of the "cell".** Allan's drum teacher doubts the word "Célula"; decide the term
  with Allan (suggested: Subdivisão / Subdivision / Unterteilung), then rename in strings, help
  and the import prompt.

## Gaps in music notation (the reasoning behind T1–T10)

Most useful first, for drum charts in particular:

1. **Volta brackets (1st/2nd endings), D.C., D.S., segno, coda, Fine.** Every pop/rock chart uses
   them; today only `‖: :‖` exists.
2. **Tuplets across beats**: a quarter-note triplet over two beats (and half-note triplets)
   cannot be written, since tuplets live inside one beat.
3. **Multi-bar rests and two-bar repeats (%%).**
4. **Tempo changes inside the score** (a new ♩ =, rit., accel.); the tempo is one number now.
5. **Beaming by meter (a defect, checked 2026-10-27)**: six eighths in 6/8 draw as six flagged
   notes, because each eighth is its own beat and beams never cross beats. They should beam in
   threes (and 7/8 by its grouping).
6. **Hairpins drawn as wedges** (now the words cresc./dim.), and `fff`, `ppp`, `sf`, `sffz`.
7. **Pickup bar (anacrusis).**
8. **Two voices for pitched instruments on one staff** (guitar, piano hands with polyphony).
9. Ornaments and lines: mordent, turn, glissando/slide, arpeggio, 8va/8vb lines.
10. Rehearsal marks (A, B…) and double/final bar lines (bar text covers some of it).
