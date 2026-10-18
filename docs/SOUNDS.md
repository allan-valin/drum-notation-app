# Sounds

Two kits play the same `play(sound, when, velocity)` calls.

## Recorded (default): GMRockKit

- **Source:** Hydrogen drum machine, `data/drumkits/GMRockKit`
  (https://github.com/hydrogen-music/hydrogen/tree/main/data/drumkits/GMRockKit), fetched 2026-10-18.
- **Authors:** Glen MacArthur / Sebastian Moors (from the kit's `drumkit.xml`).
- **Licence:** GNU GPL v3 or later, as stated in the kit's `drumkit.xml`. The files in
  `public/sounds/` are derived works under the same licence.
- **What was done:** one velocity layer ("Med") per sound, plus "Hard" for accented kick and
  snare; leading silence removed (so hits land on time), long tails cut with a fade, converted to
  22.05 kHz mono 16-bit WAV with ffmpeg. WAV instead of MP3 because MP3 decoders add a short
  silent lead-in in some browsers, which would make every hit late.

| App sound | GMRockKit file |
|---|---|
| kick / kickAccent | Kick-Med / Kick-Hard |
| snare / snareAccent | Snare-Med / Snare-Hard |
| rimshot | SnareRimshot-Med |
| crossStick | SideStick-Med |
| hihatClosed / hihatHalf / hihatOpen / hihatPedal | HatClosed-Med / HatSemiOpen-Med / HatOpen-Med / HatPedal-Med |
| ride / rideBell | Ride-Med / Bell-Med |
| crash (choke = crash cut after 0.1 s) | Crash-Med |
| china | Splash-Med (the kit has no china; a splash is the closest short, bright cymbal) |
| cowbell | Cowbell-Med |
| highTom / midTom / floorTom | Tom1-Med / Tom2-Med / TomFloor-Med |

## Synthesized (fallback and option)

`src/audio/kit.js`: oscillators and filtered noise in Web Audio, drum-machine recipes. No files.
It plays while the recorded kit loads and if it fails to load.
