# Checklist de hardware — K86 Studio (fundação)

- **Data da elaboração:** 2026-11-12
- **Status:** validação pendente
- **Alvo:** `3151:4015`, ID interno `1168`, família `yc500`, ANSI sem cedilha
- **Escopo:** identificar o teclado e conferir o modo somente leitura
- **Writes:** desabilitados nesta fase
- **Firmware:** nenhuma atualização é executada

> **Validação pendente:** este checklist foi escrito para a primeira conexão
> WebHID real. O controlador deve executar os passos no Chrome/Edge, com o K86
> físico conectado, e preencher cada linha **Resultado**. Até essa execução, o
> projeto não tem validação de hardware.

## Pré-condições

- [ ] Cabo USB disponível para conectar o Attack Shark K86 com fio. O alvo é a
      conexão com fio; receptor 2.4 GHz ou Bluetooth não são o alvo desta
      validação.
- [ ] Chrome ou Edge atualizado, com suporte a WebHID.
- [ ] Driver/app oficial do fabricante **fechado**, para não disputar o
      dispositivo com o navegador.
- [ ] Nenhum outro programa usando a interface HID do teclado.
- [ ] Backup **não se aplica** nesta fase: o app é somente leitura e não altera
      keymap, RGB, macros, perfis, tela ou firmware. Se uma fase futura habilitar
      writes, o backup/restore passa a ser obrigatório antes de qualquer teste.
- [ ] Node.js portátil em `C:\Users\vitor\Tools\node-v26.13.1-win-x64`
      disponível. Não altere o Node do sistema.
- [ ] Terminal aberto em `C:\Users\vitor\Projects\k86-studio`.

Verificação opcional, somente leitura, de que o Windows enumerou o alvo:

```powershell
Get-PnpDevice -PresentOnly |
  Where-Object { $_.InstanceId -match 'VID_3151&PID_4015' } |
  Select-Object Status, Class, FriendlyName, InstanceId
```

**Esperado:** dispositivos com status `OK`, incluindo o composite USB e as
interfaces `MI_00`, `MI_01` e `MI_02`. A interface `MI_02` é a coleção
vendor-defined usada pelo app.

**Resultado:** ____________________________________________________________

## Passos

### Passo 1 — Instalar as dependências

```powershell
$env:Path = "C:\Users\vitor\Tools\node-v26.13.1-win-x64;" + $env:Path
cd C:\Users\vitor\Projects\k86-studio
npm.cmd install
```

**Esperado:** instalação conclui com código de saída `0` e `node_modules`
presente. Avisos de auditoria de dependências de desenvolvimento não bloqueiam
esta validação.

**Resultado:** ____________________________________________________________

### Passo 2 — Iniciar o servidor de desenvolvimento

```powershell
npm.cmd run dev
```

**Esperado:** Vite inicia sem erro e mostra uma URL local, normalmente
`http://localhost:5173/`. Mantenha o terminal aberto durante o teste.

**Resultado:** ____________________________________________________________

### Passo 3 — Abrir o app no Chrome/Edge

Abra a URL informada pelo Vite no Chrome ou Edge.

**Esperado:** a interface do K86 Studio carrega; o Dashboard mostra os botões
**Conectar teclado** e **Modo demo**, além do cartão de referência com
`3151:4015`, revisão `1168`, família `yc500`, layout ANSI sem cedilha e o selo
de somente leitura. O console do navegador não deve mostrar erro de WebHID.

**Resultado:** ____________________________________________________________

### Passo 4 — Conectar o K86 por cabo USB

Conecte o teclado diretamente por cabo USB (evite hub sem alimentação, se
possível), confirme que ele responde como teclado e feche o driver/app oficial
caso ainda esteja aberto.

**Esperado:** o Windows mantém o dispositivo `VID_3151&PID_4015` enumerado e o
teclado funciona normalmente. Nenhum app do fabricante está aberto.

**Resultado:** ____________________________________________________________

### Passo 5 — Clicar em “Conectar teclado” e escolher `3151:4015`

Clique em **Conectar teclado**. No seletor do navegador, escolha o dispositivo
`3151:4015` (pode aparecer como “Attack Shark K86” ou como dispositivo
HID definido pelo fornecedor). Se houver mais de uma entrada, escolha a
interface vendor-defined; o app precisa da coleção `0xFFFF/0x0002` (ou da
coleção de fallback `0x0001/0x0002`, aceita somente para identify nesta fase).

**Esperado:** o seletor abre; após a escolha, o status passa por
“Conectando” e chega a “Conectado”, sem mensagem de erro.

**Resultado:** ____________________________________________________________

### Passo 6 — Conferir ID interno, família, layout e modo somente leitura

Confira o cartão do dispositivo conectado.

**Esperado:**

- nome `Attack Shark K86 (1168)`;
- ID interno `1168`;
- família `yc500`;
- layout `ANSI, sem cedilha`;
- selo **Somente leitura nesta fase**;
- nenhuma ação de escrita, keymap, RGB, macro, tela ou firmware disponível.

Se o ID não for reconhecido, o app deve mostrar uma sessão somente leitura com
definição conservadora; registre o ID e o PID reais e **não** tente escrever.

**Resultado:** ____________________________________________________________

### Passo 7 — Desconectar pelo botão e conferir o estado

Clique em **Desconectar**.

**Esperado:** o status volta para “Desconectado”; o cartão de referência do
alvo reaparece; a sessão é encerrada e não fica um dispositivo “fantasma”.

**Resultado:** ____________________________________________________________

### Passo 8 — Reconectar e testar a remoção física

Clique em **Conectar teclado** novamente, escolha `3151:4015` e confirme que o
estado volta a “Conectado”. Em seguida, com a sessão ativa, remova o cabo USB.

