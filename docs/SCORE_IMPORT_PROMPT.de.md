# Eine Partitur aus einem Foto importieren

Die App liest keine Bilder. Der Weg: die Seite fotografieren, das Foto zusammen mit dem Prompt
unten einem KI-Assistenten geben und das zurückgegebene JSON in der Bibliothek der App unter
**JSON importieren** einfügen. Wenn etwas nicht stimmt, nennt die App genau Takt und Schlag.

## Prompt (alles unter der Linie kopieren)

---

Du überträgst Noten aus einem Bild in JSON für eine Notations-App. Folge den Schritten der Reihe
nach. Lass die Prüfliste am Ende nicht aus.

### Schritt 1. Was du antwortest

- Antworte mit **genau einem JSON-Objekt** und sonst nichts: keine Erklärung davor oder danach,
  keine Kommentare darin.
- **Ein Bild (oder ein Lied) = EIN JSON-Objekt mit ALLEN Takten.** Eine Seite mit 22 Takten
  ergibt ein einziges Objekt, dessen Liste `bars` 22 Einträge hat. Antworte nie mit einem Objekt
  pro Takt, teile das Lied nie auf mehrere Dateien auf, hör nie mittendrin auf.
- Hat das Bild mehrere Seiten desselben Lieds, kommen alle in dieselbe Liste `bars`, in
  Reihenfolge.

### Schritt 2. Erst die Seite lesen, dann schreiben

Notiere dir vor jedem JSON:

1. Die Taktart am Anfang (zum Beispiel 4/4, 3/4, 6/8, 7/8) und jede Stelle, an der sie wechselt.
2. Die Tempoangabe (eine Zahl wie ♩ = 100), falls vorhanden.
3. Den Titel, falls vorhanden.
4. Welche Instrumente die Partitur hat. Nur ein Schlagzeugsystem → die einfache Form
   (Schritt 3a). Mehrere Systeme für verschiedene Instrumente → die Form mit Stimmen (Schritt 3b).
5. **Wie viele Takte es insgesamt sind.** Zähle die Taktstriche. Ein Wiederholungszeichen fügt
   keine Takte hinzu: schreib die Takte einmal und markiere die Wiederholung (Schritt 4).

### Schritt 3a. Die oberste Ebene, ein Instrument (Schlagzeug)

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---|---|
| `schema_version` | Zahl | ja | Immer `4`. |
| `title` | Text | ja | Der Titel auf der Seite oder eine kurze Beschreibung. |
| `timeSigNum` | ganze Zahl | ja | Obere Zahl der ersten Taktart (4 bei 4/4, 6 bei 6/8). |
| `timeSigDen` | ganze Zahl | ja | Untere Zahl der ersten Taktart (4 bei 4/4, 8 bei 6/8). |
| `defaultBpm` | ganze Zahl | ja | Das notierte Tempo; `80`, wenn keines dasteht. |
| `swing` | true/false | nein | `true`, wenn die Seite Swing verlangt (Achtel lang-kurz). Sonst weglassen. |
| `bars` | Liste von Takten | ja | Alle Takte des Lieds, in Reihenfolge (Schritt 4). |

### Schritt 3b. Die oberste Ebene, mehrere Instrumente

Dieselben Felder wie 3a, dazu `parts`, und jeder Takt enthält einen Eintrag pro Stimme
(Schritt 4b).

| Feld | Typ | Bedeutung |
|---|---|---|
| `parts` | Liste | Ein Eintrag pro Instrument: `{ "id": "p1", "instrument": "drums" }`. `id` ist ein kurzer Name deiner Wahl (`p1`, `p2`…), der in jedem Takt wieder vorkommt. |
| `instrument` | Text | Einer von: `drums`, `congas`, `electricGuitar`, `bassGuitar`, `keys`, `vocal`, `soprano`, `alto`, `tenor`, `bass`, `trumpet`, `altoSax`, `tenorSax`, `trombone`, `doubleBass`, `vibraphone`, `piano`, `harp`, `violin`, `viola`, `cello`, `contrabass`, `flute`, `oboe`, `clarinet`, `bassoon`, `horn`, `tuba`, `timpani`, `glockenspiel`, `xylophone`, `marimba`, `oud`, `qanun`, `ney`, `darbuka`, `riq`, `daf`, `koto`, `shamisen`, `shakuhachi`, `taiko`. |
| `group` | Text | Klavier und Harfe sind zwei Stimmen, eine pro Hand: `pianoRH` + `pianoLH` (oder `harpRH` + `harpLH`), beide mit derselben `"group": "g1"`. |
| `muted` | true/false | Weglassen. |

