# Importar uma partitura a partir de uma foto

O app não lê imagens. O caminho é: fotografar a página, entregar a foto a um assistente de IA
junto com este prompt, colar o JSON que ele devolver em **Importar JSON** no arquivo do app.
Se a leitura falhar, o app diz exatamente em qual compasso/tempo o JSON está errado.

## Prompt (copie tudo abaixo da linha)

---

Transcreva o exercício de bateria desta imagem para o JSON abaixo. Responda **só com o JSON**,
sem comentários.

Regras:

- `schema_version` é sempre `2`.
- `timeSigNum`/`timeSigDen` é a fórmula de compasso do início (4/4 → 4 e 4).
- `bars` é a lista de compassos. Um compasso que muda a fórmula leva `"timeSig": [3, 4]`; os
  seguintes herdam até a próxima mudança. Cada compasso tem exatamente tantos `beats` quanto o
  numerador da fórmula em vigor.
- Marcas de compasso opcionais: `"simile": true` (o sinal %, repete o compasso anterior; os
  tempos continuam presentes, vazios), `"repeatStart": true` (`||:`), `"repeatEnd": true` (`:||`).
- Cada tempo tem `division` (a figura em que ele está subdividido) e `cells`, uma lista com
  **uma célula por subdivisão**. Número de células obrigatório por `division` num compasso x/4:
  `quarter` → 1, `eighth` → 2, `sixteenth` → 4, `thirtySecond` → 8. Com `tuplet: 3` são 3 células,
  `tuplet: 5` são 5, etc., independentemente da figura.
  Um tempo com uma só semínima é `{ "division": "quarter", "cells": [[...]] }`.
  Um tempo "colcheia + duas semicolcheias" é escrito como quatro semicolcheias com a segunda
  célula vazia: `{ "division": "sixteenth", "cells": [["snare"], [], ["snare"], ["snare"]] }`.
- Cada célula é a lista das peças tocadas **ao mesmo tempo**. Célula vazia `[]` é pausa.
- Uma célula pode ser subdividida de novo, sem mexer nas outras: no lugar da lista vai um
  objeto `{ "division": "sixteenth", "cells": [[...], [...]] }`. O número de células é a figura
  interna dividida pela figura do grupo de fora (colcheia → semicolcheias = 2), ou o `tuplet`.
  Exemplo, tempo "colcheia + duas semicolcheias":
  `{ "division": "eighth", "cells": [["snare"], { "division": "sixteenth", "cells": [["snare"], ["snare"]] }] }`.
- Peças (posição na pauta → id):
  - `crash` (acima da pauta, cabeça em X), `ride` (espaço acima da 5ª linha, X),
    `hihat` (5ª linha ou logo acima, X),
  - `highTom` (4º espaço), `midTom` (4ª linha), `snare` (3º espaço), `floorTom` (1º espaço),
  - `kick` (1º espaço abaixo da pauta / 1ª linha), `hihatPedal` (abaixo da pauta, X).
- Uma nota pode ser um objeto em vez de uma string quando tem detalhes:
  `{ "slot": "snare", "articulations": ["accent"], "sticking": "R" }`.
  Articulações: `accent` (>), `ghost` (cabeça entre parênteses). `sticking`: `"R"` ou `"L"`.
- Cabeça diferente da normal do instrumento: `"head"` com `cross` (X; na linha da caixa é
  cross-stick), `diamond` (losango: cúpula do prato), `triangle` (cowbell), `circleX` (X no
  círculo: china), `slashed` (cabeça cortada: rimshot).
- Técnica: `"marks": ["open"]` (○ acima: chimbal aberto), `["closed"]` (+), `["halfOpen"]` (ø),
  `["choke"]` (abafar); `"roll": "buzz"` (z na haste) ou `"tremolo"` (três traços na haste);
  `"grace": "flam"` (uma apojatura antes) ou `"drag"` (duas).
- Texto sobre um compasso (ex.: "vassouras"): `"text": "vassouras"` no compasso.
- `title`: o título que estiver na página, ou uma descrição curta. `defaultBpm`: o andamento
  escrito, senão 80.

Exemplo de um compasso de rock básico (chimbal em colcheias, caixa nos tempos 2 e 4, bumbo
nos tempos 1 e 3):

