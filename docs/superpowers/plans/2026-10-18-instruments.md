# More instruments — research and plan

**Date:** 2026-10-18. Allan: an instrument dropdown in the palette (between Legend/Help and
Edit), instrument families in order rock band → choir → jazz → orchestra → other cultures, each
instrument playing its own synthesized part, and next to BPM a list of instruments with
"+ Add instrument", so Play sounds the whole song. Profiles show only the tools an instrument
uses; nothing is removed from the app itself. Resume from the first unchecked box.

## Reading of the request (stated to Allan)

- A score holds **parts**, one per instrument, sharing bars, time signatures and repeats.
- The palette dropdown chooses **which part is being edited**; the palette then shows that
  instrument's tool groups only. Tool state that the new instrument cannot use is reset, so a
  diamond head picked on drums can never reach a violin note.
- The list next to BPM is the band: one row per part with an instrument dropdown, mute, and
  remove; "+ Add instrument" appends a row (above itself). Play mixes every unmuted part.
- The full score shows every part, one staff per part per bar, like a printed band score.

## What exists vs. what each family needs

| Need | Now | Rock | Choir | Jazz | Orchestra | Arabic |
|---|---|---|---|---|---|---|
| Several parts per score | no | ✔ | ✔ | ✔ | ✔ | ✔ |
| Pitched notes (step/octave), tap height → pitch | no (drum slots) | ✔ | ✔ | ✔ | ✔ | ✔ |
| Clefs: treble, bass, treble 8vb, alto, tenor | percussion only | ✔ (8vb guitar, bass) | ✔ (tenor 8vb) | ✔ | ✔ (alto viola, tenor cello) | ✔ |
| Key signature per bar | no | ✔ | ✔ | ✔ | ✔ | maqam keys |
| Accidentals ♯ ♭ ♮ 𝄪 𝄫 | no | ✔ | ✔ | ✔ | ✔ | + quarter tones |
| Notes longer than a beat, ties, dots | no (one beat max) | ✔ | ✔ | ✔ | ✔ | ✔ |
| Stem direction by pitch | always up | ✔ | ✔ | ✔ | ✔ | ✔ |
| Dynamics (p … ff), hairpins | glyphs only | ✔ | ✔ | ✔ | ✔ | ✔ |
| Slurs, staccato, tenuto, marcato, fermata | accent only | some | ✔ | ✔ | ✔ | ✔ |
| Lyrics under notes | no | lead vocal | ✔ | — | — | — |
| Chord symbols (C7, Am) / slash rhythm | no | guitar, keys | — | ✔ | — | — |
| Transposing instruments (B♭, E♭, F) | no | — | — | sax, trumpet | clarinet, horn | — |
| Two staves (grand staff) | no | keys | (closed SATB) | piano | piano, harp | qanun |
| Guitar/bass TAB | no | optional | — | — | — | — |
| Swing playback | no | — | — | ✔ | — | — |
| String / guitar / wind techniques | drum only | bend, slide, palm mute | breath | fall, doit, scoop | pizz/arco, bowings, tremolo, harmonics | — |
| Sustained playback (note length) | one-shots | ✔ | ✔ | ✔ | ✔ | ✔ |

Unpitched hand percussion (congas, darbuka, riq, taiko) fits the existing drum model: only a
profile with its own slots, noteheads and stroke names (dum/tak, don/ka).

**Japanese traditional notation** (koto, shamisen, shakuhachi) is a different writing system:
vertical columns read right to left, kanji/katakana fingerings, schools disagree (Yamada,
Ikuta, kinko, tozan), and SMuFL has no glyphs for it. It needs its own renderer and input
model, about the size of this whole app. **Recommendation: not now.** Feasible instead: taiko
on a percussion staff with kuchishōga syllables, koto/shakuhachi/shamisen on a Western staff.

## Instrument list by phase

- Rock: drums (exists), electric guitar (treble 8vb), bass guitar (bass 8vb), piano/keys
  (grand staff), lead vocal (treble), plus congas.
- Choir: soprano, alto (treble), tenor (treble 8vb), bass (bass); lyrics, breath marks.
- Jazz: trumpet B♭, alto sax E♭, tenor sax B♭, trombone, double bass, vibraphone, piano; chord
  symbols, slash rhythm, swing.
- Orchestra: violin, viola (alto), cello (bass/tenor), double bass; flute, oboe, clarinet B♭,
  bassoon; horn F, trumpet, trombone, tuba; timpani, glockenspiel, xylophone, marimba; harp.
- Arabic: oud, qanun, ney, violin on a staff with quarter tones and maqam keys (rast, bayati,
  saba, hijaz, …); darbuka, riq, daf with dum/tak/ka.
- Japanese (Western staff only): koto, shakuhachi, shamisen; taiko with don/ka/tsu.

## Sound

