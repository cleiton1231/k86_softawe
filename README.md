# K86 Studio

Configurador **local-first** e **sem telemetria** para o teclado Attack Shark
K86. O app roda como aplicativo desktop (Electron) ou no navegador via WebHID,
sem backend, sem conta e sem enviar dados para serviços externos.

## Estado atual: tela TFT validada em hardware

O K86 Studio identifica o teclado, mostra o modelo e envia imagens e GIFs para
a tela TFT **240×135** em uma das cinco memórias da tela.

- **Protocolo de tela validado no K86 físico** (`3151:4015`, ID `1168`,
  família `yc500`, ANSI sem cedilha): announce `0xA5`, páginas `0x25`,
  RGB565 big-endian, coluna-maior, 56 bytes por página e 1.158 páginas por
  frame.
- **Electron + node-hid** é o caminho recomendado para GIFs. O processo
  principal fala com a interface vendor-defined `0xFFFF/0x0002` e envia o lote
  de relatórios sem o limite de ~100 ms por feature report do WebHID.
- **WebHID** continua disponível no navegador para identificar o teclado e
  testar a interface; para animações grandes, use o app desktop.
- As páginas **Keys**, **Lighting**, **Macros** e **Settings** ainda são
  planejadas. Não há gravação de keymap, RGB, macro, perfil ou firmware nesta
  versão.

## Validação em hardware

### Fundação (2026-11-12)

O K86 físico (`3151:4015`, ID `1168`) foi identificado no Microsoft Edge
157.0.4341.46, no Windows 11, com o app em `http://127.0.0.1:5173`. O Dashboard
mostrou `Attack Shark K86 (1168)`, ID interno `1168`, família `yc500`, layout
ANSI sem cedilha. Identify, desconexão, reconexão e modo demo foram
registrados. Veja [`docs/qa/hardware-checklist.md`](docs/qa/hardware-checklist.md).

### Tela e GIFs (2026-11-12)

O protocolo de tela foi validado primeiro por um emissor nativo em Python e
depois pelo caminho Electron + node-hid do próprio app. Foram aceitos:

- uma imagem estática em PNG (slot 1);
- um GIF de 3 frames (slot 1 e slot 5);
- um trecho de 12 frames de um GIF de 146 frames (slot 1);
- um GIF sintético de 2 frames vermelho/verde, confirmado em animação na tela;
- o GIF completo `giphy (1).gif`, com 44 frames (slot 5), em 266 s;
- um recorte de 106 frames (o máximo da tela) do `giphy.gif`, no slot 5, em
  379 s.

Os detalhes, tempos e limitações estão em
[`docs/qa/screen-hardware.md`](docs/qa/screen-hardware.md) e no
[`docs/analysis/protocol-k86-screen.md`](docs/analysis/protocol-k86-screen.md).

> **Limite da validação:** uma unidade, um sistema operacional e um firmware.
> As revisões `2730` e `4094` continuam não testadas.

## Requisitos

- Windows 10/11 (o caminho nativo foi validado no Windows 11).
- Node.js **26.13.1** portátil em
  `C:\Users\vitor\Tools\node-v26.13.1-win-x64` (não altere o Node do sistema).
- npm 11.
- Para o app desktop: nenhum navegador é necessário.
- Para o modo WebHID: Chrome ou Edge atualizado.

## Como rodar

No Windows, use `npm.cmd`; o PowerShell bloqueia `npm.ps1`.

```powershell
$env:Path = "C:\Users\vitor\Tools\node-v26.13.1-win-x64;" + $env:Path
cd C:\Users\vitor\Projects\k86-studio
npm.cmd install
npm.cmd run electron:dev
```

O Electron abre a janela do K86 Studio e o Vite serve o renderer em
`http://127.0.0.1:5173`. Para rodar o build de produção:

```powershell
npm.cmd run electron:start
```

Para usar apenas o navegador:

```powershell
npm.cmd run dev
```

Abra a URL informada pelo Vite no Chrome ou Edge. O modo WebHID é útil para
inspecionar a interface e identificar o teclado, mas o envio de GIFs grandes
deve ser feito no app desktop.

### Conectar o teclado

