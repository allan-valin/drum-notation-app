# Importar uma partitura a partir de uma foto

O app não lê imagens. O caminho: fotografe a página, entregue a foto a um assistente de IA junto
com o prompt abaixo e cole o JSON que ele devolver em **Importar JSON**, na biblioteca do app. Se
algo estiver errado, o app diz exatamente em que compasso e tempo.

## Prompt (copie tudo abaixo da linha)

---

Você vai transcrever a partitura de uma imagem para JSON, para um app de notação musical. Siga os
passos em ordem. Não pule a lista de conferência no final.

### Passo 1. O que responder

- Responda com **exatamente um objeto JSON** e nada mais: nenhuma explicação antes ou depois,
  nenhum comentário dentro dele.
- **Uma imagem (ou uma música) = UM objeto JSON com TODOS os compassos.** Uma página com 22
  compassos dá um único objeto cuja lista `bars` tem 22 itens. Nunca responda com um objeto por
  compasso, nunca divida a música em vários arquivos, nunca pare no meio.
- Se a imagem tiver várias páginas da mesma música, todas vão para a mesma lista `bars`, em
  ordem.

### Passo 2. Leia a página antes de escrever

Anote para você, antes de qualquer JSON:

1. A fórmula de compasso no início (por exemplo 4/4, 3/4, 6/8, 7/8) e cada lugar onde ela muda.
2. A indicação de andamento (um número como ♩ = 100), se houver.
3. O título, se houver.
4. Quais instrumentos a partitura tem. Só uma pauta de bateria → a forma simples (Passo 3a).
   Várias pautas de instrumentos diferentes → a forma com partes (Passo 3b).
5. **Quantos compassos há no total.** Conte as barras de compasso. Um sinal de repetição não
   acrescenta compassos: escreva os compassos uma vez e marque a repetição (Passo 4).

### Passo 3a. O nível de cima, um instrumento (bateria)

| Campo | Tipo | Obrigatório | Significado |
|---|---|---|---|
| `schema_version` | número | sim | Sempre `4`. |
| `title` | texto | sim | O título da página, ou uma descrição curta. |
| `timeSigNum` | número inteiro | sim | Número de cima da primeira fórmula de compasso (4 em 4/4, 6 em 6/8). |
| `timeSigDen` | número inteiro | sim | Número de baixo da primeira fórmula de compasso (4 em 4/4, 8 em 6/8). |
| `defaultBpm` | número inteiro | sim | O andamento escrito; `80` se não houver. |
| `swing` | true/false | não | `true` quando a página diz swing (colcheias tocadas longa-curta). Senão, deixe de fora. |
| `bars` | lista de compassos | sim | Todos os compassos da música, em ordem (Passo 4). |

### Passo 3b. O nível de cima, vários instrumentos

Os mesmos campos de 3a, mais `parts`, e cada compasso traz uma entrada por parte (Passo 4b).

| Campo | Tipo | Significado |
|---|---|---|
| `parts` | lista | Uma entrada por instrumento: `{ "id": "p1", "instrument": "drums" }`. `id` é um nome curto que você escolhe (`p1`, `p2`…), usado de novo dentro de cada compasso. |
| `instrument` | texto | Um destes: `drums`, `congas`, `electricGuitar`, `bassGuitar`, `keys`, `vocal`, `soprano`, `alto`, `tenor`, `bass`, `trumpet`, `altoSax`, `tenorSax`, `trombone`, `doubleBass`, `vibraphone`, `piano`, `harp`, `violin`, `viola`, `cello`, `contrabass`, `flute`, `oboe`, `clarinet`, `bassoon`, `horn`, `tuba`, `timpani`, `glockenspiel`, `xylophone`, `marimba`, `oud`, `qanun`, `ney`, `darbuka`, `riq`, `daf`, `koto`, `shamisen`, `shakuhachi`, `taiko`. |
| `group` | texto | Piano e harpa são duas partes, uma por mão: `pianoRH` + `pianoLH` (ou `harpRH` + `harpLH`), as duas com o mesmo `"group": "g1"`. |
| `muted` | true/false | Deixe de fora. |

### Passo 4. Compassos

Cada item de `bars` é um compasso, da esquerda para a direita, de cima para baixo.

