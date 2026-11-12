# K86 Studio

Configurador **local-first** e **sem telemetria** para o teclado Attack Shark
K86. O app roda inteiramente no navegador, sem backend, sem conta e sem enviar
dados para serviços externos.

## Fase atual: fundação, somente leitura

A fundação entrega o shell da aplicação, o núcleo de protocolo, o transporte
WebHID, uma sessão K86 de identificação sem operações de escrita, o Dashboard
com fluxo de conexão e o modo demo. O app identifica o teclado e mostra ID
interno, família e layout, mas **não habilita escritas**.

> **Validação pendente:** a primeira conexão WebHID com o K86 físico
> (`3151:4015`) deve ser executada no Chrome/Edge e registrada em
> [`docs/qa/hardware-checklist.md`](docs/qa/hardware-checklist.md). O código e
> os testes automatizados não substituem essa validação. Nenhuma escrita ou
> atualização de firmware é realizada nesta fase.

As áreas **Keys**, **Lighting**, **Screen**, **Macros** e **Settings** existem
como páginas planejadas; suas funções ficam para as próximas fases. Consulte
[`docs/analysis/protocol-k86.md`](docs/analysis/protocol-k86.md) para os fatos
de protocolo já documentados e as pendências de hardware.

## Requisitos

- Node.js **26.13.1** portátil em
  `C:\Users\vitor\Tools\node-v26.13.1-win-x64` (não altere o Node do sistema).
- npm 11.
- Chrome ou Edge atualizado com suporte a **WebHID**. O modo demo funciona sem
  teclado e sem WebHID.

## Como rodar

No Windows, use `npm.cmd`; o PowerShell bloqueia `npm.ps1`.

```powershell
$env:Path = "C:\Users\vitor\Tools\node-v26.13.1-win-x64;" + $env:Path
cd C:\Users\vitor\Projects\k86-studio
npm.cmd install
npm.cmd run dev
```

Abra a URL local informada pelo Vite (normalmente
`http://localhost:5173/`) no Chrome ou Edge.

Para conectar o teclado real:

1. Conecte o K86 por cabo USB.
2. Feche o driver/app oficial do fabricante.
3. Clique em **Conectar teclado** e escolha `3151:4015`.
4. Confira ID interno `1168`, família `yc500`, layout ANSI sem cedilha e o selo
   de somente leitura.

Se o teclado não estiver disponível, use **Modo demo**. O checklist completo,
incluindo resultados esperados e solução de problemas, está em
[`docs/qa/hardware-checklist.md`](docs/qa/hardware-checklist.md).

## Scripts

```powershell
npm.cmd install       # instala as dependências
npm.cmd run dev       # inicia o servidor de desenvolvimento
npm.cmd run typecheck # checa os tipos sem gerar o bundle
npm.cmd run test      # roda os testes em modo watch
npm.cmd run test:run  # roda os testes uma vez
npm.cmd run build     # checa os tipos e gera o build de produção com CSP
npm.cmd run preview   # serve o build de produção localmente
```

## Requisito de navegador

WebHID é necessário para falar com o teclado real. Use Chrome ou Edge
atualizado. O modo demo usa um transporte fake e não depende de WebHID, mas o
restante da interface continua sendo um app web estático.

## Estrutura do projeto

```text
src/
  app/          shell, rotas e composição da aplicação
  pages/        Dashboard e páginas planejadas
  hid/          transporte WebHID, fake transport e hook de conexão
  protocol/     pacotes de 64 bytes, checksums e identify
  devices/      registro das revisões do K86 e tipos
  session/      sessão K86 de identificação, sem writes
  styles/       estilos globais
tests/
  security/     guarda contra APIs de rede no código do app
docs/
  analysis/     notas de protocolo e evidências
  qa/           checklist de hardware
  superpowers/  design e plano da fundação
```

Documentação principal:

- [Design do K86 Studio](docs/superpowers/specs/2026-11-12-k86-studio-design.md)
- [Plano da fundação](docs/superpowers/plans/2026-11-12-foundation.md)
- [Protocolo do K86 — fase de fundação](docs/analysis/protocol-k86.md)
- [Checklist de hardware](docs/qa/hardware-checklist.md)

## Privacidade e escopo

- Nenhum `fetch`, `XMLHttpRequest`, `WebSocket` ou `sendBeacon` no código do app.
- Nenhuma fonte, ícone ou script remoto.
- O build de produção injeta uma CSP que bloqueia conexões de rede.
- Nenhum dado de uso é coletado; não há conta, analytics ou telemetria.
- Esta fase é **somente leitura**: writes, keymap, RGB, macros, tela e firmware
  estão fora do escopo.
- Nenhum código ou asset do driver oficial é usado no projeto.

## Licença

GPL-3.0-or-later. Veja [LICENSE](LICENSE).
