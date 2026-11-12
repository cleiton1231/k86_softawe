# K86 Screen/GIF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar imagens estáticas e GIFs animados para a tela TFT 240x135 do K86, com preview, timeline, delay, seleção de slot e progresso, sem telemetria.

**Architecture:** O codec de tela é puro (RGBA → RGB565 coluna-maior, pacotes `0xA5`/`0x25`). A decodificação de GIF/PNG usa `ImageDecoder`/`createImageBitmap` no navegador. `K86Session` ganha uma operação de transferência que faz o announce, espera o ack e envia as páginas de cada frame. A página Screen consome esses módulos.

**Tech Stack:** React, TypeScript, Vite, Vitest, WebHID, `ImageDecoder` (Chromium).

**Spec:** `docs/superpowers/specs/2026-11-12-k86-studio-design.md` (seção Screen) e a análise do app oficial registrada em `docs/analysis/protocol-k86.md`.

## Global Constraints

- GPL-3.0-or-later; sem rede; sem telemetria.
- Tela 240x135, RGB565 big-endian, ordem coluna-maior, 56 bytes por página.
- Announce `0xA5`: frame em [1], frame count em [2], delay em [3], length em [4..6], bbox em [8..15], length alto em [16..17], slot em [18].
- Data `0x25`: frame [1], frame count [2], delay [3], page [4..5], chunk length [6], 56 bytes em [8..63].
- Checksum Bit7 cobre 0..6 no byte 7.
- Writes na tela gravam na flash do teclado. Confirmar antes do primeiro envio real; nunca apagar a flash inteira.
- Não prometer persistência até o teste no hardware. Se o GIF não persistir, documentar streaming.

## Review Focus

- **Frame count zero/um:** imagem estática usa 1 frame; GIF com 1 frame deve funcionar como imagem estática.
- **Frame count acima do limite:** recusar antes de enviar, com mensagem clara.
- **Ack ausente:** abortar sem enviar páginas e mostrar erro.
- **Desconexão no meio do upload:** parar, não continuar enviando, informar o usuário.
- **Slot inválido:** aceitar apenas 0..4.
- **GIF grande:** limitar frames e mostrar o limite calculado.

---

## Task 1: Codec e pacotes de tela

**Files:**
- Create: `src/protocol/screen.ts`
- Test: `src/protocol/screen.test.ts`

**Interfaces:**
- Produces: `SCREEN_WIDTH = 240`, `SCREEN_HEIGHT = 135`, `SCREEN_PAGE_DATA = 56`, `SCREEN_SLOTS = 5`.
- Produces: `rgbTo565(r: number, g: number, b: number): [number, number]`.
- Produces: `encodeScreenPixels(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array`.
- Produces: `screenAnnouncePacket(args: { frame: number; frameCount: number; delayMs: number; length: number; bbox: { left: number; top: number; right: number; bottom: number }; slot: number }): Uint8Array`.
- Produces: `screenPagePackets(args: { frame: number; frameCount: number; delayMs: number; data: Uint8Array }): Uint8Array[]`.
- Produces: `maxScreenFrames(memoryBytes?: number): number`.

- [ ] **Step 1: Escrever os testes que falham**

Testar:
- `rgbTo565(255, 0, 0)` → `[0xf8, 0x00]`.
- `rgbTo565(0, 255, 0)` → `[0x07, 0xe0]`.
- `rgbTo565(0, 0, 255)` → `[0x00, 0x1f]`.
- `encodeScreenPixels` de 2x2 com cores distintas produz 8 bytes em ordem coluna-maior (x=0,y=0), (x=0,y=1), (x=1,y=0), (x=1,y=1).
- `screenAnnouncePacket` de um frame 240x135, delay 50, slot 2 tem: [0]=0xA5, [1]=0, [2]=1, [3]=50, [4..6] length, [8..11] 0,0,240,135, [16..17] length alto, [18]=2, [7]=checksum.
- `screenPagePackets` de 120 bytes gera 3 pacotes; o último tem chunk length 8 e padding zero; cada pacote tem [0]=0x25, [1]=frame, [2]=count, [3]=delay, [4..5]=page, [6]=len, [7]=checksum, dados em 8.
- `maxScreenFrames` com 7 MiB retorna um número entre 1 e 255.

- [ ] **Step 2: Rodar e ver falhar**

`npm.cmd run test:run -- src/protocol/screen.test.ts` → FAIL por módulo ausente.

- [ ] **Step 3: Implementar**

