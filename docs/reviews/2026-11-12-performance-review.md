# Revisão de performance — K86 Studio

- **Data:** 2026-11-12
- **Snapshot:** bridge nativo `a82aabc` + documentação `8dcd885`
- **Revisor:** subagente independente de otimização
- **Método:** benchmarks Node/V8 isolados + medições de hardware já registradas
- **Restrição:** sem executar Electron, sem acessar HID

## Resumo

O envio de 106 frames levou **379 s** para **122.749 relatórios HID**:
**3,575 s/frame**, **3,088 ms por relatório** e **~17,7 KiB/s** de payload útil.
A CPU do renderer inteira custa **~84 ms** e o loop do main sem HID **~12 ms**:
juntos, **menos de 0,03%** do tempo. **O gargalo é a escrita HID síncrona, não o
JavaScript, o encode, os pacotes, o IPC ou o React.**

O caminho Electron foi mantido porque o WebHID leva ~100 ms por feature report;
um único frame tem 1.158 páginas. Não há otimização de software que transforme
minutos em segundos sem mudar o transporte ou reduzir a quantidade de frames.

## Medições principais

| Etapa | 1 frame | 106 frames | % dos 379 s |
| --- | ---: | ---: | ---: |
| `encodeScreenPixels` | 0,15 ms | 15,6 ms | 0,004% |
| `screenPagePackets` | 0,14 ms | 14,7 ms | 0,004% |
| Pipeline completo (encode + pacotes + flat + concat) | — | 44,3 ms | 0,012% |
| `K86Session.sendScreenAnimation` com transporte no-op | — | 84,3 ms | 0,022% |
| Loop do main sem HID | — | 12,1 ms | 0,003% |
| `structuredClone` de 7,49 MiB + `Buffer.from` | — | 2,7 ms | 0,0007% |

Memória de pico estimada no caminho antigo: **~63 MiB** — 13,58 MiB de frames
RGBA, 6,59 MiB de RGB565, **33,86 MiB de 122.748 `Uint8Array` de 64 bytes**,
1,31 MiB de array `flat` e duas cópias do wire de 7,49 MiB.

## Mudanças aplicadas

| Mudança | Onde | Ganho |
| --- | --- | --- |
| `setImmediate` a cada 4 páginas em vez de 16, desacoplado do progresso | `electron/k86-hid.cjs` | bloqueio do main cai de ~49 ms para ~12 ms por chunk; custo < 0,1% |
| Progresso só na mudança de frame + dedupe no renderer | `k86-hid.cjs`, `k86-session.ts`, `useScreenUpload.ts` | ~7,8 mil eventos/re-renders → ~107 |
| Buffer de mensagem de 65 bytes reutilizado e cópia por offset | `k86-hid.cjs` | elimina ~122 mil alocações de message e views por transferência |
| IPC zero-copy no main | `electron/main.cjs` | evita uma cópia de 7,49 MiB |
| Limite de frames/dimensões antes e durante o decode | `decode.ts` | evita decodificar 146 frames para depois rejeitar; limita OOM |
| Canvas único reutilizado e sem cópia extra do `ImageData` | `decode.ts` | remove 106 canvases e ~13,7 MiB de cópias |
| Encode RGB565 sem tupla por pixel | `protocol/screen.ts` | ~6 ms/106 frames e menos 3,4 M arrays curtos |
| `ImageData` reutilizado no preview | `pages/Screen.tsx` | menos alocação por troca de frame |
| Animações bloqueadas no WebHID | `pages/Screen.tsx` | evita uma transferência de ~3,4 h no navegador |
| Teto de 122.749 pacotes no IPC e no `K86HidDevice` | `main.cjs`, `k86-hid.cjs` | evita lote ilimitado/DoS local |

## O que ficou pendente

| Prioridade | Item | Motivo |
| --- | --- | --- |
| P0 | Testar output report / interrupt / bulk em vez de feature report | única alavanca potencial de 2–3×; exige experimento de hardware e risco de protocolo |
| P1 | Construir páginas direto no buffer final | reduz pico de ~63 para ~21 MiB; ganho de tempo ~25 ms, risco médio de layout |
| P1 | Streaming `begin/frame/end` com backpressure | reduz memória para ~14 MiB e melhora cancelamento; muda o contrato do IPC |
| P2 | Guardar frames em RGB565 | reduz ~6,5 MiB retidos; preview passa a converter um frame sob demanda |
| P2 | Worker/utility process para HID | responsividade/watchdog; não acelera o HID |
| P2 | Menos frames (dedupe/half FPS) | única redução de tempo garantida e linear |
| P3 | Empacotamento ASAR/`asarUnpack` | necessário para distribuição, não para performance |

## Por que não otimizar agora

- **Bundle**: 259,85 kB brutos / 80,43 kB gzip; não é gargalo.
- **`structuredClone`/IPC**: 2,7 ms; o custo real é o write.
- **Virtualizar 106 botões**: 106 nós DOM são baratos; o problema era
  re-renderizar milhares de vezes, já mitigado.
- **Micro-otimizar checksum/`buildPacket`**: ~0,1 µs/pacote; o write é ~31 mil
  vezes mais caro por pacote.
- **`setTimeout(0/1)` para pacing**: medido em ~15,4–15,5 ms por chamada no
  Windows; adicionaria ~18 s/frame. Usar `setImmediate`.

## Como medir a próxima mudança

1. Use **ms por relatório** e o mesmo host/cabo/porta; a variância entre 44 e
   106 frames foi de ~1,7×.
2. Meça 3 frames para iterar (~11 s no baseline limpo) e 44/106 só para
   confiança.
3. No main: `process.hrtime.bigint()` por frame e
   `perf_hooks.monitorEventLoopDelay({ resolution: 10 })` durante o envio.
4. No renderer: `performance.mark/measure` em decode, encode, montagem e IPC;
   conte renders da `ScreenPage`.
5. Compare o wire buffer byte a byte (hash) antes/depois de qualquer mudança de
   layout.

## Conclusão

O caminho nativo está saudável: o tempo é dominado pelo transporte HID. As
mudanças aplicadas melhoram responsividade, memória e UX sem mexer no protocolo
validado. Um ganho grande só virá de pesquisa de transporte alternativa ou de
menos frames; o restante é otimização de conforto, não de minutos.
