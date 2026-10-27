# Importing a score from a photo

The app does not read images. The way in: photograph the page, give the photo to an AI
assistant together with the prompt below, and paste the JSON it returns into **Import JSON** in
the app's library. If something is wrong, the app says exactly which bar and beat.

## Prompt (copy everything below the line)

---

You are transcribing sheet music from an image into JSON for a notation app. Follow the steps in
order. Do not skip the checklist at the end.

### Step 1. What to answer

- Answer with **exactly one JSON object** and nothing else: no explanation before or after it, no
  comments inside it.
- **One image (or one song) = ONE JSON object holding ALL its bars.** A page with 22 bars gives
  one object whose `bars` list has 22 entries. Never answer with one object per bar, never split
  the song into several files, never stop halfway.
- If the image has several pages of the same song, they all go into the same `bars` list, in
  order.

### Step 2. Read the page before writing

Write down for yourself, before any JSON:

1. The time signature at the start (for example 4/4, 3/4, 6/8, 7/8) and every place it changes.
2. The tempo marking (a number such as ♩ = 100), if any.
3. The title, if any.
4. Which instruments the score has. One drum staff only → the simple form (Step 3a). Several
   staves for different instruments → the form with parts (Step 3b).
5. **How many bars there are in total.** Count bar lines. A repeat sign does not add bars: write
   the bars once and mark the repeat (Step 4).

### Step 3a. The top level, one instrument (drums)

| Field | Type | Required | Meaning |
|---|---|---|---|
| `schema_version` | number | yes | Always `4`. |
| `title` | text | yes | The title on the page, or a short description. |
| `timeSigNum` | whole number | yes | Top number of the first time signature (4 in 4/4, 6 in 6/8). |
| `timeSigDen` | whole number | yes | Bottom number of the first time signature (4 in 4/4, 8 in 6/8). |
| `defaultBpm` | whole number | yes | The written tempo; `80` if none is written. |
| `swing` | true/false | no | `true` when the page says swing (eighths played long-short). Leave it out otherwise. |
| `bars` | list of bars | yes | Every bar of the song, in order (Step 4). |

### Step 3b. The top level, several instruments

Same fields as 3a plus `parts`, and each bar holds one entry per part (Step 4b).

| Field | Type | Meaning |
|---|---|---|
| `parts` | list | One entry per instrument: `{ "id": "p1", "instrument": "drums" }`. `id` is any short name you choose (`p1`, `p2`…), used again inside every bar. |
| `instrument` | text | One of: `drums`, `congas`, `electricGuitar`, `bassGuitar`, `keys`, `vocal`, `soprano`, `alto`, `tenor`, `bass`, `trumpet`, `altoSax`, `tenorSax`, `trombone`, `doubleBass`, `vibraphone`, `piano`, `harp`, `violin`, `viola`, `cello`, `contrabass`, `flute`, `oboe`, `clarinet`, `bassoon`, `horn`, `tuba`, `timpani`, `glockenspiel`, `xylophone`, `marimba`, `oud`, `qanun`, `ney`, `darbuka`, `riq`, `daf`, `koto`, `shamisen`, `shakuhachi`, `taiko`. |
| `group` | text | Piano and harp are two parts, one per hand: `pianoRH` + `pianoLH` (or `harpRH` + `harpLH`), both with the same `"group": "g1"`. |
| `muted` | true/false | Leave it out. |

### Step 4. Bars

Each entry of `bars` is one bar, left to right, top to bottom.

