# v1 web editor — implementation plan

**Goal:** the v1 editor from `2026-08-03-v1-score-editor.md`, in the browser. Same sixteen
tasks, same tests, ported Kotlin → JS. That plan stays as the detailed reference for each
task's rationale; this file is the checklist and the file map.

**Stack:** Svelte 5, Vite 8, vitest 5, SVG, Bravura woff2, localStorage, print-to-PDF.
**Rule:** `src/core/` imports nothing from Svelte or the DOM. Everything there is unit-tested.
**TDD:** test first, run red, implement, run green, commit, push.

## File map

```
src/core/noteValue.js     NOTE_VALUES + cellsPerBeat                      (Task 2)
src/core/score.js         Note/Cell/Beat/Bar/Score factories, emptyBar     (Task 3)
src/core/profile.js       DRUM_PROFILE, slotNearest                        (Task 4)
src/core/cursor.js        next / prev / beatAt                             (Task 5)
src/core/edit.js          placeNote / deleteNote / subdivide               (Task 6)
src/core/ticks.js         PPQ, cellTicks, barTicks                         (Task 7)
src/core/beaming.js       beamGroups                                       (Task 8)
src/core/glyphs.js        SMuFL codepoints, verified 2026-10-18            (Task 9)
src/core/layout.js        layoutBar → { glyphs, beams, beatBounds }, staffPositionAt (Tasks 10, 13)
src/core/json.js          encode / decode, SCHEMA_VERSION                  (Task 11)
src/core/storage.js       localStorage repo: list / load / save / remove   (Task 12)
src/core/editorState.js   pure reducer: palette + cursor + delete toggle   (Task 14)
src/core/colours.js       colour per note value, user-editable             (Task 15)
src/core/pagination.js    bars → pages for print                           (Task 16)
src/ui/ScoreSvg.svelte    paints a layout result; tap → (beat, staffPosition)
src/ui/Palette.svelte     note values, tuplet, rest, accent, ghost, R/L, delete
src/ui/Editor.svelte      wires Palette + ScoreSvg + < >
src/ui/Archive.svelte     list, new, import JSON, export JSON, print
src/ui/PrintPage.svelte   all bars, no focus, print CSS
src/app/main.js, App.svelte, i18n (pt-BR strings)
docs/SCORE_IMPORT_PROMPT.md
```

## Checklist

- [ ] 1 scaffold builds + tests + deploys (this commit)
- [ ] 2–8 pure core ported with the plan's tests
- [ ] 9 glyph table (codepoints verified against SMuFL glyphnames.json 2026-10-18)
- [ ] 10 layout
- [ ] 11 JSON, 12 storage
- [ ] 13 ScoreSvg + staffPositionAt
- [ ] 14 editor state + Editor.svelte
- [ ] 15 colours
- [ ] 16 archive, print, import prompt
- [ ] phone check on the Redmi over LAN, then on the live site