Every pitched instrument gets a Web Audio recipe, same approach as the drum synth: plucked
(Karplus–Strong) for guitar, bass, oud, koto, harp; decaying partials for piano, vibes,
mallets; sawtooth + filter + slow attack + vibrato for bowed strings; filter-envelope brass;
breathy square/triangle for winds; formant-filtered voice "ah" for choir. Quarter tones and
transposition are just the frequency. A sampled set can follow later like the drums did
(FluidR3_GM: the author declares MIT, the gleitz web conversion labels it CC BY 3.0; both open).

## Lessons carried over from the palette bugs

- Every palette button uses the clipped-button pattern (`overflow: hidden`, click-through
  glyphs); the Playwright hit-test runs for **every instrument profile**, both orientations.
- Profiles list their palette groups; a test checks each listed group's actions exist for that
  profile and that switching parts resets tool state the new profile lacks.
- The tap rule stays: first tap selects, second writes; symbol-only reaches the cell's note.

## Checkpoints

- [x] **I1 Parts.** (2026-10-18: done; hit-test 0 stolen clicks for drums (38 buttons) and congas (28) at 1280×800, 800×360, 390×844; drums+congas played together, muting congas removed exactly their 7 voices.) Schema v3: `score.parts[]` (`{ id, instrument, muted }`), bars keep shared
  attributes (signature, repeats) and hold each part's content in `bar.parts[partId]`; v2 files
  load as one drum part. Editor edits a projected one-part view, so editing code is unchanged.
  Palette instrument dropdown; transport band list with + Add instrument, mute, remove; full
  score shows every part; playback mixes parts. Percussion profiles: drum kit, congas.
- [x] **I2 Pitch.** (2026-10-18: done together with the rock-band pitched profiles and their synth voices from I4: electric guitar, bass guitar, keyboard (one staff), vocals. Hit-test 0 stolen clicks for all six palettes, three sizes; a four-part bar played in Chromium.) Pitched note model, clefs, staff position → pitch, accidentals tool, key
  signature per bar, stem direction, ledger lines both ways, legend/help per profile.
- [x] **I3 Length.** (2026-10-18: a continuation flag on cells is the tie; runs that add up to a written value draw as one note (half, whole, dotted), others as ties, also across bar lines; playback holds them. Drums untouched.) Notes longer than a beat (beat spans), ties across beats and bars, dots
  drawn for tied pairs that make a dotted value; sustained playback lengths.
- [x] **I4 Rock band sounds and profiles.** (2026-10-18: profiles and voices landed with I2; this step added dynamics pp…ff, fp, sfz and cresc./dim. for every instrument, drawn under the staff and shaping playback loudness. Keys stay on one staff until I7's grand staff. Hit-test 0 for all six palettes after the new group.) Guitar, bass, keys (single staff first), vocal;
  synth recipes; dynamics, staccato/tenuto/marcato; per-profile hit-test.
- [x] **I5 Choir.** (2026-10-18: soprano, alto, tenor (treble 8vb), bass; lyrics one line per bar with hyphens, Enter writes and moves to the next note; breath marks; slurs across bar lines; dynamics above voice staves. Lead vocal got the same. Hit-test 0 for the choir palettes.) SATB profiles, lyrics, breath marks, slurs, voice synth.
- [x] **I6 Jazz.** (2026-10-18: trumpet B♭, alto sax E♭, tenor sax B♭ written transposed with shifted key signatures, trombone, double bass, vibraphone; chord symbols (parser, one line per bar, Enter to next beat); rhythm slashes play the chord in force; swing; fall/doit/scoop/plop drawn and bent in playback; new brass, sax, upright and vibes voices; import guide documents the v3 format in pt/en/de. Written-pitch view only, no concert-pitch toggle.) Chord symbols, slash rhythm, swing, transposing instruments (written vs
  concert pitch), falls/doits/scoops, jazz instruments and sounds.
- [ ] **I7 Orchestra.** PARTLY DONE 2026-10-18 (core): piano/harp as two linked hand parts (group), strings/woods/brass/timpani/mallets profiles, pizz/arco/bowings/harmonic/trill/tremolo marks + playback, 15 voices, names in 3 languages. STILL TO DO: band list must use `bandRows` (one row per piano), brace drawing in full score/PDF, palette labels/legend rows/strings for the new techniques (pizz, arco, downBow, upBow, harmonic, trill, stringTremolo), hit-test + screenshots. Then I8, I9. Alto/tenor clefs in use, grand staff (piano, harp), string techniques,
  hairpins, fermata, trills, orchestral instruments and sounds, timpani and mallets.
- [ ] **I8 Arabic.** Quarter-tone accidentals and maqam key signatures, quarter-tone playback,
  oud/qanun/ney profiles, darbuka/riq/daf percussion.
- [ ] **I9 Japanese on a Western staff.** Taiko (don/ka/tsu), koto, shakuhachi, shamisen
  profiles and sounds. Traditional vertical notation: not planned (see above).