`encodeScreenPixels` percorre `for x` e depois `for y`, lê `(y*width + x)*4`, converte para RGB565 big-endian e grava dois bytes. `rgbTo565` usa `(r>>3)<<11 | (g>>2)<<5 | (b>>3)`.

`screenAnnouncePacket` usa `buildPacket(0xA5, [frame, frameCount, delay, len&255, (len>>8)&255, 0], "bit7")`, depois escreve bbox em 8..15, length alto em 16..17 e slot em 18.

`screenPagePackets` usa `buildPacket(0x25, [frame, frameCount, delay, page&255, page>>8, chunk.length], "bit7")` e copia no máximo 56 bytes em 8..63.

`maxScreenFrames` usa a fórmula do app oficial: `memoryBytes` padrão 7*1024*1024; `frameBytes = (Math.floor(240*135*2/4096)+1)*4096`; `Math.max(1, Math.min(255, Math.floor((memoryBytes-4096)/frameBytes)-5))`.

- [ ] **Step 4: Rodar e ver passar**

- [ ] **Step 5: Commit**

`feat: screen codec`

---

## Task 2: Decodificação de imagem/GIF

**Files:**
- Create: `src/screen/decode.ts`
- Test: `src/screen/decode.test.ts`

**Interfaces:**
- Produces: `interface ScreenAnimation { width: number; height: number; delayMs: number; frames: Uint8ClampedArray[] }`.
- Produces: `fitToScreen(source: { width: number; height: number }, targetWidth?: number, targetHeight?: number): { sx: number; sy: number; sw: number; sh: number }`.
- Produces: `decodeScreenFile(file: File): Promise<ScreenAnimation>`.
- Produces: `rgbaFromCanvas(canvas: HTMLCanvasElement): Uint8ClampedArray`.

- [ ] **Step 1: Testes**

Testar `fitToScreen` com uma imagem 480x270 (cover exato), 100x100 (cover centralizado), 1000x100 (cover horizontal) e 1x1. Testar `rgbaFromCanvas` com um canvas 2x1 mockado? Melhor manter `fitToScreen` puro e testar o decoder manualmente no hardware.

- [ ] **Step 2: Implementar**

`decodeScreenFile`:
- Se `file.type === "image/gif"`, usar `new ImageDecoder({ data: await file.arrayBuffer(), type: "image/gif" })`, `await decoder.tracks.ready`, `const count = decoder.tracks.selectedTrack.frameCount`, para cada frame `const { image } = await decoder.decode({ frameIndex: i })`, desenhar em canvas 240x135 com `fitToScreen`, `getImageData`, push `data`, `image.close()`. Delay: usar `decoder.tracks.selectedTrack.frameCount` e `image.duration` (microssegundos) para calcular a média; fallback 50ms.
- Se for PNG/WebP/JPEG, `createImageBitmap(file)`, desenhar cover em canvas 240x135, um frame, delay 0.
- Fechar o decoder.
- Erros claros em português.

- [ ] **Step 3: Build/test**

`npm.cmd run test:run -- src/screen/decode.test.ts` e `npm.cmd run typecheck`.

- [ ] **Step 4: Commit**

`feat: screen image decoder`

---

## Task 3: Transferência pela sessão

**Files:**
- Modify: `src/session/k86-session.ts`
- Test: `src/session/k86-session-screen.test.ts`

**Interfaces:**
- Produces: `interface ScreenTransferOptions { slot: number; onProgress?: (done: number, total: number) => void; signal?: AbortSignal }`.
- Produces: `K86Session.sendScreenAnimation(animation: ScreenAnimation, options: ScreenTransferOptions): Promise<void>`.
- Produces: `class ScreenAckError extends Error`.

- [ ] **Step 1: Testes com FakeTransport**

- Um frame de 240x135: verifica que o primeiro packet é `0xA5`, que o FakeTransport responde `[0xA5, 1]`, e que os packets `0x25` são enviados na ordem.
- Dois frames: verifica `frameCount=2`, `frame=1` nos packets do segundo frame e o delay.
- Ack ausente: FakeTransport sempre responde `[0xA5, 0]`; `sendScreenAnimation` rejeita com `ScreenAckError` e não envia `0x25`.
- Slot inválido: rejeita antes de enviar.
- AbortSignal: aborta entre frames e rejeita.

- [ ] **Step 2: Implementar**

