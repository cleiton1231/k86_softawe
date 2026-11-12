# K86 Studio

Configurador **local-first** e **sem telemetria** para o teclado Attack Shark
K86. O app roda inteiramente no navegador, sem backend, sem conta e sem enviar
dados para serviços externos.

## Fase atual: fundação, somente leitura

A fundação entrega o shell da aplicação, o núcleo de protocolo, o transporte
WebHID, uma sessão K86 de identificação sem gravações de configuração/estado,
o Dashboard com fluxo de conexão e o modo demo. O app identifica o teclado e
mostra ID interno, família e layout, mas **não habilita gravações de
configuração**.

> **Validação em hardware (2026-11-12):** o K86 físico (`3151:4015`, ID
> `1168`) foi identificado no Microsoft Edge 157.0.4341.46, no Windows 11, com
> o app em `http://127.0.0.1:5173`. O Dashboard mostrou
> `Attack Shark K86 (1168)`, ID interno `1168`, família `yc500`, layout ANSI
> sem cedilha e somente leitura. Identify, desconexão, reconexão e modo demo
> foram registrados. O único tráfego HID foi o feature report de identify;
> nenhuma gravação de configuração, keymap, RGB, macro, tela, perfil ou
> firmware foi realizada, e nenhuma atualização de firmware foi iniciada.
> Veja o checklist e as capturas em
> [`docs/qa/hardware-checklist.md`](docs/qa/hardware-checklist.md).
>
> **Limite da validação:** uma unidade, um navegador e um sistema
> operacional. As revisões `2730` e `4094` continuam não testadas.

As áreas **Keys**, **Lighting**, **Screen**, **Macros** e **Settings** existem
como páginas planejadas; suas funções ficam para as próximas fases. Consulte
[`docs/analysis/protocol-k86.md`](docs/analysis/protocol-k86.md) para os fatos
de protocolo documentados e as limitações que ainda existem.

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
3. Clique em **Conectar teclado** e escolha `3151:4015` (“Gaming Keyboard”).
4. Confira ID interno `1168`, família `yc500`, layout ANSI sem cedilha e o selo
   de somente leitura.

Na validação de 2026-11-12, o chooser exibiu “Gaming Keyboard” e a reconexão
apareceu como “Gaming Keyboard - Emparelhado”. Se o teclado não estiver
disponível, use **Modo demo**. O checklist completo, com os resultados
observados, as capturas e a solução de problemas, está em
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
  session/      sessão K86 de identificação, sem gravações de configuração
  styles/       estilos globais
tests/
  security/     guarda contra APIs de rede no código do app
docs/
  analysis/     notas de protocolo e evidências
  qa/           checklist de hardware e capturas da validação
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
- Esta fase é **somente leitura**: gravações de configuração/estado, keymap,
  RGB, macros, tela, perfis e firmware estão fora do escopo. O único tráfego
  HID é o feature report de identify.
- Nenhuma atualização de firmware ou erase de flash é realizada.
- Nenhum código ou asset do driver oficial é usado no projeto.

## Licença

GPL-3.0-or-later. Veja [LICENSE](LICENSE).