### Schritt 4. Takte

Jeder Eintrag in `bars` ist ein Takt, von links nach rechts, von oben nach unten.

| Feld | Typ | Bedeutung auf der Seite |
|---|---|---|
| `beats` | Liste von Schlägen | Die Schläge des Takts (Schritt 5). **Genau so viele wie die obere Zahl der geltenden Taktart**: 4 bei 4/4, 3 bei 3/4, 6 bei 6/8, 7 bei 7/8. |
| `lower` | Liste von Schlägen | Nur Schlagzeug: die Stimme mit Hälsen nach unten, wenn sie einen eigenen Rhythmus hat (Schritt 8). Gleich viele Schläge wie `beats`. |
| `timeSig` | `[oben, unten]` | Nur in einem Takt, in dem die Taktart wechselt, z. B. `[3, 4]`. Die folgenden Takte behalten sie bis zum nächsten Wechsel. |
| `key` | Zahl oder Text | Nur wo die Tonart-Vorzeichnung wechselt (Schritt 9). |
| `simile` | true | Der Takt zeigt das %-Zeichen (vorigen Takt wiederholen). Die `beats` trotzdem schreiben, alle leer. |
| `repeatStart` | true | Der Takt beginnt mit einem Wiederholungszeichen `‖:`. |
| `repeatEnd` | true | Der Takt endet mit einem Wiederholungszeichen `:‖`. |
| `text` | Text | Worte über dem Takt („Besen“, „Fill“, „Refrain“). |

### Schritt 4b. Takte mit mehreren Instrumenten

`timeSig`, `key`, `repeatStart` und `repeatEnd` bleiben am Takt. Alles andere kommt unter
`parts`, ein Eintrag pro Stimmen-id: `"parts": { "p1": { "beats": [...] }, "p2": { "beats": [...] } }`.
Der Eintrag jeder Stimme kann auch `lower`, `simile` und `text` haben. Jeder Takt braucht alle
Stimmen.

### Schritt 5. Schläge und Zellen

Ein Schlag ist `{ "division": ..., "cells": [ ... ] }`.

- `division` ist der kürzeste Notenwert in diesem Schlag: `quarter` (Viertel), `eighth` (Achtel),
  `sixteenth` (Sechzehntel), `thirtySecond` (Zweiunddreißigstel) (auch `half`, Halbe, und `whole`,
  Ganze).
- `cells` ist der Schlag in gleiche Stücke dieses Werts geschnitten (seine Unterteilungen; in der App „Unterteilung“), **eine Zelle pro Stück, in
  Reihenfolge**, ob dort eine Note beginnt oder nicht. Wie viele Zellen:

| division | Zellen pro Schlag in x/4 (Schlag = Viertel) | Zellen pro Schlag in x/8 (Schlag = Achtel) |
|---|---|---|
| `quarter` | 1 | — |
| `eighth` | 2 | 1 |
| `sixteenth` | 4 | 2 |
| `thirtySecond` | 8 | 4 |

- Eine Note, die länger ist als der Schlag (eine Halbe in 4/4): beim Schlagzeug in ihre erste
  Zelle schreiben; die folgenden Schläge bekommen leere Zellen. Bei anderen Instrumenten siehe
  `cont` (Schritt 10).
- Triolen und andere N-tolen: `"tuplet": 3` (Triole), `5`, `6` oder `7` hinzufügen. Der Schlag hat
  dann genau so viele Zellen, egal welcher Wert: eine Achteltriole in einem Viertelschlag ist
  `{ "division": "eighth", "tuplet": 3, "cells": [[...], [...], [...]] }`.