| Campo | Tipo | Significado na página |
|---|---|---|
| `beats` | lista de tempos | Os tempos do compasso (Passo 5). **Exatamente tantos quanto o número de cima da fórmula em vigor**: 4 em 4/4, 3 em 3/4, 6 em 6/8, 7 em 7/8. |
| `lower` | lista de tempos | Só bateria: a voz de hastes para baixo quando ela tem ritmo próprio (Passo 8). Mesmo número de tempos que `beats`. |
| `timeSig` | `[cima, baixo]` | Só no compasso onde a fórmula muda, ex. `[3, 4]`. Os compassos seguintes a mantêm até a próxima mudança. |
| `key` | número ou texto | Só onde a armadura de clave muda (Passo 9). |
| `simile` | true | O compasso mostra o sinal % (repetir o compasso anterior). Escreva mesmo assim os `beats`, todos vazios. |
| `repeatStart` | true | O compasso começa com sinal de repetição `‖:`. |
| `repeatEnd` | true | O compasso termina com sinal de repetição `:‖`. |
| `text` | texto | Palavras escritas acima do compasso ("vassourinhas", "virada", "Refrão"). |

### Passo 4b. Compassos com vários instrumentos

`timeSig`, `key`, `repeatStart` e `repeatEnd` ficam no compasso. O resto vai em `parts`, uma
entrada por id de parte: `"parts": { "p1": { "beats": [...] }, "p2": { "beats": [...] } }`. A
entrada de cada parte também pode ter `lower`, `simile` e `text`. Todo compasso precisa de todas
as partes.

### Passo 5. Tempos e células

Um tempo é `{ "division": ..., "cells": [ ... ] }`.

- `division` é a menor figura usada naquele tempo: `quarter` (semínima), `eighth` (colcheia),
  `sixteenth` (semicolcheia), `thirtySecond` (fusa) (também `half`, mínima, e `whole`,
  semibreve).
- `cells` é o tempo cortado em fatias iguais dessa figura (as subdivisões; no app, "Subdivisão"), **uma célula por fatia, em ordem**,
  comece ou não uma nota ali. Quantas células:

| division | células por tempo em x/4 (tempo = semínima) | células por tempo em x/8 (tempo = colcheia) |
|---|---|---|
| `quarter` | 1 | — |
| `eighth` | 2 | 1 |
| `sixteenth` | 4 | 2 |
| `thirtySecond` | 8 | 4 |

- Uma nota mais longa que o tempo (uma mínima em 4/4): na bateria, escreva-a na primeira célula;
  os tempos seguintes ficam com células vazias. Nos outros instrumentos, veja `cont` (Passo 10).
- Quiálteras: acrescente `"tuplet": 3` (tercina), `5`, `6` ou `7`. O tempo passa a ter exatamente
  esse número de células, qualquer que seja a figura: uma tercina de colcheias num tempo de
  semínima é `{ "division": "eighth", "tuplet": 3, "cells": [[...], [...], [...]] }`.
- Uma célula pode ser dividida de novo sem mexer nas outras: escreva um objeto no lugar dela,
  `{ "division": "sixteenth", "cells": [[...], [...]] }`. O número de células é a figura de dentro
  dividida pela de fora (colcheia → semicolcheias = 2), ou o seu `tuplet`. Exemplo, "colcheia +
  duas semicolcheias": `{ "division": "eighth", "cells": [["snare"], { "division": "sixteenth", "cells": [["snare"], ["snare"]] }] }`.

### Passo 6. Células e notas

- Uma célula é a **lista das notas tocadas no mesmo instante**: `["kick", "hihat"]`.
- Uma lista vazia `[]` é silêncio (uma pausa, ou o meio de uma nota longa).
- Uma nota é só o id do instrumento (`"snare"`) ou, quando tem detalhes, um objeto:

