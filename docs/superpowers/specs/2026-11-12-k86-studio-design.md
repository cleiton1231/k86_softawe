# K86 Studio: design

Data: 2026-11-12
Status: aguardando aprovação
Licença proposta: GPL-3.0-or-later

## 1. Intenção

Criar um configurador novo, local-first e sem telemetria para o teclado Attack Shark K86. O app deve cobrir o uso diário e a tela TFT sem depender do driver oficial, de conta, de nuvem, de anúncios ou de qualquer serviço do fabricante.

O usuário quer um app próprio, com todas as features relevantes do driver oficial, mas com código e interface novos. A análise do app oficial mostrou que ele é Electron e que o `iot_driver.exe` é um binário Rust com gRPC local e HID. Também há dependência de endpoints chineses para conta, comunidade, OTA, AI e clima.

## 2. Objetivos

- Detectar e identificar as três revisões conhecidas do K86: `3151:4015`, `3151:5002` e `3151:5056`.
- Remapear teclas, camada Fn, knob e combos.
- Controlar RGB, efeitos, brilho, velocidade, lateral e pintura por tecla.
- Criar, gravar e atribuir macros.
- Gerenciar perfis e backup/restore local.
- Ajustar configurações do teclado: debounce, sleep, auto-OS, Win lock, WASD/setas, reset.
- Enviar imagens e animações para a tela 240x135, com preview e seleção de slot.
- Ajustar o relógio da tela.
- Funcionar offline, sem rede, com CSP restritiva e sem telemetria.
- Ter modo demo com transporte fake para desenvolver sem hardware.

## 3. Não objetivos

- Conta, login, comunidade, compartilhamento, AI, chat, nuvem e OTA automático.
- Atualização de firmware na v1. O protocolo de boot existe, mas é riskante e fica fora do escopo inicial.
- Suporte a todos os teclados ROYUAN. O foco é o K86; a arquitetura pode acomodar outros depois.
- Executar o app oficial do fornecedor ou redistribuir seus arquivos.
- Coletar qualquer dado do usuário.

## 4. Anti-objetivos

- Um app que “funciona” enviando comandos não comprovados para o hardware.
- Um app que depende de CDN, fonte remota, analytics ou atualização automática.
- Um fork visual do driver oficial.
- Um projeto que mistura código proprietário do fornecedor com o nosso.

## 5. Restrições

- WebHID só funciona em navegadores Chromium (Chrome/Edge). A interface deve explicar isso e oferecer modo demo.
- A tela e os writes de flash exigem cabo USB; o app não deve prometer escrita pela conexão 2.4 GHz.
- As famílias `yc500` e `gen2` compartilham opcodes com significados diferentes. Um write na família errada pode atingir um registrador vivo.
- O protocolo será implementado a partir de fatos documentados e da análise estática. Nada de copiar código do sharkfin ou do app oficial.
- O projeto será GPL-3.0-or-later para manter compatibilidade com a comunidade e com qualquer trecho de protocolo reutilizado.

## 6. Abordagens consideradas

### A. Fork do sharkfin

Mais rápido para chegar perto da paridade. Já cobre K86, tela e várias features. Trade-off: herda arquitetura, visual e código Rust/Tauri; o app vira derivado GPL de outro projeto, não algo novo.

### B. App web novo com React + TypeScript + WebHID

Escolhida. Não tem backend, não tem rede e permite uma camada de protocolo pura e testável. Roda no Chrome/Edge e pode ser empacotado depois. Trade-off: WebHID é limitado a Chromium e o app não tem integração nativa com o sistema na v1.

### C. App desktop novo com Tauri ou Electron

Melhor experiência nativa e suporte a HID nativo, mas mais tempo até o primeiro build útil. Fica como envelope futuro do mesmo núcleo.

## 7. Arquitetura

```
src/
  app/            composição da aplicação e rotas
  pages/          Dashboard, Keys, Lighting, Screen, Macros, Settings, About
  ui/             componentes reutilizáveis
  hid/            transporte WebHID, descoberta e fake transport
  protocol/       pacotes, checksums, codecs e comandos por família
  devices/        definições das revisões do K86 e layouts
  storage/        backups, perfis e preferências locais
  styles/         tokens e estilos
tests/
  protocol/       vetores unitários
  ui/             testes de fluxo com fake transport
docs/
  analysis/       evidência do REA e auditoria de telemetria
  qa/             checklist de hardware
```

### Camadas