- Eine Zelle lässt sich weiter teilen, ohne die anderen anzufassen: an ihre Stelle ein Objekt
  schreiben, `{ "division": "sixteenth", "cells": [[...], [...]] }`. Die Zahl der Zellen ist der
  innere Wert geteilt durch den äußeren (Achtel → Sechzehntel = 2) oder ihr `tuplet`. Beispiel,
  „Achtel + zwei Sechzehntel“: `{ "division": "eighth", "cells": [["snare"], { "division": "sixteenth", "cells": [["snare"], ["snare"]] }] }`.

### Schritt 6. Zellen und Noten

- Eine Zelle ist die **Liste der Noten, die im selben Moment gespielt werden**: `["kick", "hihat"]`.
- Eine leere Liste `[]` ist Stille (eine Pause oder die Mitte einer langen Note).
- Eine Note ist nur die id ihres Instruments (`"snare"`) oder, wenn sie Details hat, ein Objekt:

| Feld | Typ | Erlaubte Werte | Bedeutung |
|---|---|---|---|
| `slot` | Text | eine id aus Schritt 7 (Schlagzeug) oder eine notierte Tonhöhe (Schritt 9) | Welches Instrument oder welche Note. Pflicht. |
| `stem` | Text | `up`, `down` | Nur Schlagzeug, wenn der Hals anders zeigt als in der Tabelle in Schritt 7. |
| `articulations` | Liste | `accent` (>), `ghost` (Note in Klammern), `staccato` (Punkt), `tenuto` (Strich), `marcato` (^), `fermata`, `breath` | Zeichen an dieser Note. |
| `sticking` | Text | `R`, `L` | Handbuchstabe unter der Note (R rechts, L links). |
| `head` | Text | `cross` (X), `diamond` (gefüllte Raute), `diamondOpen` (leere Raute), `triangle` (Dreieck), `circleX` (X im Kreis), `slashed` (durchgestrichener Kopf), `slash` (Rhythmus-Strich) | Nur wenn der Notenkopf von Schritt 7 abweicht (zum Beispiel ein X auf der Snare = Rim Click). |
| `marks` | Liste | `open` (o darüber), `closed` (+ darüber), `halfOpen`, `choke` (Punkt über dem Hals eines Beckens), `lv` (klingen lassen), `fall`, `doit`, `scoop`, `plop`, `pizz`, `arco`, `downBow`, `upBow`, `harmonic`, `trill` | Spieltechnik-Zeichen. |
| `roll` | Text | `buzz` (z am Hals), `tremolo` (drei Striche am Hals: Doppelschläge) | Wirbel. |
| `grace` | Text | `flam` (eine kleine Note davor), `drag` (zwei) | Vorschläge. |
| `alter` | Zahl | `1` Kreuz, `-1` Be, `0` Auflösung, `2`/`-2` doppelt, `0.5`/`-0.5` Vierteltöne | Nur Instrumente mit Tonhöhe (Schritt 9). |

### Schritt 7. Das Schlagzeug (Rock-Band-Legende)

Bestimme Höhe und Form jedes Notenkopfs, dann seine id in dieser Tabelle. Druckt die Seite eine
eigene Schlagzeug-Legende, nimm diese Legende, um zu wissen, welches Instrument jede Höhe meint,
und die id unten für dieses Instrument.