| Campo | Tipo | Valores aceitos | Significado |
|---|---|---|---|
| `slot` | texto | um id do Passo 7 (bateria) ou uma altura escrita (Passo 9) | Qual instrumento, ou qual nota. Obrigatório. |
| `stem` | texto | `up`, `down` | Só bateria, quando a haste aponta para o lado contrário ao da tabela do Passo 7. |
| `articulations` | lista | `accent` (>), `ghost` (nota entre parênteses), `staccato` (ponto), `tenuto` (traço), `marcato` (^), `fermata`, `breath` | Sinais nesta nota. |
| `sticking` | texto | `R`, `L` | Letra da mão escrita sob a nota (R direita, L esquerda). |
| `head` | texto | `cross` (X), `diamond` (losango cheio), `diamondOpen` (losango vazado), `triangle` (triângulo), `circleX` (X no círculo), `slashed` (cabeça cortada), `slash` (barra de ritmo) | Só quando a cabeça difere da do Passo 7 (por exemplo um X na caixa = aro, rim click). |
| `marks` | lista | `open` (o acima), `closed` (+ acima), `halfOpen`, `choke` (ponto acima da haste de um prato), `lv` (deixar soar), `fall`, `doit`, `scoop`, `plop`, `pizz`, `arco`, `downBow`, `upBow`, `harmonic`, `trill` | Sinais de técnica. |
| `roll` | texto | `buzz` (z na haste), `tremolo` (três traços na haste: toques duplos) | Rufos. |
| `grace` | texto | `flam` (uma notinha antes), `drag` (duas) | Apojaturas. |
| `alter` | número | `1` sustenido, `-1` bemol, `0` bequadro, `2`/`-2` dobrados, `0.5`/`-0.5` quartos de tom | Só instrumentos de altura definida (Passo 9). |

### Passo 7. A bateria (legenda Rock Band)

Ache a altura e o formato de cada cabeça e depois o id nesta tabela. Se a página trouxer a sua
própria legenda de bateria, use essa legenda para saber que instrumento cada altura indica, e o
id abaixo para esse instrumento.

| id | Instrumento | Onde na pauta | Cabeça | Haste |
|---|---|---|---|---|
| `china` | Prato china | espaço acima da primeira linha suplementar acima da pauta | X no círculo | cima |
| `splash` | Prato splash | mesma altura do china | losango vazado | cima |
| `cowbell` | Cowbell | mesma altura do china | triângulo cheio | cima |
| `crash` | Prato de ataque | na primeira linha suplementar acima da pauta | X | cima |
| `rideBell` | Cúpula do ride | espaço logo acima da linha de cima | losango cheio | cima |
| `ride` | Prato de condução | espaço logo acima da linha de cima | X | cima |
| `hihat` | Chimbal fechado | na linha de cima | X | cima |
| `hihatOpen` | Chimbal aberto | na linha de cima | X no círculo | cima |
| `highTom` | Tom 1 | espaço de cima | normal | cima |
| `midTom` | Tom 2 | 4ª linha de baixo para cima | normal | cima |
| `snare` | Caixa | 3º espaço de baixo para cima | normal | **baixo** |
| `tom3` | Tom 3 | linha do meio | normal | cima |
| `tom4` | Tom 4 | 2º espaço de baixo para cima | normal | cima |
| `floorTom` | Tom 5 (surdo) | 2ª linha de baixo para cima | normal | cima |
| `kick` | Bumbo direito | espaço de baixo | normal | **baixo** |
| `kickLeft` | Bumbo esquerdo | linha de baixo | normal | **baixo** |
| `hihatPedal` | Chimbal no pé | espaço abaixo da pauta | X | cima |
| `hihatSplash` | Splash de chimbal no pé | espaço abaixo da pauta | X no círculo | cima |

Variações da caixa, todas com `"slot": "snare"`: nota fantasma `"articulations": ["ghost"]`; aro
(rim click) `"head": "cross"`; rimshot `"head": "slashed"`; toques duplos `"roll": "tremolo"`;
rufo buzz `"roll": "buzz"`. Prato abafado: `{ "slot": "crash", "marks": ["choke"] }`. Chimbal
aberto desenhado como X com um o pequeno acima: `{ "slot": "hihat", "marks": ["open"] }`.

### Passo 8. Vozes da bateria: hastes para cima e para baixo

Música de bateria costuma ser escrita em duas vozes: mãos com hastes para cima, pés (e aqui a
caixa) com hastes para baixo.

- **Mesmo ritmo nas duas vozes** (toda nota de haste para baixo cai exatamente onde uma nota de
  haste para cima também poderia estar): escreva tudo em `beats`. Cada nota recebe a haste da
  tabela do Passo 7; acrescente `"stem": "up"` ou `"stem": "down"` só na nota desenhada ao
  contrário (por exemplo a caixa com haste para cima numa virada).
- **Ritmos diferentes** (o groove de sempre: chimbal em colcheias com hastes para cima, bumbo e
  caixa em semínimas com hastes para baixo): ponha as notas de haste para cima em `beats` e as de
  haste para baixo em `lower`. Cada lista é cortada em células pelo seu próprio ritmo. `lower`
  precisa ter tantos tempos quanto `beats`.
- Na dúvida, use `lower`: ele é sempre aceito quando a página mostra hastes para baixo.

