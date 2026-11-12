# Protocolo do K86 — fase de fundação

- **Data:** 2026-11-12
- **Fase:** fundação (Task 10)
- **Escopo:** identificação somente leitura (`identify`)
- **Alvo:** `3151:4015`, ID interno `1168`, família `yc500`, layout ANSI sem cedilha
- **Validação no hardware:** executada em 2026-11-12 (seção 5)

> Este documento cobre apenas o necessário para identificar o K86 nesta fase.
> Nenhum comando de gravação de configuração, keymap, RGB, macro, tela ou
> firmware é descrito como utilizável. O identify usa um feature report de
> comando, mas não grava configuração nem flash. A validação real está
> registrada em
> [`docs/qa/hardware-checklist.md`](../qa/hardware-checklist.md).

## Convenções de evidência

Cada fato abaixo recebe um dos três rótulos:

- **observado** — está documentado diretamente nas fontes citadas (design,
  plano, análise estática do app oficial, documentação factual do sharkfin),
  materializado no código e nos testes deste repositório, ou foi observado
  diretamente na unidade de 2026-11-12. A seção 5 identifica o que foi
  confirmado no hardware; nas demais seções, a fonte específica é indicada.
- **inferido** — é uma conclusão obtida a partir dos fatos observados, mas
  ainda não foi confirmada no hardware.
- **desconhecido** — não há evidência suficiente. Nada marcado assim deve ser
  usado para implementar gravações de configuração/estado.

A enumeração local inicial do Windows, feita em 2026-11-12, foi somente
leitura: confirmou a presença do dispositivo e as capacidades HID declaradas
pelo sistema, mas **não** enviou o pedido de identify. A validação WebHID
posterior, também em 2026-11-12, fez o round-trip de identify e é a evidência
direta de hardware deste documento.

## 1. Alvo e registro conhecido

O K86 é identificado por uma combinação de VID/PID USB e ID interno devolvido
pelo firmware. O PID sozinho não escolhe a família de protocolo; a sessão
compara ID, VID e PID antes de liberar operações.

| ID interno | PID | Família | Layout no registro | Evidência |
| --- | --- | --- | --- | --- |
| `1168` (`0x0490`) | `0x4015` | `yc500` | ANSI sem cedilha | **observado** no design §7, no plano (restrições globais) e em `src/devices/k86.ts`; a enumeração do Windows confirmou `VID_3151&PID_4015`; o app decodificou o ID `1168` no identify WebHID de 2026-11-12 |
| `2730` (`0x0AAA`) | `0x5002` | `gen2` | ANSI declarado | **observado** no design §7 e no registro; esta revisão não foi testada nesta fase |
| `4094` (`0x0FFE`) | `0x5056` | `gen2` | ANSI declarado | **observado** no design §7 e no registro; esta revisão não foi testada nesta fase |

O alvo desta fase é a primeira linha: `3151:4015` → ID `1168` → família
`yc500` → ANSI sem cedilha. As outras duas revisões existem no registro para
detecção futura, mas não têm validação de hardware neste trabalho.

Se o ID interno não estiver no registro, a sessão é criada como
**somente leitura**, com uma definição conservadora `yc500`. Nenhuma gravação
de configuração/estado é exposta por `K86Session` nesta fase.

## 2. Transporte

| Fato | Valor | Evidência |
| --- | --- | --- |
| Coleção vendor-defined | usage page `0xFFFF`, usage `0x0002` | **observado** no design §7, no plano e em `src/hid/webhid.ts`; a enumeração local confirmou essa coleção na interface `MI_02` do `3151:4015`, e o chooser do navegador a apresentou como “Gaming Keyboard” |
| Coleção de fallback | usage page `0x0001`, usage `0x0002` | **observado** no código; aceita apenas para identify somente leitura nesta fase |
| Tipo de report | feature report | **observado** no design, no plano, no código e no round-trip de 2026-11-12 |
| Report ID | `0` | **observado** nas fontes, no código e na validação de 2026-11-12: o identify funcionou com report ID `0` nesta unidade, no Edge 157.0.4341.46 |
| Tamanho do report | 64 bytes de payload | **observado** no design, no plano, nos testes, na documentação de referência e no round-trip de 2026-11-12. O Windows declara `FeatureReportByteLength = 65` para a coleção vendor-defined, compatível com 64 bytes de dados mais o byte de report ID; o payload do protocolo continua sendo 64 bytes |
| Direção | envio e recebimento de feature report | **observado** no código, nas fontes de referência e no round-trip de identify |

