# K86 Studio

Configurador local-first e sem telemetria para o teclado Attack Shark K86.

O app roda inteiramente no navegador, sem backend, sem conta e sem enviar
dados para serviços externos. Nesta fase, o projeto contém apenas a fundação
da aplicação; a conexão com o teclado será adicionada nas próximas etapas.

## Requisitos

- Node.js 26.13.1 (portátil em `C:\Users\vitor\Tools\node-v26.13.1-win-x64`)
- npm 11
- Chrome ou Edge para WebHID nas fases seguintes

## Scripts

```powershell
npm.cmd install       # instala as dependências
npm.cmd run dev       # inicia o servidor de desenvolvimento
npm.cmd run build     # checa os tipos e gera o build de produção
npm.cmd run preview   # serve o build de produção localmente
npm.cmd run test      # roda os testes em modo watch
npm.cmd run test:run  # roda os testes uma vez
npm.cmd run typecheck # checa os tipos sem gerar o bundle de produção
```

No Windows, use `npm.cmd`; o PowerShell bloqueia `npm.ps1`.

## Privacidade

- Nenhum `fetch`, `XMLHttpRequest`, `WebSocket` ou `sendBeacon` no código do app.
- Nenhuma fonte, ícone ou script remoto.
- O build de produção injeta uma CSP que bloqueia conexões de rede.
- Nenhum dado de uso é coletado.

## Licença

GPL-3.0-or-later. Veja [LICENSE](LICENSE).