| id | Instrument | Wo im System | Notenkopf | Hals |
|---|---|---|---|---|
| `china` | China-Becken | Zwischenraum über der ersten Hilfslinie über dem System | X im Kreis | oben |
| `splash` | Splash-Becken | gleiche Höhe wie China | leere Raute | oben |
| `cowbell` | Cowbell | gleiche Höhe wie China | gefülltes Dreieck | oben |
| `crash` | Crash-Becken | auf der ersten Hilfslinie über dem System | X | oben |
| `rideBell` | Ride-Glocke | Zwischenraum direkt über der obersten Linie | gefüllte Raute | oben |
| `ride` | Ride-Becken | Zwischenraum direkt über der obersten Linie | X | oben |
| `hihat` | Hi-Hat zu | auf der obersten Linie | X | oben |
| `hihatOpen` | Hi-Hat offen | auf der obersten Linie | X im Kreis | oben |
| `highTom` | Tom 1 | oberster Zwischenraum | normal | oben |
| `midTom` | Tom 2 | 4. Linie von unten | normal | oben |
| `snare` | Snare | 3. Zwischenraum von unten | normal | **unten** |
| `tom3` | Tom 3 | Mittellinie | normal | oben |
| `tom4` | Tom 4 | 2. Zwischenraum von unten | normal | oben |
| `floorTom` | Tom 5 (Standtom) | 2. Linie von unten | normal | oben |
| `kick` | Bassdrum rechts | unterster Zwischenraum | normal | **unten** |
| `kickLeft` | Bassdrum links | unterste Linie | normal | **unten** |
| `hihatPedal` | Hi-Hat-Pedal (Fuß) | Zwischenraum unter dem System | X | oben |
| `hihatSplash` | Hi-Hat-Splash (Fuß) | Zwischenraum unter dem System | X im Kreis | oben |

Snare-Varianten, alle mit `"slot": "snare"`: Ghost Note `"articulations": ["ghost"]`; Rim Click
`"head": "cross"`; Rimshot `"head": "slashed"`; Doppelschläge `"roll": "tremolo"`; Buzz-Wirbel
`"roll": "buzz"`. Abgestopptes Crash: `{ "slot": "crash", "marks": ["choke"] }`. Eine offene Hi-Hat,
gezeichnet als X mit kleinem o darüber: `{ "slot": "hihat", "marks": ["open"] }`.

### Schritt 8. Schlagzeugstimmen: Hälse nach oben und nach unten

Schlagzeugnoten werden meist zweistimmig geschrieben: Hände mit Hälsen nach oben, Füße (und hier
die Snare) mit Hälsen nach unten.

- **Gleicher Rhythmus in beiden Stimmen** (jede Note mit Hals nach unten steht genau dort, wo
  auch eine Note mit Hals nach oben stehen könnte): alles in `beats` schreiben. Jede Note bekommt
  den Hals aus der Tabelle in Schritt 7; `"stem": "up"` oder `"stem": "down"` nur bei einer Note
  ergänzen, die andersherum gezeichnet ist (zum Beispiel die Snare mit Hals nach oben in einem
  Fill).
- **Verschiedene Rhythmen** (der übliche Groove: Hi-Hat in Achteln mit Hälsen nach oben, Bassdrum
  und Snare in Vierteln mit Hälsen nach unten): die Noten mit Hals nach oben in `beats`, die mit
  Hals nach unten in `lower`. Jede Liste wird nach ihrem eigenen Rhythmus in Zellen geteilt.
  `lower` braucht so viele Schläge wie `beats`.
- Im Zweifel `lower` nehmen: es ist immer erlaubt, wenn die Seite Hälse nach unten zeigt.

### Schritt 9. Instrumente mit Tonhöhe (alle außer Schlagzeug, Congas, Darbuka, Riq, Daf, Taiko)

- `slot` ist die notierte Note auf ihrer Linie oder ihrem Zwischenraum: Buchstabe und Oktave, ohne
  Vorzeichen (`E4`; Fis4 wird `F4` mit `"alter": 1` geschrieben). Das mittlere C ist `C4`.
- `alter` ist das klingende Vorzeichen dieser Note: bei jeder Note angeben, `0` wenn ohne.
- Gitarre, E-Bass, Tenorstimme und Kontrabass: die notierte Note (sie klingen eine Oktave
  tiefer). Trompete, Saxophone, Klarinette, Horn: die notierte (transponierte) Note.
- `key` an einem Takt: Vorzeichnung in Quinten, `0` C-Dur, `2` zwei Kreuze (D-Dur), `-3` drei Be
  (Es-Dur), von `-7` bis `7`. Die klingende Tonart angeben. Arabische Maqam-Vorzeichnungen:
  `"rast"`, `"bayati"`, `"saba"`, `"hijaz"`, `"nahawand"`, `"kurd"`, `"sikah"`.
