# Eine Partitur aus einem Foto importieren

Die App liest keine Bilder. Der Weg: die Seite fotografieren, das Foto zusammen mit diesem
Prompt einem KI-Assistenten geben, das zurückgegebene JSON in der Bibliothek der App unter
**JSON importieren** einfügen. Stimmt etwas nicht, nennt die App genau Takt und Schlag.

## Prompt (alles unter der Linie kopieren)

---

Übertrage die Schlagzeugübung in diesem Bild in das JSON unten. Antworte **nur mit dem JSON**,
ohne Kommentare.

Regeln:

- `schema_version` ist immer `2`.
- `timeSigNum`/`timeSigDen` ist die Taktart am Anfang (4/4 → 4 und 4).
- `bars` ist die Liste der Takte. Ein Takt, der die Taktart ändert, trägt `"timeSig": [3, 4]`;
  die folgenden Takte übernehmen sie bis zur nächsten Änderung. Jeder Takt hat genau so viele
  `beats` wie der Zähler der geltenden Taktart.
- Optionale Taktzeichen: `"simile": true` (das %-Zeichen, wiederholt den vorherigen Takt; die
  Schläge bleiben, leer), `"repeatStart": true` (`||:`), `"repeatEnd": true` (`:||`).
- Jeder Schlag hat `division` (der Notenwert, in den er geteilt ist) und `cells`, eine Liste mit
  **einer Zelle pro Unterteilung**. Nötige Zellenzahl je `division` in einem x/4-Takt:
  `quarter` → 1, `eighth` → 2, `sixteenth` → 4, `thirtySecond` → 8. Mit `tuplet: 3` sind es
  3 Zellen, mit `tuplet: 5` 5 usw., unabhängig vom Notenwert.
  Ein Schlag mit einer Viertelnote ist `{ "division": "quarter", "cells": [[...]] }`.
- Jede Zelle ist die Liste der Instrumente, die **gleichzeitig** gespielt werden. Eine leere
  Zelle `[]` ist eine Pause.
- Eine Zelle kann weiter geteilt werden, ohne die anderen zu ändern: statt der Liste ein Objekt
  `{ "division": "sixteenth", "cells": [[...], [...]] }`. Die Zellenzahl ist der innere Wert
  geteilt durch den Wert der äußeren Gruppe (Achtel → Sechzehntel = 2) oder das `tuplet`.
  Beispiel, ein Schlag "Achtel + zwei Sechzehntel":
  `{ "division": "eighth", "cells": [["snare"], { "division": "sixteenth", "cells": [["snare"], ["snare"]] }] }`.
- Instrumente (Position im Notensystem → id):
  - `crash` (über dem System, X-Kopf), `ride` (Zwischenraum über der 5. Linie, X),
    `hihat` (5. Linie oder knapp darüber, X),
  - `highTom` (4. Zwischenraum), `midTom` (4. Linie), `snare` (3. Zwischenraum),
    `floorTom` (1. Zwischenraum),
  - `kick` (Zwischenraum unter dem System / 1. Linie), `hihatPedal` (unter dem System, X).
- Eine Note kann ein Objekt statt eines Strings sein, wenn sie Details hat:
  `{ "slot": "snare", "articulations": ["accent"], "sticking": "R" }`.
  Artikulationen: `accent` (>), `ghost` (Kopf in Klammern). `sticking`: `"R"` oder `"L"`.
- Ein anderer Kopf als der normale des Instruments: `"head"` mit `cross` (X; auf der
  Snare-Linie ein Cross-Stick), `diamond` (Raute: Beckenglocke), `triangle` (Cowbell),
  `circleX` (X im Kreis: China), `slashed` (durchgestrichen: Rimshot).
- Technik: `"marks": ["open"]` (○ darüber: offene Hi-Hat), `["closed"]` (+), `["halfOpen"]` (ø),
  `["choke"]` (abstoppen); `"roll": "buzz"` (z am Hals) oder `"tremolo"` (drei Striche am Hals);
  `"grace": "flam"` (ein Vorschlag) oder `"drag"` (zwei).
- Text über einem Takt (z. B. "Besen"): `"text": "Besen"` am Takt.
- `title`: der Titel auf der Seite oder eine kurze Beschreibung. `defaultBpm`: das notierte
  Tempo, sonst 80.

Beispiel, ein Takt einfacher Rock (Achtel auf der Hi-Hat, Snare auf 2 und 4, Bassdrum auf 1
und 3):

```json
{
  "schema_version": 2,
  "title": "Einfacher Rock",
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

## Prüfen

Nach dem Import die Partitur öffnen und Takt für Takt mit dem Foto vergleichen. Die ganze
Partitur steht unter dem Editor; einen Takt antippen, um ihn zu korrigieren.