```json
{
  "schema_version": 2,
  "title": "Rock básico",
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


### Vários instrumentos (`schema_version` 3)

Para uma partitura com mais de um instrumento use `"schema_version": 3`:

- `parts` lista os instrumentos: `{ "id": "p1", "instrument": "drums" }`. Instrumentos: `drums`, `congas`, `electricGuitar`, `bassGuitar`, `keys`, `vocal`, `soprano`, `alto`, `tenor`, `bass`, `trumpet`, `altoSax`, `tenorSax`, `trombone`, `doubleBass`, `vibraphone`, `piano`, `harp`, `violin`, `viola`, `cello`, `contrabass`, `flute`, `oboe`, `clarinet`, `bassoon`, `horn`, `tuba`, `timpani`, `glockenspiel`, `xylophone`, `marimba` (`piano`/`harp`: two parts, `pianoRH` + `pianoLH` / `harpRH` + `harpLH`, same `group`).
- Cada compasso tem as marcas comuns (`timeSig`, `key`, `repeatStart`, `repeatEnd`) e, em
  `parts`, o conteúdo de cada instrumento pelo `id`: `{ "beats": [...] }` (opcionais
  `simile` e `text`).
- `key` é a armadura em quintas: `2` = dois sustenidos (Ré maior), `-3` = três bemóis. Escreva a
  armadura de concerto; trompete, saxofones etc. são mostrados transpostos pelo app.
- Notas de instrumentos de altura: `{ "slot": "E4", "alter": 1 }`. `slot` é a nota escrita na
  linha/espaço (letra + oitava, sem acidente; para guitarra, baixo e tenor a nota escrita, que
  soa uma oitava abaixo; para trompete e saxofones a nota escrita transposta). `alter` em
  semitons: `1` sustenido, `-1` bemol, `0` natural, `±2` dobrados, `±0.5` quartos de tom.
- Nota longa: a célula seguinte `{ "cont": true }` continua a nota anterior (mínima = semínima
  + tempo seguinte `cont`; ligadura também atravessa a barra de compasso).
- Marcas da célula, na forma de objeto `{ "notes": [...], ... }`: `dyn` (`pp p mp mf f ff fp sfz`),
  `wedge` (`cresc`/`dim`), `lyric` (uma sílaba; termine com `-` para hífen), `slur`
  (`start`/`end`), `chord` (cifra: `C7`, `Bbmaj7`, `F#m7b5`, `C/E`).
- Cordas e ornamentos: `"marks": ["pizz"]` (também `arco`, `downBow`, `upBow`, `harmonic`, `trill`); trêmolo: `"roll": "tremolo"`.
- `"swing": true` no topo toca as colcheias suingadas.
- Base rítmica: cabeça `"head": "slash"` no meio da pauta = toque o acorde da cifra nesse ritmo.
  Metais e saxofones: `"marks": ["fall"]` (também `doit`, `scoop`, `plop`).

Exemplo, um compasso de bateria, baixo e voz em Ré maior:

```json
{
  "schema_version": 3,
  "title": "Rock em Ré",
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
        "p1": { "beats": [
          { "division": "eighth", "cells": [["kick", "hihat"], ["hihat"]] },
          { "division": "eighth", "cells": [["snare", "hihat"], ["hihat"]] },
          { "division": "eighth", "cells": [["kick", "hihat"], ["hihat"]] },
          { "division": "eighth", "cells": [["snare", "hihat"], ["hihat"]] }
        ] },
        "p2": { "beats": [
          { "division": "quarter", "cells": [{ "notes": [{ "slot": "D3", "alter": 0 }], "chord": "D", "dyn": "mf" }] },
          { "division": "quarter", "cells": [{ "cont": true }] },
          { "division": "quarter", "cells": [[{ "slot": "A2", "alter": 0 }]] },
          { "division": "quarter", "cells": [[{ "slot": "F2", "alter": 1 }]] }
        ] },
        "p3": { "beats": [
          { "division": "quarter", "cells": [{ "notes": [{ "slot": "A4", "alter": 0 }], "lyric": "Can-", "slur": "start" }] },
          { "division": "quarter", "cells": [{ "notes": [{ "slot": "F4", "alter": 1 }], "lyric": "ção", "slur": "end" }] },
          { "division": "quarter", "cells": [{ "notes": [{ "slot": "D4", "alter": 0 }], "lyric": "de" }] },
          { "division": "quarter", "cells": [{ "notes": [{ "slot": "E4", "alter": 0 }], "lyric": "rock" }] }
        ] }
      }
    }
  ]
}
```

---

## Verificar

Depois de importar, abra a partitura e compare com a foto compasso a compasso. O app mostra a
partitura inteira em miniatura embaixo do editor; toque num compasso para corrigi-lo.
