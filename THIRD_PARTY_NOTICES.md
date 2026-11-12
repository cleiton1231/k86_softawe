# Avisos de terceiros — K86 Studio

O K86 Studio é distribuído sob **GPL-3.0-or-later** (veja `LICENSE`).

Esta versão é distribuída principalmente como **código-fonte**. O texto abaixo
cobre as dependências de runtime usadas pelo app e serve de base para uma
distribuição binária futura. Ele não substitui os arquivos de licença de cada
pacote.

## Dependências de runtime

| Pacote | Versão | Licença | Uso |
| --- | --- | --- | --- |
| `react` | 19.3.1 | MIT | interface |
| `react-dom` | 19.3.1 | MIT | renderer |
| `scheduler` | 0.28.0 | MIT | dependência do React |
| `node-hid` | 3.4.0 | MIT OR X11 | acesso HID no processo principal |
| `node-addon-api` | 8.9.2 | MIT | dependência nativa do node-hid |
| `pkg-prebuilds` | 1.1.0 | MIT | prebuilds do node-hid |
| `electron` | 45.3.1 | MIT | runtime desktop |

O `node-hid` inclui o arquivo `LICENSE-bsd.txt` com a licença BSD de Signal 11
Software. O Electron inclui o Chromium e componentes de terceiros; uma
distribuição binária precisa incluir o `LICENSES.chromium.html` gerado pelo
Electron, além dos avisos dos pacotes acima.

## Dependências de desenvolvimento

As dependências de desenvolvimento (Vite, TypeScript, Vitest, Testing Library,
jsdom, concurrently, wait-on) não são enviadas no runtime do aplicativo. Seus
avisos de licença devem ser incluídos apenas se algum artefato delas for
distribuído.

## Distribuição binária

Antes de publicar um instalador ou executável:

1. Incluir este arquivo, `LICENSE` e os avisos de licença do Electron/Chromium.
2. Empacotar o `node-hid` fora do ASAR (`asarUnpack`), porque ele contém código
   nativo.
3. Aplicar os fuses do Electron para desabilitar `runAsNode` e inspeção por
   linha de comando quando não forem necessários.
4. Assinar o executável no Windows.
5. Disponibilizar o código-fonte correspondente sob GPL-3.0-or-later.

Nada disso é necessário para usar o app a partir do código-fonte com
`npm run electron:start`.
