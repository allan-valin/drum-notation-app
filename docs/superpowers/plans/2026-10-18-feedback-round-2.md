# Feedback round 2 — plan

**Date:** 2026-10-18, Allan's second session on the live site. Resume from the first unchecked
box; each checkpoint is one commit + push and leaves the site working. Same rules as round 1
(TDD on core, jsdom smoke, headless phone shots, pt/en/de strings, status line per action).

## Feedback → decision

| # | Feedback | Decision |
|---|---|---|
| G1 | PDF: 2 bars per line by default | `barsPerLine` default 2 |
| G2 | "How to import from a photo" only in Portuguese | prompt doc in pt/en/de; link picks the current language |
| G3 | Tapping another cell selects **and** places, so he adds notes by mistake | first tap on a cell selects it; a tap on the selected cell places |
| G4 | Célula mode can only make cells shorter; with no notes a longer value should merge back | longer value in Célula mode merges the enclosing split back to that value; refused (with reason) if it would delete notes |
| G5 | Clicking a palette button selects the one **below** it (Half → 16th, X → circled X, Open → Choke) | cause: glyphs overflow upward over the button above and take its clicks; clip button contents and make glyphs click-through; jsdom can't see this, so a real-browser check (elementFromPoint at each button centre) |
| G6 | Delete/Undo/Merge hard to reach | move that row between the Legend/Help row and Note value |
| G7 | Accent etc. shouldn't need a new note | one toggle for Articulation/Hand/Head/Technique: "Nota + símbolo" places a note carrying the symbol; "Só símbolo" adds the symbol to the note already at the tapped height (nothing there = says so) |
| G8 | Techniques can be combined into impossible mixes | Technique becomes single choice (one of open/closed/half/choke/buzz/roll/flam/drag) |
| G9 | Left palette and bar toolbar blend into the page | own toolbar background colour, both themes |
| G10 | "− Compasso" must be left of "+ Compasso" | swap |
| G11 | Segmented options (this bar/from start…, recorded/synth) need visible borders | dividers between options |
| G12 | BPM label left of "−" | `BPM − 80 +` |
| G13 | No way to select several bars; wants `‹ [☐] ›` after Play; arrows move the selected bars; drag and drop like casus with a `\|` caret and the move on release | selection checkbox between two arrows in the transport; with it on, tapping bars in the full score selects a contiguous block; arrows move the block one bar; drag a bar (or the block) with casus's caret-preview drag (`src/app/lib/drag.js` ported with its tests); the selection is what "Seleção" plays/loops |

## Checkpoints

### D1 — quick fixes: G1, G2, G5, G6, G9, G10, G11, G12 — [x] 2026-10-18 (hit-test: 25 stolen clicks → 0 at 1280×800, 800×360, 390×844)
### D2 — tap rules and merge-up: G3, G4 — [ ]
### D3 — symbol-only mode, single technique: G7, G8 — [ ]
### D4 — bar selection, move with arrows, drag and drop: G13 — [ ]

Moving bars keeps each bar's shape: the moved bars and the bar after the gap they leave get
their effective time signature written explicitly first; a `%` bar moved to the front loses
its `%`.

### D5 — real-browser pass (palette hit-test at every button centre, both orientations), docs, memory — [ ]
