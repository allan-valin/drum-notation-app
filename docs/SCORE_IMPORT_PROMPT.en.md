# Importing a score from a photo

The app does not read images. The way in: photograph the page, give the photo to an AI
assistant together with this prompt, paste the JSON it returns into **Import JSON** in the
app's library. If something is wrong, the app says exactly which bar and beat.

## Prompt (copy everything below the line)

---

Transcribe the drum exercise in this image into the JSON below. Answer **with the JSON only**,
no comments.

Rules:

- `schema_version` is always `2`.
- `timeSigNum`/`timeSigDen` is the time signature at the start (4/4 → 4 and 4).
- `bars` is the list of bars. A bar that changes the signature carries `"timeSig": [3, 4]`; the
  following bars inherit it until the next change. Each bar has exactly as many `beats` as the
  numerator of the signature in force.
- Optional bar marks: `"simile": true` (the % sign, repeats the previous bar; its beats stay
  present, empty), `"repeatStart": true` (`||:`), `"repeatEnd": true` (`:||`).
- Each beat has `division` (the note value it is split into) and `cells`, a list with **one cell
  per subdivision**. Required cell count per `division` in an x/4 bar: `quarter` → 1,
  `eighth` → 2, `sixteenth` → 4, `thirtySecond` → 8. With `tuplet: 3` it is 3 cells, `tuplet: 5`
  is 5, and so on, whatever the value.
  A beat holding one quarter note is `{ "division": "quarter", "cells": [[...]] }`.
- Each cell is the list of instruments struck **at the same time**. An empty cell `[]` is a rest.
- A cell can be split again without touching the others: instead of the list, write an object
  `{ "division": "sixteenth", "cells": [[...], [...]] }`. Its cell count is the inner value
  divided by the outer group's value (eighth → sixteenths = 2), or the `tuplet`.
  Example, a beat "eighth + two sixteenths":
  `{ "division": "eighth", "cells": [["snare"], { "division": "sixteenth", "cells": [["snare"], ["snare"]] }] }`.
- Instruments (position on the staff → id):
  - `crash` (above the staff, X head), `ride` (space above the 5th line, X),
    `hihat` (5th line or just above, X),
  - `highTom` (4th space), `midTom` (4th line), `snare` (3rd space), `floorTom` (1st space),
  - `kick` (space below the staff / 1st line), `hihatPedal` (below the staff, X).
- A note can be an object instead of a string when it has details:
  `{ "slot": "snare", "articulations": ["accent"], "sticking": "R" }`.
  Articulations: `accent` (>), `ghost` (head in parentheses). `sticking`: `"R"` or `"L"`.
- A head other than the instrument's normal one: `"head"` with `cross` (X; on the snare line it
  is a cross-stick), `diamond` (cymbal bell), `triangle` (cowbell), `circleX` (circled X: china),
  `slashed` (slashed head: rimshot).
- Technique: `"marks": ["open"]` (○ above: open hi-hat), `["closed"]` (+), `["halfOpen"]` (ø),
  `["choke"]`; `"roll": "buzz"` (z on the stem) or `"tremolo"` (three strokes on the stem);
  `"grace": "flam"` (one grace note before) or `"drag"` (two).
- Text above a bar (e.g. "brushes"): `"text": "brushes"` on the bar.
- `title`: the title on the page, or a short description. `defaultBpm`: the written tempo,
  else 80.

Example, one bar of basic rock (eighths on the hi-hat, snare on 2 and 4, bass drum on 1 and 3):

```json
{
  "schema_version": 2,
  "title": "Basic rock",
  "timeSigNum": 4,
  "timeSigDen": 4,
  "defaultBpm": 90,
  "bars": [
    {
      "beats": [
        { "division": "eighth", "cells": [["kick", "hihat"], ["hihat"]] },
        { "division": "eighth", "cells": [["snare", "hihat"], ["hihat"]] },
        { "division": "eighth", "cells": [["kick", "hihat"], ["hihat"]] },
        { "division": "eighth", "cells": [["snare", "hihat"], ["hihat"]] }
      ]
    }
  ]
}
```

---

## Check

After importing, open the score and compare it with the photo bar by bar. The whole score is
shown below the editor; tap a bar to fix it.