| Field | Type | Meaning on the page |
|---|---|---|
| `beats` | list of beats | The bar's beats (Step 5). **Exactly as many as the top number of the time signature in force**: 4 in 4/4, 3 in 3/4, 6 in 6/8, 7 in 7/8. |
| `lower` | list of beats | Drums only: the stem-down voice when it has its own rhythm (Step 8). Same number of beats as `beats`. |
| `timeSig` | `[top, bottom]` | Only on a bar where the time signature changes, e.g. `[3, 4]`. The bars after it keep it until the next change. |
| `key` | number or text | Only where the key signature changes (Step 9). |
| `simile` | true | The bar shows the % sign (play the previous bar again). Still write its `beats`, all empty. |
| `repeatStart` | true | The bar starts with a repeat sign `‖:`. |
| `repeatEnd` | true | The bar ends with a repeat sign `:‖`. |
| `text` | text | Words written above the bar ("brushes", "fill", "Chorus"). |

### Step 4b. Bars with several instruments

`timeSig`, `key`, `repeatStart` and `repeatEnd` stay on the bar. Everything else goes under
`parts`, one entry per part id: `"parts": { "p1": { "beats": [...] }, "p2": { "beats": [...] } }`.
Each part's entry may also have `lower`, `simile` and `text`. Every bar must have every part.

### Step 5. Beats and cells

A beat is `{ "division": ..., "cells": [ ... ] }`.

- `division` is the shortest note value used in that beat: `quarter`, `eighth`, `sixteenth`,
  `thirtySecond` (also `half` and `whole`).
- `cells` is the beat cut into equal slices of that value (its subdivisions; the app calls them "Subdivision"), **one cell per slice, in order**,
  whether a note starts there or not. How many cells:

| division | cells per beat in x/4 (beat = quarter) | cells per beat in x/8 (beat = eighth) |
|---|---|---|
| `quarter` | 1 | — |
| `eighth` | 2 | 1 |
| `sixteenth` | 4 | 2 |
| `thirtySecond` | 8 | 4 |

- A note longer than the beat (a half note in 4/4): on drums, write it in its first cell; the
  next beats are empty cells. On other instruments, see `cont` (Step 10).
- Tuplets: add `"tuplet": 3` (triplet), `5`, `6` or `7`. The beat then has exactly that many
  cells, whatever the division: an eighth-note triplet in a quarter beat is
  `{ "division": "eighth", "tuplet": 3, "cells": [[...], [...], [...]] }`.
- A cell can be split again without touching the others: write an object in its place,
  `{ "division": "sixteenth", "cells": [[...], [...]] }`. Its number of cells is the inner value
  divided by the outer value (eighth → sixteenths = 2), or its `tuplet`. Example, "eighth + two
  sixteenths": `{ "division": "eighth", "cells": [["snare"], { "division": "sixteenth", "cells": [["snare"], ["snare"]] }] }`.

### Step 6. Cells and notes

- A cell is a **list of the notes struck at the same moment**: `["kick", "hihat"]`.
- An empty list `[]` is silence (a rest, or the middle of a longer note).
- A note is either just its instrument id (`"snare"`) or, when it has details, an object:

| Field | Type | Allowed values | Meaning |
|---|---|---|---|
| `slot` | text | an id from Step 7 (drums) or a written pitch (Step 9) | Which instrument, or which note. Required. |
| `stem` | text | `up`, `down` | Drums only, when the stem points the other way from the table in Step 7. |
| `articulations` | list | `accent` (>), `ghost` (note in parentheses), `staccato` (dot), `tenuto` (line), `marcato` (^), `fermata`, `breath` | Signs on this note. |
| `sticking` | text | `R`, `L` | Hand letter written under the note. |
| `head` | text | `cross` (X), `diamond` (filled diamond), `diamondOpen` (open diamond), `triangle`, `circleX` (circled X), `slashed` (slashed head), `slash` (rhythm slash) | Only when the notehead differs from the one in Step 7 (for example an X on the snare = rim click). |
| `marks` | list | `open` (o above), `closed` (+ above), `halfOpen`, `choke` (dot above the stem of a cymbal), `lv` (let ring), `fall`, `doit`, `scoop`, `plop`, `pizz`, `arco`, `downBow`, `upBow`, `harmonic`, `trill` | Technique signs. |
| `roll` | text | `buzz` (z on the stem), `tremolo` (three slashes on the stem: doubles) | Rolls. |
| `grace` | text | `flam` (one small note before), `drag` (two) | Grace notes. |
| `alter` | number | `1` sharp, `-1` flat, `0` natural, `2`/`-2` double, `0.5`/`-0.5` quarter tones | Pitched instruments only (Step 9). |

