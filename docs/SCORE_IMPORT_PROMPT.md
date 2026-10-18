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

---

## Verificar

Depois de importar, abra a partitura e compare com a foto compasso a compasso. O app mostra a
partitura inteira em miniatura embaixo do editor; toque num compasso para corrigi-lo.