`sendScreenAnimation` valida `slot` 0..4, `frames.length` 1..max. Para cada frame, gera o RGB565 com `encodeScreenPixels`. O announce usa frame 0, frameCount, delay, length do primeiro frame, bbox 0,0,240,135, slot. Envia `sendFeatureReport(0, announce)`, depois `receiveFeatureReport(0)` até 10 vezes com 100ms, exigindo `reply[1] === 1`. Depois, para cada frame, envia os `screenPagePackets` com 2ms entre páginas; atualiza `onProgress` após cada frame. Se `signal.aborted`, lança `AbortError`.

Adicionar `sendFeatureReport`/`receiveFeatureReport` públicos na sessão, delegando ao transporte.

- [ ] **Step 3: Rodar testes**

`npm.cmd run test:run -- src/session/k86-session-screen.test.ts`.

- [ ] **Step 4: Commit**

`feat: screen transfer`

---

## Task 4: Página Screen

**Files:**
- Modify: `src/pages/Screen.tsx` (criar se ainda for placeholder)
- Create: `src/screen/useScreenUpload.ts`
- Test: `src/pages/Screen.test.tsx`

**Interfaces:**
- Produces: `useScreenUpload()` com `state` (`idle`, `decoding`, `ready`, `sending`, `done`, `error`), `animation`, `fileName`, `delayMs`, `slot`, `loadFile(file)`, `setDelayMs`, `setSlot`, `send(session)`, `reset()`.
- A página usa `useDevice` para a sessão e mostra "Conecte o teclado para enviar".

- [ ] **Step 1: Testes**

- Sem sessão: o botão de envio fica desabilitado e a página explica que é preciso conectar.
- Arquivo inválido: mostra erro.
- Arquivo válido (mock de `decodeScreenFile`): mostra frame count, delay e slot; `send` chama `session.sendScreenAnimation` com os valores escolhidos.
- Durante o envio: mostra progresso e desabilita o botão.
- Após sucesso: mostra "Enviado para o slot N" e um aviso de que o conteúdo anterior pode ter sido substituído.

- [ ] **Step 2: Implementar**

Layout:
- Área de preview 240x135 com canvas.
- Dropzone/input de arquivo (PNG, GIF, WebP, JPEG).
- Timeline horizontal com frames e seleção.
- Controle de delay (ms), slot 1..5, botão "Enviar para a tela".
- Barra de progresso e log.
- Aviso de segurança: "Isso grava na tela/flash do teclado e pode substituir o conteúdo do slot. Use cabo USB. Não há erase de flash nesta tela."
- Confirmação modal antes do primeiro envio: "Enviar para o slot N? O conteúdo atual pode ser substituído."

Não adicionar rede.

- [ ] **Step 3: Rodar testes e build**

`npm.cmd run test:run -- src/pages/Screen.test.tsx`, `npm.cmd run typecheck`, `npm.cmd run build`.

- [ ] **Step 4: Commit**

`feat: screen page`

---

## Task 5: Segurança, limites e documentação

**Files:**
- Modify: `src/protocol/screen.ts` (limites)
- Modify: `src/screen/useScreenUpload.ts` (rate limit)
- Modify: `docs/analysis/protocol-k86.md`
- Create: `docs/qa/screen-gif-checklist.md`

- [ ] **Step 1: Limites**

- Recusar mais de `maxScreenFrames()` frames com mensagem clara.
- Recusar arquivo > 20 MB.
- Limitar delay a 10..1000 ms.
- Desabilitar envio durante upload; abortar em desconexão.
- Avisar que a gravação repetida pode desgastar a flash; no máximo um envio por 10 segundos.

- [ ] **Step 2: Documentar**

Adicionar ao protocolo a seção "Screen transfer" com `0xA5`/`0x25`, header, checksums, ack, slot, frame count/delay, e a limitação de que a persistência ainda será validada. Criar checklist de hardware:
- enviar PNG 240x135 para slot 5;
- observar a tela;
- enviar GIF de 3 frames com delay 100ms;
- observar animação;
- desconectar e reconectar; verificar se a animação persiste;
- registrar tudo.

- [ ] **Step 3: Verificação**

`npm.cmd run typecheck`, `npm.cmd run test:run`, `npm.cmd run build`.

- [ ] **Step 4: Commit**

`docs: screen gif protocol`

---

## Self-Review

- Cobertura: codec, decoder, transferência, UI, limites e documentação.
- Riscos: a persistência do GIF no firmware só será confirmada no hardware; o plano trata isso como desconhecido.
- Segurança: confirmação antes de gravar, sem erase, limites de frames e delay.
- Testes: vetores de bytes para o codec e ack; o decoder de GIF é validado no hardware porque depende de `ImageDecoder`.