1. **Transporte**: interface `HidTransport` com `sendFeatureReport`, `receiveFeatureReport`, `sendReport` e `onInputReport`. Implementações: `WebHidTransport` e `FakeTransport`.
2. **Protocolo**: funções puras que montam e decodificam pacotes de 64 bytes. Nenhuma função de protocolo abre dispositivo.
3. **Sessão**: `K86Session` combina transporte + definição do dispositivo, faz identify, valida família e expõe operações de alto nível.
4. **Estado**: store leve com React context; sem dependência de estado global pesada.
5. **UI**: páginas e componentes; nunca monta pacotes diretamente.

### Detecção

- Filtrar `vendorId = 0x3151`, usage page `0xFFFF`, usage `0x0002`.
- Abrir o dispositivo escolhido pelo usuário via WebHID.
- Enviar `0x8F` e ler o ID interno.
- Mapear ID + PID para a definição:
  - `1168` / `3151:4015` → `yc500`
  - `2730` / `3151:5002` → `gen2`
  - `4094` / `3151:5056` → `gen2`
- Se a família não for reconhecida, entrar em modo somente leitura/demo e não permitir writes.

### Protocolo

- Relatórios de 64 bytes; checksum Bit7 cobre bytes 0..6, Bit8 cobre 0..7.
- Identify `0x8F`.
- Keymap: leitura/escrita por família; single-slot e bulk quando evidenciado.
- RGB: `0x07`/`0x87`, `0x08`/`0x88`, per-key picture `0x0C`/`0x8C`.
- Perfis: `0x05`/`0x85` (yc500), `0x04`/`0x84` (gen2).
- Debounce, sleep, opções e auto-OS conforme a tabela por família.
- Macros: `0x0B`/`0x8B` (gen2) e `0x16`/`0x8B` (yc500), com limite de slots e páginas.
- Tela: `0xA5` announce e `0x25` data, RGB565 big-endian, ordem coluna-maior, 56 bytes por página, 240x135, 5 slots.
- Relógio: `0x28`.

## 8. Features da v1

### Dashboard

- Estado da conexão, revisão, família, ID interno, versão de firmware quando disponível.
- Bateria/energia quando disponível.
- Atalhos para as áreas principais.
- Aviso claro quando o navegador não suporta WebHID.

### Keys

- Layout visual do K86 (75% + knob).
- Camada base e Fn.
- Seleção de tecla e atribuição de uso HID, mouse, consumer, macro ou especial.
- Combos e knob.
- Escrita por slot com confirmação e leitura de verificação.

### Lighting

- Efeitos do firmware, direção, cor, brilho e velocidade.
- Pintura por tecla.
- Luz lateral quando a revisão tiver.
- Preview local sem enviar até o usuário confirmar.

### Screen

- Canvas 240x135 com preview.
- Upload de imagem, encaixe cover, seleção de slot.
- Animação: GIF/APNG decodificado no navegador, frames enviados com delay; limite de frames e confirmação.
- Relógio da tela.
- Aviso de que a escrita exige cabo.

### Macros

- Editor de sequência com teclas, mouse, delays e repetição.
- Gravação local pela janela do app (não global).
- Slots onboard, leitura e escrita.
- Limite de tamanho e validação antes de enviar.

### Settings

- Perfis, debounce, sleep, auto-OS, Win lock, WASD/setas.
- Backup/restore em JSON.
- Reset de fábrica com confirmação dupla.
- Exportar diagnóstico local (sem dados pessoais).

### About/Privacy

- Licença, créditos, versão.
- Declaração de privacidade: sem rede, sem telemetria.
- Lista de endpoints do app oficial que **não** são usados.

## 9. Privacidade e segurança

- CSP: `default-src 'self'; connect-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'`.
- Nenhum `fetch`, `XMLHttpRequest`, `WebSocket` ou `sendBeacon` no código de produção.
- Nenhuma fonte, ícone ou script remoto.
- Dependências auditadas; lockfile commitado.
- Sem `eval`, `new Function` ou HTML não confiável.
- Dados ficam em `localStorage`/IndexedDB local; backup é um download iniciado pelo usuário.
- Writes perigosos têm confirmação explícita e validação de família.

## 10. Testes e validação

- Vitest para checksums, builders, codecs de tela, keymap e parsers.
- Fake transport para testar sessão e UI sem hardware.
- Testes de contrato: cada comando tem vetor de bytes esperado.
- Checklist de hardware em `docs/qa/hardware-checklist.md`:
  - identify e leitura;
  - leitura de keymap, RGB, configurações;
  - escrita reversível com backup;
  - upload de imagem e relógio;
  - teste de animação;
  - restauração do backup.
- Nenhum teste automatizado abre HID real.

## 11. Isolamento e ambiente

