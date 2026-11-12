# Checklist de hardware — tela e GIFs

- **Execução registrada:** 2026-11-12
- **Status:** executado com sucesso (confirmação visual do GIF de 106 frames pendente)
- **Host:** Windows 11
- **App:** K86 Studio em Electron 45.3.1 + node-hid 3.4.0
- **Alvo:** `3151:4015`, ID interno `1168`, família `yc500`, ANSI sem cedilha
- **Interface HID:** coleção vendor-defined `0xFFFF/0x0002`, interface `MI_02`
- **Slot usado nos testes do app:** Slot 5 (índice `4`)
- **Escopo:** gravação de imagem estática e animações na tela TFT 240×135
- **Firmware:** nenhuma atualização, erase ou reset é executado

> **Aviso:** a gravação substitui o conteúdo do slot. Não há erase de flash nesta
> tela. Use cabo USB e não desconecte o teclado durante o envio.

## Pré-condições

- [x] K86 conectado por cabo USB.
- [x] Driver/app oficial do fabricante fechado.
- [x] Nenhum outro programa usando a interface vendor-defined.
- [x] Node.js portátil em `C:\Users\vitor\Tools\node-v26.13.1-win-x64`.
- [x] Dependências instaladas (`electron`, `node-hid`).
- [x] Build de produção gerado (`npm.cmd run build`).
- [x] Electron aberto com `electron . --remote-debugging-port=9223` para o teste
      automatizado.

## Matriz de testes

| # | Arquivo / origem | Frames | Slot | Caminho | Resultado |
| --- | --- | --- | --- | --- | --- |
| 1 | PNG estático 240×135 | 1 | 1 (índice 0) | Python + hidapi | aceito; 1.158 páginas em ~4,6 s |
| 2 | `test-giphy-3.gif` | 3 | 1 e 5 | Python + hidapi | aceito; ~13,9 s por envio |
| 3 | trecho de `giphy.gif` | 12 | 1 | Python + hidapi | aceito; ~55,6 s |
| 4 | `test-redgreen.gif` | 2 | 1 | Python + hidapi | aceito; ~9,3 s; **animação confirmada pelo usuário** |
| 5 | `test-giphy-3.gif` | 3 | 5 | Electron + node-hid | aceito; ~11 s incluindo decode/UI |
| 6 | `giphy (1).gif` | 44 | 5 | Electron + node-hid | aceito; 266 s |
| 7 | `test-giphy-106.gif` | 106 | 5 | Electron + node-hid | aceito; 379 s |

### Arquivos usados

- `C:\Users\vitor\Downloads\giphy (1).gif`: 480×330, 44 frames, ~1,1 MB,
  delay 70 ms.
- `C:\Users\vitor\Downloads\giphy.gif`: 480×270, 146 frames, ~6,2 MB,
  delay 100 ms. O arquivo original passa do limite de 106 frames.
- `C:\Users\vitor\AppData\Local\Temp\k86\test-giphy-3.gif`: 3 frames extraídos
  do `giphy (1).gif`, delays 70/60/70 ms.
- `C:\Users\vitor\AppData\Local\Temp\k86\test-giphy12.gif`: 12 frames extraídos
  do `giphy.gif`, delay 100 ms.
- `C:\Users\vitor\AppData\Local\Temp\k86\test-redgreen.gif`: 2 frames
  sintéticos (vermelho e verde), delay 500 ms.
- `C:\Users\vitor\AppData\Local\Temp\k86\test-giphy-106.gif`: 106 frames
  extraídos do `giphy.gif`, delay 100 ms, ~6,9 MB, dentro do limite de 20 MB do
  app e do limite de 106 frames da tela.

## Passos executados

### 1. Preparar o build e abrir o app desktop

```powershell
$env:Path = "C:\Users\vitor\Tools\node-v26.13.1-win-x64;" + $env:Path
cd C:\Users\vitor\Projects\k86-studio
npm.cmd run build
.\node_modules\electron\dist\electron.exe . --remote-debugging-port=9223
```

**Esperado:** janela do K86 Studio abre; Dashboard mostra **App desktop** no
cartão de conexão; o bridge `window.k86Native` existe no renderer.

**Resultado:** janela abriu em `file:///.../dist/index.html`; o renderer expôs
`window.k86Native`; a CSP de produção não bloqueou os scripts.

### 2. Conectar pelo bridge nativo

Clique em **Conectar teclado**. Não há seletor do navegador.

**Esperado:** status **Conectado**, modelo `Attack Shark K86 (1168)`, selo
**Tela habilitada**.

**Resultado:** **CONECTADO**, `Attack Shark K86 (1168) identificado com
sucesso`, selo **TELA HABILITADA**.

### 3. Enviar uma imagem estática

**Esperado:** a tela mostra a imagem; o app informa o slot e o número de frames.

**Resultado:** PNG estático aceito pelo firmware; 1.158 páginas em ~4,6 s pelo
emissor Python. O caminho Electron usa o mesmo codec e foi validado com os GIFs
abaixo.

### 4. Enviar um GIF pequeno