1. Conecte o K86 por cabo USB.
2. Feche o driver/app oficial do fabricante.
3. No app desktop, clique em **Conectar teclado**. O bridge nativo abre a
   interface vendor-defined automaticamente, sem seletor do navegador.
4. No navegador, clique em **Conectar teclado** e escolha `3151:4015`
   (“Gaming Keyboard”).
5. Confira ID interno `1168`, família `yc500` e layout ANSI sem cedilha.

Se o teclado não estiver disponível, use **Modo demo**. O checklist completo,
com os resultados observados, as capturas e a solução de problemas, está em
[`docs/qa/hardware-checklist.md`](docs/qa/hardware-checklist.md).

## Enviar uma imagem ou GIF

1. Abra **Screen**.
2. Escolha um PNG, GIF, WebP ou JPEG.
3. O preview mostra os frames decodificados e o limite de 106 frames.
4. Ajuste o delay (ms) e o slot (1 a 5).
5. Clique em **Enviar para a tela** e confirme.

O envio grava na flash da tela e substitui o conteúdo anterior do slot. Não há
erase de flash nesta tela. Use cabo USB e não desconecte o teclado durante a
gravação.

## Scripts

```powershell
npm.cmd install        # instala as dependências
npm.cmd run dev        # servidor Vite para o modo navegador
npm.cmd run electron:dev    # Vite + Electron (desenvolvimento)
npm.cmd run electron:debug  # Vite + Electron com CDP na porta 9223
npm.cmd run electron:start  # build de produção + Electron
npm.cmd run typecheck # checa os tipos sem gerar o bundle
npm.cmd run test      # roda os testes em modo watch
npm.cmd run test:run  # roda os testes uma vez
npm.cmd run build     # checa os tipos e gera o build de produção com CSP
npm.cmd run preview   # serve o build de produção localmente
```

## Estrutura do projeto

```text
electron/
  main.cjs      processo principal, janela, IPC e política de navegação
  preload.cjs   bridge contextIsolation para o renderer
  k86-hid.cjs   driver node-hid síncrono da coleção vendor-defined
src/
  app/          shell, rotas e composição da aplicação
  pages/        Dashboard, Screen e páginas planejadas
  hid/          transporte WebHID, transporte nativo, fake transport e hook
  protocol/     pacotes de 64 bytes, checksums, identify e tela
  devices/      registro das revisões do K86 e tipos
  session/      sessão K86, identify e transferência da tela
  screen/       decodificação de imagem/GIF e estado do upload
  security/     CSP e guardas de rede
  styles/       estilos globais
tests/
  security/     guarda contra APIs de rede no código do app
docs/
  analysis/     notas de protocolo e evidências
  qa/           checklists de hardware e capturas da validação
  superpowers/  design e planos
```

Documentação principal:

- [Design do K86 Studio](docs/superpowers/specs/2026-11-12-k86-studio-design.md)
- [Plano da fundação](docs/superpowers/plans/2026-11-12-foundation.md)
- [Plano da tela/GIF](docs/superpowers/plans/2026-11-12-screen-gif.md)
- [Protocolo do K86 — fundação](docs/analysis/protocol-k86.md)
- [Protocolo da tela](docs/analysis/protocol-k86-screen.md)
- [Checklist de hardware — fundação](docs/qa/hardware-checklist.md)
- [Checklist de hardware — tela](docs/qa/screen-hardware.md)

## Privacidade e escopo

- Nenhum `fetch`, `XMLHttpRequest`, `WebSocket` ou `sendBeacon` no código do
  renderer. O único WebSocket é o HMR do Vite em desenvolvimento.
- Nenhuma fonte, ícone ou script remoto.
- O build de produção injeta uma CSP que bloqueia conexões de rede.
- Nenhum dado de uso é coletado; não há conta, analytics ou telemetria.
- O processo principal do Electron não faz requisições de rede; o único acesso
  externo é o HID local do teclado.
- A gravação de tela está habilitada para o ID `1168` validado em hardware.
  Keymap, RGB, macros, perfis, firmware e reset continuam fora do escopo.
- Nenhuma atualização de firmware ou erase de flash é realizada.
- Nenhum código ou asset do driver oficial é usado no projeto.

## Licença

GPL-3.0-or-later. Veja [LICENSE](LICENSE).
