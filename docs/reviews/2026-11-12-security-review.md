# Revisão de segurança — K86 Studio

- **Data:** 2026-11-12
- **Snapshot auditado:** `8dcd885` + bridge `a82aabc`
- **Revisor:** subagente independente `security-auditor`
- **Escopo:** código, Electron, HID, CSP, dependências, licenças e privacidade
- **Restrições:** revisão somente leitura; sem hardware, sem executar o app do
  fornecedor e sem rede

## Veredito

**Aprovado com ressalvas.** O código não contém telemetria, analytics, `fetch`,
`XMLHttpRequest`, `WebSocket`, `sendBeacon`, fontes/scripts remotos ou endpoints
do fornecedor. O isolamento do Electron está correto. O risco relevante estava
na navegação ampla (`file:///`) e no IPC HID bruto; ambos foram endurecidos nesta
rodada. A distribuição binária ainda exige empacotamento, fuses, assinatura e
avisos de terceiros.

## Achados e tratamento

| ID | Severidade | Achado | Status |
| --- | --- | --- | --- |
| A-01 | Alto | Navegação aceitava qualquer `file:///` e não havia handler de permissões; uma página local herdaria o preload HID | **Corrigido**: navegação restrita a `dist/` e ao dev server, `will-redirect`/`will-frame-navigate`, permissões negadas, `will-attach-webview` bloqueado e remetente de IPC validado |
| A-02 | Médio | `hid:send-feature` aceitava qualquer payload/opcode e não validava remetente | **Corrigido**: exige `Uint8Array` de 64 bytes, remetente confiável e opcode `0x8F` (identify); tela usa o canal tipado `screen:send` com teto de 122.749 pacotes |
| M-01 | Médio | Permissões do Electron aprovadas por padrão | **Corrigido**: `setPermissionRequestHandler` e `setPermissionCheckHandler` negam tudo |
| M-02 | Médio | Testes de segurança cobriam só `src/` | **Parcial**: varredura estendida a `electron/` e novos padrões; `npm run check:build` valida CSP/assets no build. Faltam testes do main com HID fake |
| M-03 | Médio | 8 vulnerabilidades dev-only (4 críticas) | **Parcial**: `concurrently` atualizado para 10.0.7; críticas caíram de 4 para 2, ambas em `vitest`/`tinypool`. `npm audit --omit=dev` = 0. Atualização do Vitest 5 fica pendente por ser breaking |
| M-04 | Médio | Sem empacotamento, fuses, assinatura ou avisos de terceiros | **Parcial**: `THIRD_PARTY_NOTICES.md` adicionado. Empacotamento/fuses/assinatura ficam para a distribuição binária |
| B-01 | Baixo | Handle HID global e fechamento não escopado | **Parcial**: desconexão agora fecha o dispositivo; IDs de conexão por operação ainda não implementados |
| B-02 | Baixo | Cancelamento de tela fire-and-forget | **Pendente**: job/ID de cancelamento e confirmação de parada |
| B-03 | Baixo | CSP sem `base-uri`/`form-action`/`object-src` e com `style-src 'unsafe-inline'` | **Corrigido**: diretivas adicionadas e `unsafe-inline` removido; CSS externo validado no Electron |
| B-04 | Baixo | Limite de frames aplicado depois do decode | **Corrigido**: `assertFrameBudget` e `assertSourceDimensions` rodam antes/durante o decode |
| B-05 | Baixo | `--dev` e CDP sobreviviam ao build de produção | **Parcial**: `DEV` agora exige `!app.isPackaged`, devTools desabilitado em produção e allowlist de dev só no modo dev. CDP continua sendo procedimento de teste explícito |
| B-06 | Baixo | Sem teto de lote e I/O HID síncrono no main | **Parcial**: teto de 122.749 pacotes adicionado; I/O continua síncrono e sem watchdog |
| B-07 | Baixo | Path do dispositivo exposto ao renderer | **Corrigido**: o bridge devolve só VID, PID e nome |
| I-01 | Informativo | Zero telemetria não provado em runtime | **Verificado parcialmente**: `fetch` externo bloqueado pela CSP/filtro de sessão; navegação para arquivo fora de `dist/` bloqueada; permissão de notificação negada em teste CDP |
| I-05 | Informativo | Caminhos absolutos em README/docs | Aceito: documentação local; não são segredos |

## Evidências da validação runtime

Executadas no Electron de produção (`file:///.../dist/index.html`):

- `fetch("https://example.com")` → `TypeError: Failed to fetch` (CSP +
  `webRequest`).
- `location.href = "file:///C:/Windows/win.ini"` → navegação bloqueada; a janela
  permaneceu no app.
- `window.open("https://example.com")` → `null` (janela negada).
- `Notification.requestPermission()` → `denied`.
- `sendFeature(new Uint8Array(63))` → rejeitado com “payload HID inválido”.
- Conexão nativa e identify continuaram funcionando depois das mudanças.

## Riscos residuais

1. **Distribuição binária**: falta empacotamento com ASAR/`asarUnpack`, fuses,
   assinatura e avisos completos do Chromium.
2. **Vitest/tinypool**: duas vulnerabilidades críticas dev-only; não afetam o
   runtime, mas devem ser resolvidas ao migrar para Vitest 5.
3. **Main process sem testes automatizados**: `electron/main.cjs` e
   `electron/k86-hid.cjs` dependem de teste manual; falta um HID fake para
   cobrir lotes, cancelamento e desconexão.
4. **Captura de rede do Chromium/Electron**: a análise estática + CSP + filtro
   de sessão são fortes, mas uma captura em VM com firewall ainda é a prova
   definitiva de zero tráfego.
5. **Cancelamento/job**: um cancelamento atrasado pode atingir um job novo; a
   janela ainda mostra `idle` antes da confirmação do main.

## Recomendações seguintes

- Adicionar testes do main com um `node-hid` fake e um harness de IPC.
- Implementar `connectionId`/`jobId` e confirmação de cancelamento.
- Migrar para Vitest 5 e reavaliar o audit dev.
- Empacotar com Electron Builder/Forge, `asarUnpack` do `node-hid`, fuses e
  assinatura antes de publicar binário.
- Fazer captura de tráfego em VM limpa para o relatório final de privacidade.