### Step 7. The drum kit (Rock Band drum key)

Find each notehead's height and shape, then its id in this table. If the page prints its own
drum key, use that key to know which instrument each height means, and the id below for that
instrument.

| id | Instrument | Where on the staff | Notehead | Stem |
|---|---|---|---|---|
| `china` | China cymbal | space above the first ledger line over the staff | circled X | up |
| `splash` | Splash cymbal | same height as China | open diamond | up |
| `cowbell` | Cowbell | same height as China | filled triangle | up |
| `crash` | Crash cymbal | on the first ledger line over the staff | X | up |
| `rideBell` | Ride bell | space just above the top line | filled diamond | up |
| `ride` | Ride cymbal | space just above the top line | X | up |
| `hihat` | Closed hi-hat | on the top line | X | up |
| `hihatOpen` | Open hi-hat | on the top line | circled X | up |
| `highTom` | Tom 1 | top space | normal | up |
| `midTom` | Tom 2 | 4th line from the bottom | normal | up |
| `snare` | Snare | 3rd space from the bottom | normal | **down** |
| `tom3` | Tom 3 | middle line | normal | up |
| `tom4` | Tom 4 | 2nd space from the bottom | normal | up |
| `floorTom` | Tom 5 (floor tom) | 2nd line from the bottom | normal | up |
| `kick` | Right bass drum | bottom space | normal | **down** |
| `kickLeft` | Left bass drum | bottom line | normal | **down** |
| `hihatPedal` | Hi-hat pedal (foot) | space below the staff | X | up |
| `hihatSplash` | Hi-hat splash (foot) | space below the staff | circled X | up |

Snare variations, all with `"slot": "snare"`: ghost note `"articulations": ["ghost"]`; rim click
`"head": "cross"`; rimshot `"head": "slashed"`; doubles `"roll": "tremolo"`; buzz roll
`"roll": "buzz"`. Choked crash: `{ "slot": "crash", "marks": ["choke"] }`. An open hi-hat drawn as
an X with a small o above it: `{ "slot": "hihat", "marks": ["open"] }`.

### Step 8. Drum voices: stems up and stems down

Drum music is usually written in two voices: hands with stems up, feet (and here the snare)
with stems down.

- **Same rhythm in both voices** (every stem-down note sits exactly where a stem-up note
  could also be): write everything in `beats`. Each note gets the stem from the table in Step 7;
  add `"stem": "up"` or `"stem": "down"` only to a note drawn the other way (for example the
  snare with its stem up in a fill).
- **Different rhythms** (the usual groove: hi-hat in eighths with stems up, kick and snare in
  quarters with stems down): put the stem-up notes in `beats` and the stem-down notes in
  `lower`. Each list is cut into cells by its own rhythm. `lower` must have as many beats as
  `beats`.
- When unsure, use `lower`: it is always allowed when the page shows stems down.

### Step 9. Pitched instruments (everything except drums, congas, darbuka, riq, daf, taiko)

- `slot` is the written note on its line or space: letter and octave, no accidental (`E4`,
  `F#4` is written `F4` with `"alter": 1`). Middle C is `C4`.
- `alter` is the sounding accidental of that note: write it on every note, `0` if natural.
- Guitar, bass guitar, tenor voice and double bass: the written note (they sound an octave
  lower). Trumpet, saxophones, clarinet, horn: the written (transposed) note.
