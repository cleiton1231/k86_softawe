# Protocolo da tela do K86

- **Data:** 2026-11-12
- **Alvo:** Attack Shark K86, `3151:4015`, ID interno `1168`, família `yc500`
- **Tela:** TFT 240×135, RGB565, cinco slots
- **Escopo:** gravação de imagens estáticas e animações na memória da tela
- **Firmware:** nenhuma atualização, erase ou reset é executado

> Este documento descreve o protocolo validado no hardware. Ele cobre apenas a
> tela. Keymap, RGB, macros, perfis e configuração geral permanecem fora do
> escopo desta versão.

## 1. Formato da imagem

| Propriedade | Valor |
| --- | --- |
| Resolução | `240 × 135` |
| Profundidade | RGB565, 16 bits por pixel |
| Ordem de bytes | big-endian (byte alto primeiro) |
| Ordem de varredura | coluna-maior: `x` externo, `y` interno |
| Tamanho do frame | `240 × 135 × 2 = 64.800` bytes |
| Páginas por frame | `ceil(64.800 / 56) = 1.158` |

A conversão usada pelo app é:

```text
r5 = r >> 3
g6 = g >> 2
b5 = b >> 3
v  = (r5 << 11) | (g6 << 5) | b5
byte alto = v >> 8
byte baixo = v & 0xFF
```

O firmware armazena cada frame em 16 páginas de 4 KiB (`65.536` bytes), mesmo
que o payload tenha `64.800` bytes.

## 2. Announce `0xA5`

O primeiro feature report de uma transferência é o announce. O checksum Bit7
fica no byte 7 e cobre os bytes 0 a 6.

| Offset | Significado |
| --- | --- |
| 0 | opcode `0xA5` |
| 1 | índice do frame; em imagem estática, é o slot |
| 2 | quantidade de frames (`1` para imagem estática) |
| 3 | delay entre frames em ms (`0` para imagem estática) |
| 4..6 | tamanho do payload em 24 bits little-endian |
| 7 | checksum Bit7 |
| 8..11 | bounding box low: left, top, right, bottom |
| 12..15 | bounding box high: left, top, right, bottom |
| 16..17 | tamanho do payload em 16 bits altos |
| 18 | slot da animação (`0..4`) |
| 19..63 | padding zero |

O bounding box usado pelo app é `(0, 0, 240, 135)`.

### Imagem estática

A imagem estática usa o slot como índice de frame e o layer `0`:

```text
frame      = slot (0..4)
frameCount = 1
delayMs    = 0
slot       = 0
```

### Animação

A animação usa índices de frame começando em zero e leva o slot no byte 18:

```text
frame      = 0
frameCount = 2..106
delayMs    = 0..255
slot       = 0..4
```

## 3. Páginas de dados `0x25`

Depois do acknowledge, cada página leva 56 bytes de payload em um feature
report de 64 bytes. O checksum Bit7 fica no byte 7 e cobre os bytes 0 a 6.

| Offset | Significado |
| --- | --- |
| 0 | opcode `0x25` |
| 1 | índice do frame |
| 2 | quantidade de frames |
| 3 | delay em ms |
| 4..5 | índice da página em 16 bits little-endian |
| 6 | quantidade de bytes úteis nesta página (`1..56`) |
| 7 | checksum Bit7 |
| 8..63 | 56 bytes de payload |

O app envia as páginas em ordem crescente, frame a frame. A última página de um
frame pode ter menos de 56 bytes úteis; o restante é preenchido com zero.

## 4. Acknowledge

O announce precisa ser confirmado antes das páginas. O firmware responde com
um feature report cujo opcode é `0xA5` e cujo byte 1 é `1`:

```text
A5 01 ...
```