- Não instalar Podman nesta fase. A análise é estática e o app roda no navegador; não executamos o binário do fornecedor.
- Node 26.13.1 portátil já está em `C:\Users\vitor\Tools\node-v26.13.1-win-x64`.
- REA e Superpowers ficam em `C:\Users\vitor\Tools`, fora do PATH global.
- Se precisarmos de build reprodutível, adicionar um `Containerfile` e usar Podman depois; não é requisito da v1.
- Limpar ao final: arquivos temporários de análise e artefatos não usados. O código do projeto fica em `C:\Users\vitor\Projects\k86-studio`.

## 12. Marcos

1. **Fundação**: Vite + React + TS + Vitest, layout, fake transport, protocolo base e testes.
2. **Leitura**: identify, keymap, RGB, configurações e tela (leitura).
3. **Escrita segura**: keymap, RGB, perfis, configurações e backup.
4. **Tela**: imagem, slots, relógio e animação.
5. **Macros**: editor, slots e leitura/escrita.
6. **Polimento**: acessibilidade, PWA, documentação e build de produção.
7. **Envelope desktop** (futuro): Tauri com o mesmo núcleo.

## 13. Riscos e desconhecidos

- Nem todos os IDs de firmware são conhecidos; revisões futuras podem responder diferente.
- A escrita em flash pode travar o firmware se repetida; precisamos de rate limit e confirmação.
- O protocolo de animação precisa ser validado no hardware; o app deve falhar de forma segura.
- WebHID pode bloquear interfaces de teclado; usamos a interface vendor-defined, mas isso precisa ser confirmado na revisão do usuário.
- A licença GPL-3.0 é uma escolha; se o usuário quiser outro modelo, decidir antes de distribuir.

## 14. Decisões deixadas para o builder

- Nome final e identidade visual.
- Se o preview de animação usa canvas ou WebCodecs.
- Se o backup usa JSON puro ou um formato versionado com schema.
- Quais efeitos de RGB entram na v1 e quais ficam para depois.

## 15. Decisões do builder depois da revisão

Estas decisões respondem ao builder check e não precisam voltar ao usuário.

### Fonte do protocolo

Antes de implementar writes, criar `docs/analysis/protocol-k86.md` com a tabela de opcodes, layouts, checksums, fluxo de leitura/escrita, tempos e vetores de teste. Fontes: documentação factual do sharkfin (GPL-3.0) como referência cruzada, análise estática do app oficial e evidência do REA. Nenhum código do sharkfin ou do fornecedor será copiado. O documento deve marcar cada fato como observado, inferido ou desconhecido.

### Famílias suportadas na v1

As três revisões serão detectadas e lidas. Escritas serão validadas primeiro na família do teclado do usuário. A outra família fica marcada como experimental e somente leitura até haver teste em hardware. O app nunca escreve se a família não for reconhecida.

### Backup e restore

O backup inclui keymaps, camadas Fn, RGB por tecla, macros, perfis e configurações que puderem ser lidos de volta. A tela não entra no backup na v1, porque não há opcode de leitura de pixels comprovado; o app avisa que o conteúdo dos slots pode ser sobrescrito sem restauração. O reset de fábrica exige confirmação dupla e mostra o que será perdido.

### Perfis

Perfis são slots onboard do teclado, com keymap/RGB/macros próprios quando o firmware permitir. O app também mantém snapshots locais nomeados, que podem ser aplicados ao teclado. A UI distingue "perfil do teclado" de "snapshot local".

### Gravação de macros

A v1 grava eventos de teclado e mouse na janela do app, ou seja, a saída após o remapeamento. Fn e knob não são graváveis na v1 porque o navegador não vê o estado interno do teclado. Isso fica documentado na tela de macros. Uma captura nativa global pode entrar no envelope desktop futuro.

### Tela e animação

Os cinco slots são tratados como graváveis, mas o app avisa que o conteúdo original pode não ser recuperável. Imagem estática é enviada para um slot. Animação é transmitida enquanto o app estiver aberto, com limite de frames e delay; só será persistida se o protocolo provar que o firmware guarda frames. O app nunca apaga a flash inteira.

### Combos

Combos são tratados como uma atribuição de até três usos HID no slot da tecla, conforme o formato de slot documentado. A UI mostra o combo como uma tecla composta. O comportamento será validado em hardware antes de ser marcado como estável.

### Layout físico

O layout visual será parametrizado por variante (ANSI/ISO/ABNT2) e por revisão. O mapa de slots precisa ser confirmado contra o teclado do usuário antes de qualquer escrita de keymap.