Fluxo de transporte usado pelo app:

1. `navigator.hid.requestDevice` com o filtro
   `{ vendorId: 0x3151, usagePage: 0xFFFF, usage: 0x0002 }`.
2. Preferência pela coleção `0xFFFF/0x0002`; se ela não existir, o código
   aceita a coleção `0x0001/0x0002` somente para identify em modo somente
   leitura.
3. `sendFeatureReport(0, pacoteDe64Bytes)`.
4. `receiveFeatureReport(0)` e normalização do resultado para `Uint8Array`.

A validação de 2026-11-12 confirmou, nesta unidade e no Edge
157.0.4341.46, que o WebHID aceita report ID `0` e o payload de 64 bytes para
o identify. A limitação é importante: uma unidade, um navegador e um sistema
operacional. Outras combinações de hardware, navegador ou firmware permanecem
**desconhecidas** até serem testadas.

## 3. Identify (`0x8F`)

O pedido de identify é um feature report de 64 bytes com opcode `0x8F`.
A resposta deve repetir o opcode no byte 0 e trazer o ID interno em `u32`
little-endian nos bytes 1 a 4.

### Pedido

| Offset | Valor | Significado | Evidência |
| --- | --- | --- | --- |
| 0 | `0x8F` | opcode de identify | **observado** no design, no plano, na análise do app oficial, nas fontes de referência e no round-trip de 2026-11-12 |
| 1..6 | `0x00` | reservado/zeros | **observado** no código e nos testes |
| 7 | `0x70` | checksum Bit7 | **observado** nesta unidade em 2026-11-12: o dispositivo aceitou o pedido e respondeu. Limitação: um firmware insensível ao checksum também aceitaria o mesmo pedido; a validação do checksum pelo firmware continua **desconhecida** |
| 8..63 | `0x00` | padding até 64 bytes | **observado** no código e nos testes |

O checksum do pedido é calculado pela regra Bit7:

```text
sum = 0x8F + 0 + 0 + 0 + 0 + 0 + 0 = 0x8F
byte 7 = 0xFF - (sum & 0xFF) = 0x70
```

O valor `0x70` é coberto por teste unitário. O teste apenas reproduz a regra de
checksum; ele não prova que o firmware do K86 valida o checksum. A validação
de 2026-11-12 registra que esta unidade **aceitou** o pedido e respondeu, mas
não distingue aceitação de validação efetiva: um firmware que ignore o
checksum poderia aceitar o mesmo pacote.

Representação do pedido:

```text
8F 00 00 00 00 00 00 70 00 00 ... 00   (64 bytes)
```

### Resposta

| Offset | Valor | Significado | Evidência |
| --- | --- | --- | --- |
| 0 | `0x8F` | eco do opcode de identify | **observado indiretamente** em 2026-11-12: o app decodificou a resposta, o que exige byte 0 = `0x8F`. O byte bruto exato é **inferido** da forma exigida pelo decoder; não foi capturado diretamente |
| 1..4 | `u32` little-endian | ID interno do dispositivo | **observado** via app em 2026-11-12: o ID decodificado foi `1168`. A sequência exata de bytes 1..4 (`90 04 00 00`) é **inferida** da forma exigida pelo decoder, não capturada diretamente; os bytes brutos não foram logados separadamente |
| 5..63 | não interpretado | bytes adicionais/reservados | **desconhecido**; o decoder desta fase ignora tudo depois do byte 4 |

Forma necessária para o decoder produzir o ID `1168` (`0x00000490`) em
little-endian; os bytes brutos não foram logados separadamente nesta
execução:

```text
8F 90 04 00 00 ...
```