- Darbuka, Riq und Daf benutzen die ids `dum`, `tak`, `ka`; Taiko `don`, `tsu`, `ka`; Congas
  `quinto`, `conga`, `tumba`.
- `"head": "slash"` auf der Mittellinie: „das Akkordsymbol in diesem Rhythmus spielen“ (Gitarre,
  Keyboard).

### Schritt 10. Zeichen an einer Zelle

Trägt eine Zelle mehr als Noten, schreib sie als Objekt: `{ "notes": [...], ... }`.

| Feld | Typ | Erlaubte Werte | Bedeutung |
|---|---|---|---|
| `notes` | Liste | Noten (Schritt 6) | Die Noten der Zelle. |
| `cont` | true | | Diese Zelle hält die Note davor (Haltebogen oder der Rest einer langen Note): `{ "cont": true }`, ohne Noten. Halbe in 4/4 = eine Viertel und im nächsten Schlag `{ "cont": true }`. Ein Haltebogen darf über den Taktstrich gehen. |
| `dyn` | Text | `pp`, `p`, `mp`, `mf`, `f`, `ff`, `fp`, `sfz` | Dynamik an dieser Stelle. |
| `wedge` | Text | `cresc`, `dim` | Gabel oder die Worte cresc./dim. ab hier. |
| `lyric` | Text | eine Silbe | Gesungene Silbe unter der Note; mit `-` enden, wenn das Wort weitergeht („Glo-“). |
| `slur` | Text | `start`, `end` | Bindebogen beginnt oder endet an dieser Note. |
| `chord` | Text | `C7`, `Bbmaj7`, `F#m7b5`, `C/E`… | Akkordsymbol über dem System. |
| `ped` | Text | `down`, `up` | Haltepedal: Ped. oder *. |

### Schritt 11. Prüfliste vor dem Antworten

1. Nur ein JSON-Objekt. `schema_version` ist `4`.
2. Die Zahl der Einträge in `bars` ist gleich der Zahl der Takte, die du in Schritt 2 gezählt
   hast.
3. In jedem Takt hat `beats` (und `lower`, falls vorhanden) genau die obere Zahl der geltenden
   Taktart.
4. In jedem Schlag passt die Zahl der Zellen zur Tabelle in Schritt 5 (oder zum `tuplet`).
5. Jede Instrumenten-id steht in Schritt 7 (oder ist eine Tonhöhe bei Instrumenten mit Tonhöhe).
6. Keine Kommentare, kein Komma nach dem letzten Listeneintrag, jede Klammer geschlossen.

### Beispiel 1: vier Takte Schlagzeug, ein JSON

Takt 1: Crash mit der Bassdrum auf 1, Hi-Hat in Achteln, Snare auf 2 und 4 (gleicher Rhythmus,
eine Liste). Takt 2: Hi-Hat in Achteln mit Hälsen nach oben, Bassdrum und Snare im eigenen Rhythmus
mit Hälsen nach unten (`lower`). Takt 3: %-Zeichen. Takt 4: Sechzehntel-Fill mit den Händen,
Snare mit Hals nach oben, endet auf einem akzentuierten Crash; Wiederholungszeichen am Ende.

```json
{
  "schema_version": 4,
  "title": "Rock-Groove mit Fill",
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
      "text": "Fill",
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

### Beispiel 2: mehrere Instrumente

Ein Takt Schlagzeug, Bass und Gesang in D-Dur. Dieselben Regeln; jeder Takt enthält alle Stimmen.

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

## Prüfen

Nach dem Import die Partitur öffnen und Takt für Takt mit dem Foto vergleichen. Die ganze
Partitur steht unter dem Editor; einen Takt antippen, um ihn zu korrigieren. Schlägt der Import
fehl, nennt die Meldung Takt und Schlag: zeig sie dem Assistenten und bitte um das ganze JSON noch
einmal, korrigiert.
