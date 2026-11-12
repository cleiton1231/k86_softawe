# K86 Studio Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a fundação funcional do K86 Studio: app web React/TypeScript que abre, identifica o K86 real em modo somente leitura, oferece modo demo e tem o núcleo de protocolo testado.

**Architecture:** App estático Vite + React + TypeScript, sem backend. O transporte HID é uma interface com implementações WebHID e fake. O protocolo é composto por funções puras de pacote/checksum/identify. A sessão K86 combina transporte e definição de dispositivo, valida a família e expõe operações de alto nível. A UI consome a sessão por um hook.

**Tech Stack:** Node.js 26.13.1 portátil, Vite, React 19, TypeScript estrito, Vitest, Testing Library, WebHID.

**Spec:** `docs/superpowers/specs/2026-11-12-k86-studio-design.md`

## Global Constraints

- Licença GPL-3.0-or-later.
- Sem rede em produção: nenhum `fetch`, `XMLHttpRequest`, `WebSocket` ou `sendBeacon` no código do app.
- CSP de produção: `default-src 'self'; connect-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'`.
- Nenhum código ou asset do driver oficial.
- Nenhum write no hardware nesta fase; apenas identify e leituras.
- O alvo físico é `3151:4015`, revisão `1168`, família `yc500`, layout ANSI sem cedilha.
- Usar o Node portátil em `C:\Users\vitor\Tools\node-v26.13.1-win-x64`; não alterar o Node do sistema.
- Comandos npm devem usar `npm.cmd` (o PowerShell bloqueia `npm.ps1`).

## Review Focus

- **Família desconhecida:** um dispositivo com PID/ID não mapeado deve abrir em modo somente leitura e nunca habilitar writes. Teste em `session/k86-session.test.ts`.
- **Feature report curto ou inválido:** `decodeIdentify` deve rejeitar sem ler fora do buffer. Teste em `protocol/identify.test.ts`.
- **WebHID indisponível ou permissão negada:** a UI deve mostrar erro claro e oferecer demo, sem travar. Teste em `hid/use-device.test.tsx`.
- **Desconexão durante a sessão:** o status deve voltar para desconectado e limpar a sessão. Teste em `hid/use-device.test.tsx`.
- **CSP de produção:** o build deve conter a meta tag estrita e a página deve carregar sem requests externos. Teste em `security/no-network.test.ts` e verificação manual do `dist/index.html`.

---

## File Structure

- `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`
- `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/app/routes.tsx`
- `src/styles/global.css`
- `src/protocol/checksum.ts`, `src/protocol/packet.ts`, `src/protocol/identify.ts`
- `src/devices/types.ts`, `src/devices/k86.ts`
- `src/hid/transport.ts`, `src/hid/webhid.ts`, `src/hid/fake.ts`, `src/hid/use-device.ts`
- `src/session/k86-session.ts`
- `src/pages/Dashboard.tsx`, `src/pages/PlaceholderPage.tsx`
- `src/test/setup.ts`
- `tests/security/no-network.test.ts`
- `docs/analysis/protocol-k86.md`, `docs/qa/hardware-checklist.md`, `README.md`

---