A decodificação bem-sucedida pelo app é a evidência de que a resposta
satisfez essa forma; a captura bruta da resposta não foi registrada.

O decoder atual:
- rejeita respostas com menos de 5 bytes;
- rejeita opcode diferente de `0x8F`;
- lê o ID como `reply[1] | reply[2] << 8 | reply[3] << 16 | reply[4] << 24`
  e normaliza para `u32`;
- **não valida checksum da resposta**, porque a presença e a cobertura desse
  checksum são **desconhecidas** nesta fase.

### Fluxo de identificação no app

1. Abrir o dispositivo WebHID escolhido pelo usuário.
2. Enviar `identifyPacket()` com `sendFeatureReport(0, ...)`.
3. Ler a resposta com `receiveFeatureReport(0)`.
4. Decodificar opcode e ID com `decodeIdentify`.
5. Procurar o ID em `K86_DEVICES`.
6. Se o ID for conhecido, validar VID e PID; se não baterem, lançar
   `UnsupportedDeviceError` e fechar o transporte.
7. Se o ID for desconhecido, criar a sessão com `readOnly: true` e a definição
   conservadora. Nenhuma gravação de configuração/estado existe nessa sessão.
8. Fechar o transporte ao desconectar ou ao final da sessão.

## 4. Checksums

A regra observada nas fontes é `0xFF - (sum & 0xFF)`:

| Modo | Bytes cobertos | Byte onde o resultado é gravado | Uso nesta fase |
| --- | --- | --- | --- |
| Bit7 | 0..6 | 7 | pedido de identify (aceito nesta unidade em 2026-11-12; a validação do checksum pelo firmware permanece desconhecida) |
| Bit8 | 0..7 | 8 | não usado no identify; disponível para comandos futuros |
| none | — | — | não usado nesta fase |

Vetores dos testes unitários:

```text
checksum([0x8F], "bit7")                  = 0x70
checksum([0x07, 0x01, 0x02], "bit8")     = 0xF5
len(buildPacket(0x8F))                    = 64
buildPacket(0x8F)[0]                      = 0x8F
buildPacket(0x8F)[7]                      = 0x70
```

`buildPacket` usa Bit7 por padrão. O Bit8 não é exercitado pelo identify
desta fase; a documentação o registra para não perder a convenção antes de
qualquer trabalho futuro de gravação de configuração/estado.

## 5. Validação em hardware

Execução registrada em **2026-11-12**:

| Item | Resultado observado |
| --- | --- |
| Host | Windows 11 |
| Navegador | Microsoft Edge 157.0.4341.46 |
| App | `http://127.0.0.1:5173` |
| Dispositivo | `USB\VID_3151&PID_4015`, interface vendor-defined `MI_02`, rótulo do chooser “Gaming Keyboard” |
| Conexão | WebHID chooser usado; app chegou a **CONECTADO** |
| Identidade | “Attack Shark K86 (1168) identificado com sucesso”; NOME `Attack Shark K86 (1168)`, ID interno `1168`, família `yc500`, layout `ANSI, sem cedilha`, selo **SOMENTE LEITURA** |
| Identify | feature report `0x8F` enviado com report ID `0`; o app decodificou a resposta como ID `1168`. O decoder exige byte 0 = `0x8F` e bytes 1..4 = `90 04 00 00`. Os bytes brutos não foram logados separadamente nesta execução; a sequência exata é **inferida** da forma exigida pelo decoder, não capturada diretamente |
| Checksum do pedido | byte 7 `0x70` aceito no round-trip; ver limitação na seção 3 |
| Desconexão | app voltou a **DESCONECTADO** e ao cartão de referência, sem dados ao vivo |
| Reconexão | segunda conexão real concluída; o chooser exibiu “Gaming Keyboard - Emparelhado” após a primeira permissão |
| Modo demo | **CONECTADO (DEMO)**, selo **DEMO** e “Sessão de demonstração com um dispositivo virtual. Nenhum hardware real está conectado.” |
| Tráfego HID | somente o feature report de identify; nenhuma gravação de configuração, keymap, RGB, macro, tela, perfil ou firmware; nenhuma atualização de firmware ou erase de flash |