- `key` on a bar: key signature in fifths, `0` C major, `2` two sharps (D major), `-3` three flats
  (E♭ major), from `-7` to `7`. Write the concert key. Arabic maqam signatures: `"rast"`,
  `"bayati"`, `"saba"`, `"hijaz"`, `"nahawand"`, `"kurd"`, `"sikah"`.
- Darbuka, riq and daf use the ids `dum`, `tak`, `ka`; taiko uses `don`, `tsu`, `ka`; congas use
  `quinto`, `conga`, `tumba`.
- `"head": "slash"` on the middle line: "play the chord symbol in this rhythm" (guitar, keys).

### Step 10. Marks on a cell

When a cell carries more than notes, write it as an object: `{ "notes": [...], ... }`.

| Field | Type | Allowed values | Meaning |
|---|---|---|---|
| `notes` | list | notes (Step 6) | The notes of the cell. |
| `cont` | true | | This cell holds the note before it (a tie, or the rest of a long note): `{ "cont": true }`, no notes. Half note in 4/4 = a quarter, then the next beat `{ "cont": true }`. A tie can cross the bar line. |
| `dyn` | text | `pp`, `p`, `mp`, `mf`, `f`, `ff`, `fp`, `sfz` | Dynamic written at this moment. |
| `wedge` | text | `cresc`, `dim` | Hairpin or the words cresc./dim. starting here. |
| `lyric` | text | one syllable | Sung syllable under the note; end with `-` when the word continues ("Glo-"). |
| `slur` | text | `start`, `end` | Slur starts or ends at this note. |
| `chord` | text | `C7`, `Bbmaj7`, `F#m7b5`, `C/E`… | Chord symbol above the staff. |
| `ped` | text | `down`, `up` | Sustain pedal: Ped. or *. |

### Step 11. Checklist before answering

1. One JSON object only. `schema_version` is `4`.
2. The number of entries in `bars` equals the number of bars you counted in Step 2.
3. In every bar, `beats` (and `lower`, if present) has exactly the top number of the time
   signature in force.
4. In every beat, the number of cells matches the table in Step 5 (or the `tuplet`).
5. Every instrument id appears in Step 7 (or is a pitch for pitched instruments).
6. No comments, no trailing commas, every bracket closed.

### Example 1: four bars of drums, one JSON

Bar 1: crash with the kick on 1, hi-hat eighths, snare on 2 and 4 (same rhythm, one list). Bar 2:
hi-hat eighths with stems up, kick and snare in their own rhythm with stems down (`lower`). Bar 3:
% sign. Bar 4: a sixteenth-note fill with hands, the snare stems up, ending on an accented crash;
repeat sign at the end.