No Windows, via hidapi, o relatório de 65 bytes inclui o report ID `0` no byte
0, então o acknowledge aparece em `[2]`. O WebHID entrega 64 bytes, sem o
report ID, e o acknowledge aparece em `[1]`. O app aceita as duas formas no
caminho WebHID e normaliza o caminho nativo para 64 bytes antes de decodificar.

O firmware pode demorar alguns milissegundos para preparar a flash; por isso o
app envia o announce uma vez, espera ~50 ms e faz até 10 leituras com intervalo
de ~50 ms.

## 5. Limites e orçamento de memória

| Limite | Valor |
| --- | --- |
| Slots | 5 (`0..4`, exibidos como Slot 1..5) |
| Frames por animação | 106 |
| Delay | `0..255` ms |
| Tamanho do payload por frame | 64.800 bytes |
| Páginas por frame | 1.158 |

O limite de 106 frames vem do orçamento de 7 MiB da tela, menos 4 KiB de
memória usada pelo firmware, menos cinco slots estáticos, com cada frame
ocupando 16 páginas de 4 KiB:

```text
(7 MiB - 4 KiB) / 65.536 = 111
111 - 5 slots = 106 frames
```

O app recusa arquivos acima de 106 frames antes de iniciar a transferência.

## 6. Transporte

### WebHID

O WebHID fala com a coleção vendor-defined `0xFFFF/0x0002` e usa report ID `0`.
Cada `sendFeatureReport` leva ~100 ms no navegador, o que inviabiliza GIFs com
centenas de páginas. O caminho WebHID serve para identificar o teclado e para
testes pequenos.

### Electron + node-hid

O processo principal abre a mesma coleção com `node-hid`, adiciona o report ID
`0` no primeiro byte e envia os relatórios de forma síncrona. O renderer
concatena os pacotes de 64 bytes e faz um único IPC por transferência. O
processo principal:

1. envia o announce;
2. espera o acknowledge;
3. envia as páginas em sequência;
4. cede o event loop a cada 16 páginas para manter o IPC, o progresso e o
   cancelamento responsivos;
5. reporta progresso por frame.

O `sendFeatureReport` do `node-hid` já bloqueia até a transferência USB
concluir, então não é necessário um `sleep` por página. Um `setTimeout(1)`
por página no Windows custa ~15,6 ms e foi removido; ele era o principal
gargalo do primeiro bridge nativo.

## 7. Evidência de hardware (2026-11-12)

Todos os testes abaixo foram feitos no K86 físico `3151:4015`, ID `1168`.

| Teste | Resultado |
| --- | --- |
| Imagem estática PNG | aceita; 1.158 páginas em ~4,6 s via Python |
| GIF de 3 frames | aceito no layer 0 e no slot 5; ~13,9 s via Python |
| Trecho de 12 frames de `giphy.gif` | aceito; ~55,6 s via Python |
| GIF sintético de 2 frames (vermelho/verde) | aceito; usuário confirmou a animação na tela |
| GIF `giphy (1).gif`, 44 frames | aceito no slot 5 pelo app Electron; ~266 s |
| GIF `giphy.gif`, 106 frames | aceito no slot 5 pelo app Electron; ~379 s (~3,6 s por frame) |

O acknowledge foi observado como `00 A5 01 00 ...` no relatório de 65 bytes do
hidapi, confirmando o report ID no byte 0 e o acknowledge no byte 2 do buffer
bruto.

## 8. Limitações conhecidas

- O protocolo foi validado em uma unidade e um firmware. As revisões `2730` e
  `4094` não foram testadas.
- Não há comando de erase de flash nesta tela; a gravação substitui o slot.
- O app não implementa backup/restore do conteúdo da tela.
- O delay é um único valor para toda a animação; o app usa a média dos delays
  do GIF.
- O firmware pode rejeitar ou ignorar páginas se o cabo for removido durante a
  gravação; não há verificação de leitura de volta.
- O limite de 106 frames é uma conta de orçamento de memória; o teste de 106
  frames confirma ou ajusta esse limite na prática.