Capturas da execução:

- [Dashboard conectado](../qa/screenshots/foundation-connected.png)
- [Modo demo](../qa/screenshots/foundation-demo.png)
- [Dashboard desconectado](../qa/screenshots/foundation-disconnected.png)

Limitações desta validação: uma unidade, um navegador (Edge 157.0.4341.46) e
um sistema operacional. O teste não cobre as revisões `2730` e `4094`, não
prova que o firmware valida o checksum e não valida nenhuma operação de
gravação de configuração/estado.

## 6. Fontes e rastreabilidade

- **Design:** `docs/superpowers/specs/2026-11-12-k86-studio-design.md`,
  especialmente §7 (detecção e protocolo), §13 (riscos e desconhecidos) e
  §15 (fonte do protocolo e famílias).
- **Plano:** `docs/superpowers/plans/2026-11-12-foundation.md`, tarefas 2, 3,
  6 e 10 e as restrições globais.
- **Código e testes deste repositório:**
  - `src/protocol/checksum.ts`
  - `src/protocol/packet.ts`
  - `src/protocol/identify.ts`
  - `src/protocol/checksum.test.ts`
  - `src/protocol/packet.test.ts`
  - `src/protocol/identify.test.ts`
  - `src/devices/k86.ts`
  - `src/hid/webhid.ts`
  - `src/session/k86-session.ts`
- **Análise estática do app oficial:** usada apenas como conferência factual
  de opcode, identidade e checksum. Nenhum código, asset ou texto do app do
  fornecedor foi copiado para este repositório, e o app oficial não foi
  executado como parte desta tarefa.
- **Documentação factual do sharkfin (GPL-3.0-or-later):** usada apenas como
  referência cruzada, conforme previsto no design §15. Nenhum código do
  sharkfin foi copiado.
- **Enumeração HID local (somente leitura):** em 2026-11-12, o Windows
  enumerou `VID_3151&PID_4015`, incluindo a interface `MI_02` com a coleção
  `usagePage 0xFFFF, usage 0x0002` e `FeatureReportByteLength = 65`. Isso
  confirmou a topologia HID, mas não enviou identify.
- **Validação WebHID:** em 2026-11-12, no Windows 11, Microsoft Edge
  157.0.4341.46, app em `http://127.0.0.1:5173`, dispositivo
  `USB\VID_3151&PID_4015` (`MI_02`, chooser “Gaming Keyboard”). O round-trip
  de identify e os estados de conexão, desconexão, reconexão e demo estão na
  seção 5 e em [`docs/qa/hardware-checklist.md`](../qa/hardware-checklist.md).

## 7. Limitações e desconhecidos

- Se o firmware **valida** o checksum ou apenas o ignora; a aceitação do
  pedido foi observada nesta unidade, mas não distingue os dois casos.
- O significado dos bytes 5..63 da resposta e se existe checksum de resposta.
- O comportamento de outras unidades, outras revisões (`2730` e `4094`),
  outros navegadores e outros sistemas operacionais.
- Qualquer opcode, layout ou checksum de gravação de configuração/estado,
  keymap, RGB, macro, tela, perfil, configuração ou firmware.

## 8. Fora de escopo desta fase

Os itens abaixo **não** fazem parte da fundação e não devem ser implementados
ou testados como se estivessem validados:

- **gravações de configuração/estado no hardware** (o identify usa apenas um
  feature report de comando e não grava configuração nem flash);
- **keymap** (leitura ou escrita de teclas, camadas e combos);
- **RGB / lighting** (efeitos, brilho, velocidade, lateral e pintura por tecla);
- **macros**;
- **tela** (imagem, slots, animação e relógio);
- **firmware** (atualização, OTA, bootloader e flash);
- perfis onboard, backup/restore, debounce, sleep, opções e reset de fábrica.

A fase termina com identificação, dashboard, modo demo e a guarda de
privacidade. Qualquer avanço para gravação de configuração/estado exige novo
documento de protocolo, novos vetores de teste e validação explícita no
hardware.