```json
{
  "schema_version": 4,
  "title": "Rock groove with fill",
  "timeSigNum": 4,
  "timeSigDen": 4,
  "defaultBpm": 100,
  "bars": [
    {
      "repeatStart": true,
      "beats": [
        { "division": "eighth", "cells": [["crash", "kick"], ["hihat"]] },
        { "division": "eighth", "cells": [["snare", "hihat"], ["hihat"]] },
        { "division": "eighth", "cells": [["kick", "hihat"], ["hihat"]] },
        { "division": "eighth", "cells": [["snare", "hihat"], ["hihat"]] }
      ]
    },
    {
      "beats": [
        { "division": "eighth", "cells": [["hihat"], ["hihat"]] },
        { "division": "eighth", "cells": [["hihat"], ["hihat"]] },
        { "division": "eighth", "cells": [["hihat"], ["hihat"]] },
        { "division": "eighth", "cells": [["hihat"], ["hihatOpen"]] }
      ],
      "lower": [
        { "division": "quarter", "cells": [["kick"]] },
        { "division": "quarter", "cells": [["snare"]] },
        { "division": "eighth", "cells": [["kick"], ["kick"]] },
        { "division": "quarter", "cells": [["snare"]] }
      ]
    },
    {
      "simile": true,
      "beats": [
        { "division": "quarter", "cells": [[]] },
        { "division": "quarter", "cells": [[]] },
        { "division": "quarter", "cells": [[]] },
        { "division": "quarter", "cells": [[]] }
      ]
    },
    {
      "repeatEnd": true,
      "text": "fill",
      "beats": [
        { "division": "sixteenth", "cells": [
          [{ "slot": "snare", "stem": "up", "sticking": "R" }], [{ "slot": "snare", "stem": "up", "sticking": "L" }],
          [{ "slot": "snare", "stem": "up", "sticking": "R" }], [{ "slot": "snare", "stem": "up", "sticking": "L" }]
        ] },
        { "division": "sixteenth", "cells": [
          [{ "slot": "highTom", "sticking": "R" }], [{ "slot": "highTom", "sticking": "L" }],
          [{ "slot": "midTom", "sticking": "R" }], [{ "slot": "midTom", "sticking": "L" }]
        ] },
        { "division": "sixteenth", "cells": [
          [{ "slot": "tom3", "sticking": "R" }], [{ "slot": "tom3", "sticking": "L" }],
          [{ "slot": "floorTom", "sticking": "R" }], [{ "slot": "floorTom", "sticking": "L" }]
        ] },
        { "division": "quarter", "cells": [[{ "slot": "crash", "articulations": ["accent"] }, "kick"]] }
      ]
    }
  ]
}
```

### Example 2: several instruments

One bar of drums, bass and vocals in D major. Same rules; each bar lists every part.

```json
{
  "schema_version": 4,
  "title": "Rock in D",
  "timeSigNum": 4,
  "timeSigDen": 4,
  "defaultBpm": 100,
  "parts": [
    { "id": "p1", "instrument": "drums" },
    { "id": "p2", "instrument": "bassGuitar" },
    { "id": "p3", "instrument": "vocal" }
  ],
  "bars": [
    {
      "key": 2,
      "parts": {
        "p1": {
          "beats": [
            { "division": "eighth", "cells": [["hihat"], ["hihat"]] },
            { "division": "eighth", "cells": [["hihat"], ["hihat"]] },
            { "division": "eighth", "cells": [["hihat"], ["hihat"]] },
            { "division": "eighth", "cells": [["hihat"], ["hihat"]] }
          ],
          "lower": [
            { "division": "quarter", "cells": [["kick"]] },
            { "division": "quarter", "cells": [["snare"]] },
            { "division": "quarter", "cells": [["kick"]] },
            { "division": "quarter", "cells": [["snare"]] }
          ]
        },
        "p2": { "beats": [
          { "division": "quarter", "cells": [{ "notes": [{ "slot": "D3", "alter": 0 }], "chord": "D", "dyn": "mf" }] },
          { "division": "quarter", "cells": [{ "cont": true }] },
          { "division": "quarter", "cells": [[{ "slot": "A2", "alter": 0 }]] },
          { "division": "quarter", "cells": [[{ "slot": "F2", "alter": 1 }]] }
        ] },
        "p3": { "beats": [
          { "division": "quarter", "cells": [{ "notes": [{ "slot": "A4", "alter": 0 }], "lyric": "Rock", "slur": "start" }] },
          { "division": "quarter", "cells": [{ "notes": [{ "slot": "F4", "alter": 1 }], "lyric": "and", "slur": "end" }] },
          { "division": "quarter", "cells": [{ "notes": [{ "slot": "D4", "alter": 0 }], "lyric": "roll" }] },
          { "division": "quarter", "cells": [{ "notes": [{ "slot": "E4", "alter": 0 }], "lyric": "song" }] }
        ] }
      }
    }
  ]
}
```

---

## Check

After importing, open the score and compare it with the photo bar by bar. The whole score is
shown below the editor; tap a bar to fix it. If the import fails, the message names the bar and
beat: show it to the assistant and ask for the whole JSON again, corrected.