**Esperado:** a tela anima; o progresso chega a 100%; o app mostra “Enviado para
o slot 5”.

**Resultado:** o GIF de 3 frames foi aceito no slot 5 pelo Electron em ~11 s.
O GIF sintético vermelho/verde foi confirmado em animação pelo usuário.

### 5. Enviar o GIF de 44 frames

**Esperado:** o firmware aceita 44 × 1.158 páginas sem erro de acknowledge; a
tela anima; o slot 5 é substituído.

**Resultado:** **PASSOU**. O app mostrou “Enviado para o slot 5 (44 frames)” após
266 s. O tempo maior que o teórico reflete o envio síncrono de ~50.952
relatórios de 64 bytes e a carga concorrente no host.

### 6. Enviar o GIF de 106 frames (capacidade máxima)

**Esperado:** o firmware aceita 106 frames; a tela anima; o app mostra o slot 5
com 106 frames.

**Resultado:** **PASSOU**. O app mostrou “Enviado para o slot 5 (106 frames)”
após 379 s (~3,6 s por frame). O GIF usado foi extraído dos primeiros 106
frames do `giphy.gif`, com delay de 100 ms e ~6,9 MB. Este é o limite calculado
pelo orçamento de memória da tela; a confirmação visual da animação fica
pendente até a próxima sessão do usuário.

### 7. Desconectar e reconectar

**Esperado:** a animação permanece na flash da tela após desconectar/reconectar
o cabo; o app identifica o teclado novamente.

**Resultado:** pendente. Não desconecte o cabo durante o envio; a persistência
após um ciclo de energia será registrada na próxima reexecução.

## Observações técnicas

- O caminho WebHID leva ~100 ms por feature report no navegador. Um frame tem
  1.158 páginas; por isso GIFs grandes são inviáveis no WebHID.
- O caminho Electron envia o lote inteiro por um único IPC e usa `node-hid` no
  processo principal. O `sendFeatureReport` síncrono já pacing natural; um
  `setTimeout(1)` por página no Windows custa ~15,6 ms e foi removido.
- O processo principal cede o event loop a cada 16 páginas para manter o
  progresso, o cancelamento e a janela responsivos.
- O acknowledge é `00 A5 01 ...` no buffer de 65 bytes do hidapi (report ID no
  byte 0). O renderer recebe o relatório normalizado de 64 bytes.
- O limite de 106 frames vem do orçamento de 7 MiB da tela, menos 4 KiB usados
  pelo firmware, menos os cinco slots estáticos, com 16 páginas de 4 KiB por
  frame.

## Avisos de segurança

- A gravação é feita somente no slot escolhido; não há erase da flash inteira.
- Não há atualização de firmware, reset ou comando de bootloader.
- O app não faz backup do conteúdo anterior do slot. A gravação substitui o
  conteúdo.
- Não desconecte o cabo durante o envio.
- O driver oficial deve ficar fechado para evitar disputa pela interface HID.
- A validação cobre uma unidade (`1168`) e um firmware. As revisões `2730` e
  `4094` continuam não testadas.

## Solução de problemas

### “teclado K86 não encontrado”

**Causa provável:** cabo desconectado, driver oficial aberto ou interface
vendor-defined não enumerada.

**Ação:** reconecte o cabo, feche o app oficial e confirme a presença de
`USB\VID_3151&PID_4015` no Gerenciador de Dispositivos.

### “a tela do teclado não confirmou o início da transferência”

**Causa provável:** o announce não recebeu `A5 01`; a tela pode estar ocupada
ou o slot está em estado inconsistente.

**Ação:** aguarde alguns segundos, reconecte o cabo e tente novamente. Não
repita o envio em loop.

### “já existe um envio de tela em andamento”

**Causa:** outro envio ainda não terminou.

**Ação:** aguarde o progresso terminar ou clique em **Cancelar envio**. O
cancelamento é cooperativo e pode levar alguns milissegundos.

### Envio muito lento

**Causa:** o barramento HID é síncrono e cada frame tem 1.158 relatórios. A
carga de CPU do host e o driver USB também influenciam.

**Ação:** feche outros programas que usam o teclado ou o barramento USB; use
cabo USB direto, sem hub; evite enviar GIFs de 106 frames com o computador
ocupado.

## Registro final

```text
Data da execução: 2026-11-12
Responsável: controlador
Sistema operacional: Windows 11
App: K86 Studio (Electron 45.3.1, node-hid 3.4.0)
Commit do K86 Studio: preencher no commit final
Dispositivo observado: USB\VID_3151&PID_4015; ID interno 1168; MI_02
Resultado geral: [x] PASSOU   [ ] FALHOU
Observações: PNG estático, GIF de 3 frames, trecho de 12 frames e GIF
vermelho/verde aceitos; animação vermelho/verde confirmada pelo usuário; GIF de
44 frames e GIF de 106 frames aceitos no slot 5 pelo Electron. A confirmação
visual do GIF de 106 frames e a persistência após desconectar/reconectar o cabo
ficam pendentes para a próxima sessão.
```