**Esperado:** o estado volta automaticamente para “Desconectado” após a
remoção física, sem travar a interface. Reconecte o cabo e repita a conexão
pelo botão para confirmar que o fluxo continua funcionando.

**Resultado:** ____________________________________________________________

### Passo 9 — Testar o modo demo sem teclado

Desconecte o teclado ou use uma janela sem ele e clique em **Modo demo**.

**Esperado:** o status mostra “Conectado (demo)”, com o selo **Demo**; o cartão
mostra o dispositivo virtual com ID `1168`, família `yc500` e layout ANSI sem
cedilha, sem acessar hardware real. **Desconectar** encerra a demonstração e
volta ao estado desconectado.

**Resultado:** ____________________________________________________________

### Passo 10 — Encerrar o teste

Clique em **Desconectar** (se houver sessão) e pare o servidor de
desenvolvimento com `Ctrl+C`.

**Esperado:** nenhuma escrita foi enviada ao teclado e nenhuma atualização de
firmware foi iniciada. O terminal encerra sem erro.

**Resultado:** ____________________________________________________________

## Registro final

```text
Data da execução:
Responsável:
Navegador e versão:
Sistema operacional:
Commit do K86 Studio:
Dispositivo observado (VID:PID / ID interno):
Resultado geral: [ ] PASSOU   [ ] FALHOU
Observações:
```

## Avisos de segurança desta fase

- **Writes não estão habilitados.** O app não expõe keymap, RGB, macros, tela,
  perfis, configurações ou reset.
- **Nenhuma atualização de firmware é realizada.** Não há OTA, bootloader ou
  gravação de flash nesta fase.
- **Não é necessário backup**, porque o teste é somente leitura. Se o app
  exibir qualquer ação de escrita, pare o teste e reporte.
- Se o ID interno não for `1168`, a sessão deve permanecer somente leitura.
  Registre o resultado; não tente contornar a proteção.
- O driver oficial deve ficar fechado durante o teste. Não execute o app do
  fornecedor em paralelo.

## Solução de problemas

### WebHID indisponível

**Sintoma:** mensagem “WebHID não está disponível neste navegador...”.

**Causas prováveis:** navegador não-Chromium, versão antiga, página fora de
um contexto seguro ou API desabilitada por política.

**Ação:** use Chrome ou Edge atualizado; abra via `http://localhost:5173/`
(localhost é um contexto seguro) ou HTTPS; confirme `navigator.hid` no console
do navegador; verifique políticas corporativas. Se WebHID continuar
indisponível, use o modo demo e registre o bloqueio.

### Seletor cancelado

**Sintoma:** mensagem “Seleção cancelada: nenhum dispositivo foi escolhido.”.

**Causa:** o usuário fechou o seletor ou não escolheu nenhum dispositivo.

**Ação:** clique em **Conectar teclado** novamente e escolha `3151:4015`. O app
deve permanecer no estado desconectado, sem sessão parcial.

### Dispositivo não aparece no seletor

**Causas prováveis:** driver/app oficial aberto, cabo ou porta USB com
problema, teclado conectado apenas por 2.4 GHz/Bluetooth, ou o navegador ainda
não recebeu permissão para o dispositivo.

**Ação:** feche o app oficial; troque o cabo/porta; confirme a presença de
`VID_3151&PID_4015` no Gerenciador de Dispositivos; recarregue a página e tente
de novo. Use cabo USB. Se o teclado só aparecer como coleção de teclado, o app
pode não conseguir identificar a interface vendor-defined; registre o caso.

### Coleção HID errada

**Sintoma:** mensagem de que o dispositivo não expõe a coleção
`0xFFFF/0x0002` nem a coleção de fallback `0x0001/0x0002`.

**Causa:** foi escolhida uma interface/coleção que não é a vendor-defined.

**Ação:** repita a conexão e escolha a interface correta. A coleção de fallback
serve apenas para identify somente leitura; não habilite writes. Se o erro
persistir, registre o nome, VID/PID e as coleções exibidas pelo dispositivo.

### Identify falha ou retorna ID desconhecido

**Sintoma:** erro de identificação ou sessão aberta como “Modelo não
reconhecido”, com ID diferente de `1168`.

**Ação:** registre a mensagem exata, o ID interno retornado, o VID/PID e os
erros do console. A sessão deve permanecer somente leitura. Não tente enviar
comandos de escrita nem alterar o código durante a validação.

### Erro de feature report ou report ID

**Sintoma:** o navegador rejeita o envio/leitura do feature report.

**Contexto:** o Windows declara `FeatureReportByteLength = 65` para a coleção
vendor-defined, compatível com 64 bytes de payload mais o byte de report ID.
O contrato documentado usa report ID `0`.

**Ação:** registre a mensagem exata do navegador e o resultado do passo 5/6.
Não adivinhe outro report ID e não altere o protocolo durante o teste; pare e
reporte para análise.

### Desconexão não refletida na interface

**Sintoma:** o cabo é removido, mas o Dashboard continua mostrando
“Conectado”.

**Ação:** aguarde alguns segundos; remova e reconecte o cabo; recarregue a
página se necessário. Registre se o estado voltou sozinho e qualquer erro do
console. Não envie writes enquanto o estado estiver inconsistente.

### Erro ao iniciar o servidor de desenvolvimento

**Sintoma:** o Vite não inicia ou a porta está ocupada.

**Ação:** confirme que o Node portátil está no `PATH` e que o comando é
`npm.cmd` (não `npm.ps1`). Se a porta `5173` estiver ocupada, use
`npm.cmd run dev -- --port 5174` e abra a URL indicada. Registre a mensagem de
erro se o problema persistir.