### Passo 9. Instrumentos de altura definida (todos menos bateria, congas, darbuka, riq, daf, taiko)

- `slot` é a nota escrita na sua linha ou espaço: letra e oitava, sem acidente (`E4`; Fá♯4 se
  escreve `F4` com `"alter": 1`). O Dó central é `C4`.
- `alter` é o acidente que soa naquela nota: escreva em toda nota, `0` se for natural.
- Guitarra, baixo elétrico, voz de tenor e contrabaixo: a nota escrita (soam uma oitava abaixo).
  Trompete, saxofones, clarinete, trompa: a nota escrita (transposta).
- `key` num compasso: armadura em quintas, `0` Dó maior, `2` dois sustenidos (Ré maior), `-3` três
  bemóis (Mi♭ maior), de `-7` a `7`. Escreva a tonalidade de concerto. Armaduras de maqam
  árabe: `"rast"`, `"bayati"`, `"saba"`, `"hijaz"`, `"nahawand"`, `"kurd"`, `"sikah"`.
- Darbuka, riq e daf usam os ids `dum`, `tak`, `ka`; taiko usa `don`, `tsu`, `ka`; congas usam
  `quinto`, `conga`, `tumba`.
- `"head": "slash"` na linha do meio: "toque a cifra neste ritmo" (guitarra, teclado).

### Passo 10. Marcas numa célula

Quando uma célula leva mais do que notas, escreva-a como objeto: `{ "notes": [...], ... }`.

| Campo | Tipo | Valores aceitos | Significado |
|---|---|---|---|
| `notes` | lista | notas (Passo 6) | As notas da célula. |
| `cont` | true | | Esta célula segura a nota anterior (ligadura, ou o resto de uma nota longa): `{ "cont": true }`, sem notas. Mínima em 4/4 = uma semínima e, no tempo seguinte, `{ "cont": true }`. A ligadura pode atravessar a barra de compasso. |
| `dyn` | texto | `pp`, `p`, `mp`, `mf`, `f`, `ff`, `fp`, `sfz` | Dinâmica escrita neste ponto. |
| `wedge` | texto | `cresc`, `dim` | Forquilha ou as palavras cresc./dim. começando aqui. |
| `lyric` | texto | uma sílaba | Sílaba cantada sob a nota; termine com `-` quando a palavra continua ("Glo-"). |
| `slur` | texto | `start`, `end` | Ligadura de expressão começa ou termina nesta nota. |
| `chord` | texto | `C7`, `Bbmaj7`, `F#m7b5`, `C/E`… | Cifra acima da pauta. |
| `ped` | texto | `down`, `up` | Pedal de sustentação: Ped. ou *. |

### Passo 11. Conferência antes de responder

1. Um único objeto JSON. `schema_version` é `4`.
2. O número de itens em `bars` é igual ao número de compassos contado no Passo 2.
3. Em cada compasso, `beats` (e `lower`, se houver) tem exatamente o número de cima da fórmula em
   vigor.
4. Em cada tempo, o número de células bate com a tabela do Passo 5 (ou com o `tuplet`).
5. Todo id de instrumento está no Passo 7 (ou é uma altura, nos instrumentos de altura definida).
6. Sem comentários, sem vírgula sobrando no fim de listas, todo colchete fechado.

### Exemplo 1: quatro compassos de bateria, um JSON

Compasso 1: crash com o bumbo no 1, chimbal em colcheias, caixa no 2 e no 4 (mesmo ritmo, uma
lista só). Compasso 2: chimbal em colcheias com hastes para cima, bumbo e caixa no seu próprio
ritmo com hastes para baixo (`lower`). Compasso 3: sinal %. Compasso 4: virada em semicolcheias
com as mãos, caixa com haste para cima, terminando num crash acentuado; sinal de repetição no fim.

```json
{
  "schema_version": 4,
  "title": "Groove de rock com virada",
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
      "text": "virada",
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

### Exemplo 2: vários instrumentos

Um compasso de bateria, baixo e voz em Ré maior. Mesmas regras; cada compasso traz todas as
partes.

```json
{
  "schema_version": 4,
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

## Conferir

Depois de importar, abra a partitura e compare com a foto compasso por compasso. A partitura
inteira aparece abaixo do editor; toque num compasso para corrigi-lo. Se a importação falhar, a
mensagem diz o compasso e o tempo: mostre-a ao assistente e peça o JSON inteiro de novo,
corrigido.