### Task 1: Scaffold do app

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`
- Create: `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/styles/global.css`, `src/test/setup.ts`
- Create: `.gitignore`, `LICENSE`, `README.md`

**Interfaces:**
- Produces: scripts `dev`, `build`, `preview`, `test`, `test:run`, `typecheck`.
- Produces: `App` export default em `src/app/App.tsx`.

- [ ] **Step 1: Criar o repositório e os arquivos de configuração**

`package.json` deve conter:

```json
{
  "name": "k86-studio",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "license": "GPL-3.0-or-later",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "tsc -b --pretty false"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

`vite.config.ts` deve exportar `defineConfig` com `plugins: [react()]` e um plugin `transformIndexHtml` que injeta a meta CSP apenas no build:

```ts
const csp = "default-src 'self'; connect-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'";
export default defineConfig({
  plugins: [react(), {
    name: "k86-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace("</head>", `<meta http-equiv="Content-Security-Policy" content="${csp}"></head>`);
    },
  }],
});
```

- [ ] **Step 2: Instalar dependências**

Run:

```powershell
$env:Path = "C:\Users\vitor\Tools\node-v26.13.1-win-x64;" + $env:Path
npm.cmd install
```

Expected: `node_modules` criado, sem erro fatal.

- [ ] **Step 3: Rodar o build e os testes**

Run:

```powershell
npm.cmd run build
npm.cmd run test:run
```

Expected: build conclui e Vitest reporta 0 testes falhando (ou "No test files found" nesta etapa).

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: scaffold app"
```

---

### Task 2: Checksum e pacote de 64 bytes

**Files:**
- Create: `src/protocol/checksum.ts`, `src/protocol/packet.ts`
- Test: `src/protocol/checksum.test.ts`, `src/protocol/packet.test.ts`

**Interfaces:**
- Produces: `type ChecksumMode = "bit7" | "bit8" | "none"`
- Produces: `checksum(bytes: Uint8Array, mode: ChecksumMode): number`
- Produces: `applyChecksum(bytes: Uint8Array, mode: ChecksumMode): Uint8Array`
- Produces: `buildPacket(opcode: number, payload?: ArrayLike<number>, mode?: ChecksumMode): Uint8Array`
- Produces: `REPORT_LEN = 64`

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { describe, expect, it } from "vitest";
import { checksum } from "./checksum";
import { buildPacket, REPORT_LEN } from "./packet";

describe("checksum", () => {
  it("uses 0xFF minus the sum for bit7", () => {
    expect(checksum(new Uint8Array([0x8f]), "bit7")).toBe(0x70);
  });
  it("covers byte 7 for bit8", () => {
    expect(checksum(new Uint8Array([0x07, 0x01, 0x02]), "bit8")).toBe(0xf5);
  });
  it("returns zero for none", () => {
    expect(checksum(new Uint8Array([0x01, 0x02]), "none")).toBe(0);
  });
});

describe("buildPacket", () => {
  it("creates a 64-byte report with opcode and checksum at byte 7", () => {
    const p = buildPacket(0x8f);
    expect(p).toHaveLength(REPORT_LEN);
    expect(p[0]).toBe(0x8f);
    expect(p[7]).toBe(0x70);
  });
  it("puts the bit8 checksum at byte 8", () => {
    const p = buildPacket(0x07, [0x01, 0x02], "bit8");
    expect(p[8]).toBe(0xf5);
  });
  it("does not write a checksum for none", () => {
    const p = buildPacket(0x8f, [], "none");
    expect(p[7]).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm.cmd run test:run -- src/protocol/checksum.test.ts src/protocol/packet.test.ts`
Expected: FAIL porque os módulos não existem.

- [ ] **Step 3: Implementar**

`checksum.ts`:

```ts
export type ChecksumMode = "bit7" | "bit8" | "none";

export function checksum(bytes: Uint8Array, mode: ChecksumMode): number {
  if (mode === "none") return 0;
  const end = mode === "bit7" ? 7 : 8;
  let sum = 0;
  for (let i = 0; i < end && i < bytes.length; i++) sum = (sum + bytes[i]) & 0xff;
  return (0xff - sum) & 0xff;
}

export function applyChecksum(bytes: Uint8Array, mode: ChecksumMode): Uint8Array {
  if (mode === "none") return bytes;
  bytes[mode === "bit7" ? 7 : 8] = checksum(bytes, mode);
  return bytes;
}
```

`packet.ts`:

```ts
import { applyChecksum, type ChecksumMode } from "./checksum";

export const REPORT_LEN = 64;

export function buildPacket(
  opcode: number,
  payload: ArrayLike<number> = [],
  mode: ChecksumMode = "bit7",
): Uint8Array {
  const buf = new Uint8Array(REPORT_LEN);
  buf[0] = opcode & 0xff;
  for (let i = 0; i < payload.length && i + 1 < REPORT_LEN; i++) {
    buf[i + 1] = payload[i] & 0xff;
  }
  return applyChecksum(buf, mode);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm.cmd run test:run -- src/protocol/checksum.test.ts src/protocol/packet.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/protocol
git commit -m "feat: packet checksums"
```

---

### Task 3: Registry do K86 e decoder de identify

**Files:**
- Create: `src/devices/types.ts`, `src/devices/k86.ts`, `src/protocol/identify.ts`
- Test: `src/devices/k86.test.ts`, `src/protocol/identify.test.ts`

**Interfaces:**
- Produces: `type ProtocolFamily = "yc500" | "gen2"`
- Produces: `interface DeviceDefinition { id, vid, pid, family, name, layout, screen, profiles }`
- Produces: `K86_DEVICES: readonly DeviceDefinition[]`
- Produces: `findDeviceByPid(pid: number): DeviceDefinition | undefined`
- Produces: `findDeviceById(id: number): DeviceDefinition | undefined`
- Produces: `decodeIdentify(reply: Uint8Array): { opcode: number; deviceId: number; raw: Uint8Array }`
- Produces: `identifyPacket(): Uint8Array`

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { describe, expect, it } from "vitest";
import { K86_DEVICES, findDeviceById, findDeviceByPid } from "./k86";

describe("K86 registry", () => {
  it("contains the three known revisions", () => {
    expect(K86_DEVICES.map((d) => d.id)).toEqual([1168, 2730, 4094]);
  });
  it("maps 3151:4015 to yc500", () => {
    const d = findDeviceById(1168);
    expect(d?.pid).toBe(0x4015);
    expect(d?.family).toBe("yc500");
    expect(d?.screen).toEqual({ width: 240, height: 135, slots: 5 });
  });
  it("maps 3151:5002 and 3151:5056 to gen2", () => {
    expect(findDeviceByPid(0x5002)?.family).toBe("gen2");
    expect(findDeviceByPid(0x5056)?.family).toBe("gen2");
  });
  it("returns undefined for unknown ids", () => {
    expect(findDeviceById(9999)).toBeUndefined();
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { decodeIdentify, identifyPacket } from "./identify";

describe("identify", () => {
  it("builds the 0x8F request", () => {
    expect(identifyPacket()[0]).toBe(0x8f);
  });
  it("decodes 1168 as u32 LE", () => {
    const reply = new Uint8Array(64);
    reply[0] = 0x8f;
    reply[1] = 0x90;
    reply[2] = 0x04;
    expect(decodeIdentify(reply).deviceId).toBe(1168);
  });
  it("rejects a short reply", () => {
    expect(() => decodeIdentify(new Uint8Array([0x8f, 0x90]))).toThrow(/short/i);
  });
  it("rejects a reply with the wrong opcode", () => {
    const reply = new Uint8Array(64);
    reply[0] = 0x00;
    expect(() => decodeIdentify(reply)).toThrow(/opcode/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm.cmd run test:run -- src/devices/k86.test.ts src/protocol/identify.test.ts`
Expected: FAIL porque os módulos não existem.

- [ ] **Step 3: Implementar**

`src/devices/types.ts`:

```ts
export type ProtocolFamily = "yc500" | "gen2";
export type PhysicalLayout = "ansi" | "iso" | "abnt2";

export interface ScreenSpec {
  width: number;
  height: number;
  slots: number;
}

export interface DeviceDefinition {
  id: number;
  vid: number;
  pid: number;
  family: ProtocolFamily;
  name: string;
  layout: PhysicalLayout;
  screen: ScreenSpec;
  profiles: number;
}
```

`src/devices/k86.ts`:

```ts
import type { DeviceDefinition } from "./types";

export const K86_DEVICES: readonly DeviceDefinition[] = [
  {
    id: 1168,
    vid: 0x3151,
    pid: 0x4015,
    family: "yc500",
    name: "Attack Shark K86 (1168)",
    layout: "ansi",
    screen: { width: 240, height: 135, slots: 5 },
    profiles: 3,
  },
  {
    id: 2730,
    vid: 0x3151,
    pid: 0x5002,
    family: "gen2",
    name: "Attack Shark K86 (2730)",
    layout: "ansi",
    screen: { width: 240, height: 135, slots: 5 },
    profiles: 3,
  },
  {
    id: 4094,
    vid: 0x3151,
    pid: 0x5056,
    family: "gen2",
    name: "Attack Shark K86 (4094)",
    layout: "ansi",
    screen: { width: 240, height: 135, slots: 5 },
    profiles: 3,
  },
];

export const findDeviceById = (id: number) => K86_DEVICES.find((d) => d.id === id);
export const findDeviceByPid = (pid: number) => K86_DEVICES.find((d) => d.pid === pid);
```

`src/protocol/identify.ts`:

```ts
import { buildPacket } from "./packet";

export interface IdentifyResult {
  opcode: number;
  deviceId: number;
  raw: Uint8Array;
}

export function identifyPacket(): Uint8Array {
  return buildPacket(0x8f);
}

export function decodeIdentify(reply: Uint8Array): IdentifyResult {
  if (reply.length < 5) throw new Error("identify reply too short");
  if (reply[0] !== 0x8f) throw new Error("unexpected identify opcode");
  const deviceId = reply[1] | (reply[2] << 8) | (reply[3] << 16) | (reply[4] << 24);
  return { opcode: reply[0], deviceId: deviceId >>> 0, raw: reply.slice() };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm.cmd run test:run -- src/devices/k86.test.ts src/protocol/identify.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/devices src/protocol/identify.ts src/protocol/identify.test.ts
git commit -m "feat: k86 registry"
```

---

### Task 4: Transporte HID e fake transport

**Files:**
- Create: `src/hid/transport.ts`, `src/hid/fake.ts`
- Test: `src/hid/fake.test.ts`

**Interfaces:**
- Produces: `interface HidDeviceInfo { vendorId, productId, productName?, path? }`
- Produces: `interface HidTransport { info; sendFeatureReport(reportId, data); receiveFeatureReport(reportId); onDisconnect(cb); close() }`
- Produces: `class FakeTransport implements HidTransport`
- Produces: `FakeTransport.withIdentify(deviceId: number, pid: number): FakeTransport`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { FakeTransport } from "./fake";
import { identifyPacket } from "../protocol/identify";

describe("FakeTransport", () => {
  it("returns a canned identify reply", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    await t.sendFeatureReport(0, identifyPacket());
    const reply = await t.receiveFeatureReport(0);
    expect(reply[0]).toBe(0x8f);
    expect(reply[1] | (reply[2] << 8)).toBe(1168);
  });
  it("reports disconnects to listeners", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    let called = false;
    t.onDisconnect(() => { called = true; });
    await t.disconnect();
    expect(called).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm.cmd run test:run -- src/hid/fake.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`transport.ts`:

```ts
export interface HidDeviceInfo {
  vendorId: number;
  productId: number;
  productName?: string;
  path?: string;
}

export interface HidTransport {
  readonly info: HidDeviceInfo;
  sendFeatureReport(reportId: number, data: Uint8Array): Promise<void>;
  receiveFeatureReport(reportId: number): Promise<Uint8Array>;
  onDisconnect(listener: () => void): void;
  close(): Promise<void>;
}
```

`fake.ts`:

```ts
import type { HidDeviceInfo, HidTransport } from "./transport";

export class FakeTransport implements HidTransport {
  readonly info: HidDeviceInfo;
  private reply: Uint8Array;
  private disconnectListeners: Array<() => void> = [];

  constructor(info: HidDeviceInfo, reply: Uint8Array) {
    this.info = info;
    this.reply = reply;
  }

  static withIdentify(deviceId: number, pid: number): FakeTransport {
    const reply = new Uint8Array(64);
    reply[0] = 0x8f;
    reply[1] = deviceId & 0xff;
    reply[2] = (deviceId >> 8) & 0xff;
    reply[3] = (deviceId >> 16) & 0xff;
    reply[4] = (deviceId >> 24) & 0xff;
    return new FakeTransport({ vendorId: 0x3151, productId: pid, productName: "K86 fake" }, reply);
  }

  async sendFeatureReport(_reportId: number, _data: Uint8Array): Promise<void> {}

  async receiveFeatureReport(_reportId: number): Promise<Uint8Array> {
    return this.reply.slice();
  }

  onDisconnect(listener: () => void): void {
    this.disconnectListeners.push(listener);
  }

  async disconnect(): Promise<void> {
    for (const listener of this.disconnectListeners) listener();
  }

  async close(): Promise<void> {
    await this.disconnect();
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm.cmd run test:run -- src/hid/fake.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hid
git commit -m "feat: hid transport"
```

---

### Task 5: WebHID transport

**Files:**
- Create: `src/hid/webhid.ts`

**Interfaces:**
- Consumes: `HidTransport`
- Produces: `isWebHidSupported(): boolean`
- Produces: `requestK86Device(): Promise<HidDevice>`
- Produces: `class WebHidTransport implements HidTransport`
- Produces: `async function openWebHidTransport(device: HidDevice): Promise<WebHidTransport>`

- [ ] **Step 1: Implementar a seleção do dispositivo**

Filtro de `navigator.hid.requestDevice`:

```ts
{ vendorId: 0x3151, usagePage: 0xffff, usage: 0x0002 }
```

Depois de escolher, validar que `device.collections?.some((c) => c.usagePage === 0xffff && c.usage === 0x0002)`; se não houver, tentar a coleção `usagePage 0x0001, usage 0x0002` como fallback e registrar a escolha.

- [ ] **Step 2: Implementar `WebHidTransport`**

`sendFeatureReport` chama `device.sendFeatureReport(0, data)`. `receiveFeatureReport` chama `device.receiveFeatureReport(0)` e normaliza para `Uint8Array`. `onDisconnect` registra em `navigator.hid.addEventListener("disconnect", ...)` e remove no `close()`. `close` chama `device.close()`.

- [ ] **Step 3: Verificar tipos e build**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Expected: sem erros de tipo; build conclui.

- [ ] **Step 4: Commit**

```bash
git add src/hid/webhid.ts
git commit -m "feat: webhid transport"
```

---

### Task 6: Sessão K86 somente leitura

**Files:**
- Create: `src/session/k86-session.ts`
- Test: `src/session/k86-session.test.ts`

**Interfaces:**
- Consumes: `HidTransport`, `DeviceDefinition`, `decodeIdentify`, `identifyPacket`
- Produces: `class K86Session`
- Produces: `static async open(transport: HidTransport): Promise<K86Session>`
- Produces: `readonly definition: DeviceDefinition`
- Produces: `readonly deviceId: number`
- Produces: `readonly readOnly: boolean`
- Produces: `close(): Promise<void>`
- Produces: `class UnsupportedDeviceError extends Error`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { FakeTransport } from "../hid/fake";
import { K86Session, UnsupportedDeviceError } from "./k86-session";

describe("K86Session", () => {
  it("identifies a known K86", async () => {
    const session = await K86Session.open(FakeTransport.withIdentify(1168, 0x4015));
    expect(session.definition.family).toBe("yc500");
    expect(session.readOnly).toBe(false);
  });
  it("marks an unknown device read-only", async () => {
    const session = await K86Session.open(FakeTransport.withIdentify(9999, 0x4015));
    expect(session.readOnly).toBe(true);
  });
  it("rejects a short identify reply", async () => {
    const t = FakeTransport.withIdentify(1168, 0x4015);
    const original = t.receiveFeatureReport.bind(t);
    t.receiveFeatureReport = async () => new Uint8Array([0x8f]);
    await expect(K86Session.open(t)).rejects.toThrow(/short/i);
    expect(original).toBeTypeOf("function");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm.cmd run test:run -- src/session/k86-session.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`open` envia `identifyPacket`, lê o reply, decodifica e procura `findDeviceById`. Se o ID for conhecido, valida que o PID do transporte bate com a definição; se não bater, lança `UnsupportedDeviceError`. Se o ID for desconhecido, cria a sessão com `readOnly: true` e uma definição fallback com o PID real, família `"yc500"` apenas para leitura, e `name: "Unknown K86"`. `close` chama `transport.close`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm.cmd run test:run -- src/session/k86-session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/session
git commit -m "feat: k86 read-only session"
```

---

### Task 7: Shell da aplicação

**Files:**
- Create: `src/app/routes.tsx`, `src/app/App.tsx`, `src/pages/Dashboard.tsx`, `src/pages/PlaceholderPage.tsx`, `src/styles/global.css`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Produces: `App` renderiza a navegação com as rotas `dashboard`, `keys`, `lighting`, `screen`, `macros`, `settings`, `about`.
- Produces: `PlaceholderPage({ title, description })`.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the K86 Studio shell and navigation", () => {
    render(<App />);
    expect(screen.getByText("K86 Studio")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /screen/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm.cmd run test:run -- src/app/App.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Layout com sidebar fixa, marca `K86 Studio`, subtítulo “local-first, sem telemetria”, navegação e área principal. Usar `useState` para a rota atual; não adicionar router. Dashboard mostra um cartão de conexão e o resumo das features. As outras páginas usam `PlaceholderPage` com o nome e uma frase do que virá. CSS escuro, contraste alto, foco visível.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm.cmd run test:run -- src/app/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app src/pages src/styles
git commit -m "feat: app shell"
```

---

### Task 8: Fluxo de conexão e dashboard

**Files:**
- Create: `src/hid/use-device.ts`
- Modify: `src/pages/Dashboard.tsx`
- Test: `src/hid/use-device.test.tsx`

**Interfaces:**
- Produces: `type ConnectionState = { status: "disconnected" | "connecting" | "connected" | "error"; session?: K86Session; error?: string }`
- Produces: `useDevice(): { state; connect(); connectDemo(); disconnect(); }`
- Consumes: `requestK86Device`, `openWebHidTransport`, `K86Session`, `FakeTransport`.

- [ ] **Step 1: Escrever o teste que falha**

Testar com uma função de conexão injetada ou mock de `requestK86Device`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDevice } from "./use-device";

vi.mock("./webhid", () => ({
  isWebHidSupported: () => false,
  requestK86Device: vi.fn(),
  openWebHidTransport: vi.fn(),
}));

describe("useDevice", () => {
  it("offers demo when WebHID is unavailable", async () => {
    const { result } = renderHook(() => useDevice());
    await act(async () => { await result.current.connect(); });
    expect(result.current.state.status).toBe("error");
    expect(result.current.state.error).toMatch(/webhid/i);
  });
  it("connects in demo mode", async () => {
    const { result } = renderHook(() => useDevice());
    await act(async () => { await result.current.connectDemo(); });
    expect(result.current.state.status).toBe("connected");
    expect(result.current.state.session?.definition.id).toBe(1168);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm.cmd run test:run -- src/hid/use-device.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`useDevice` mantém `ConnectionState`, expõe `connect` (WebHID), `connectDemo` (FakeTransport 1168) e `disconnect`. Em erro, define `status: "error"` e mensagem em português. Em desconexão do transporte, limpa a sessão e volta para `disconnected`. O Dashboard mostra:

- botão “Conectar teclado”;
- botão “Modo demo”;
- status, nome, ID, família, layout e “somente leitura” quando aplicável;
- botão “Desconectar” quando conectado;
- aviso de que writes ainda não estão habilitados nesta fase.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm.cmd run test:run -- src/hid/use-device.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hid/use-device.ts src/hid/use-device.test.tsx src/pages/Dashboard.tsx
git commit -m "feat: device connection"
```

---

### Task 9: Guarda de privacidade e CSP

**Files:**
- Create: `tests/security/no-network.test.ts`
- Modify: `vite.config.ts` se a injeção de CSP ainda não estiver correta.

**Interfaces:**
- Produces: teste que falha se `src/` contiver chamadas de rede proibidas.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const forbidden = [/\bfetch\s*\(/, /XMLHttpRequest/, /\bWebSocket\b/, /sendBeacon/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("no network in app code", () => {
  it("does not contain forbidden network APIs", () => {
    const hits = files("src")
      .filter((p) => /\.(ts|tsx)$/.test(p) && !p.includes(".test."))
      .flatMap((p) => forbidden.filter((r) => r.test(readFileSync(p, "utf8"))).map((r) => `${p}: ${r}`));
    expect(hits).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar ou passar**

Run: `npm.cmd run test:run -- tests/security/no-network.test.ts`
Expected: PASS se o código ainda não usa rede; FAIL se usar. Corrigir qualquer hit, não afrouxar o teste.

- [ ] **Step 3: Verificar a CSP no build**

Run:

```powershell
npm.cmd run build
Select-String -Path dist/index.html -Pattern "Content-Security-Policy"
```

Expected: a meta tag contém `connect-src 'none'`.

- [ ] **Step 4: Commit**

```bash
git add tests/security vite.config.ts
git commit -m "test: enforce local-only"
```

---

### Task 10: Documentação e primeira validação no hardware

**Files:**
- Create: `docs/analysis/protocol-k86.md`, `docs/qa/hardware-checklist.md`
- Modify: `README.md`

**Interfaces:**
- Produces: protocol notes com opcodes, checksums, fluxo e fontes.
- Produces: checklist de hardware com comandos e resultados esperados.

- [ ] **Step 1: Escrever o protocolo mínimo**

Documentar `0x8F`, checksum Bit7/Bit8, identidade `3151:4015` → 1168 → `yc500`, e o fato de que writes ficam fora desta fase. Marcar cada fato como observado, inferido ou desconhecido. Citar o design e as fontes.

- [ ] **Step 2: Escrever o checklist de hardware**

Incluir:

```text
1. Conectar por cabo USB.
2. Abrir o app no Chrome/Edge.
3. Clicar em Conectar teclado e escolher o dispositivo 3151:4015.
4. Conferir ID interno 1168, família yc500, layout ANSI, somente leitura.
5. Desconectar e reconectar; conferir que o estado volta a desconectado.
6. Testar modo demo sem teclado.
```

- [ ] **Step 3: Rodar a validação real**

Abrir `npm.cmd run dev` no Chrome/Edge, conectar o K86 e registrar o resultado em `docs/qa/hardware-checklist.md`. Não habilitar writes.

- [ ] **Step 4: Rodar a verificação completa**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
```

Expected: tudo passa; build contém a CSP.

- [ ] **Step 5: Commit**

```bash
git add README.md docs
git commit -m "docs: protocol and hardware check"
```

---

## Self-Review

- **Cobertura do spec:** a fundação cobre detecção, identify, transporte, shell, dashboard, privacidade e documentação. Keys, Lighting, Screen, Macros e Settings ficam para os planos seguintes, como previsto na separação por fases.
- **Escopo:** esta fase termina em software utilizável e testável em modo somente leitura, sem writes.
- **Consistência de tipos:** `HidTransport`, `DeviceDefinition`, `K86Session` e `ChecksumMode` são definidos uma vez e reutilizados.
- **Review Focus:** os cinco casos têm testes atribuídos nas tasks 3, 6 e 8, e a CSP na task 9.
- **Proporção:** o plano descreve interfaces e testes; os corpos de implementação longos ficam para os executores.
