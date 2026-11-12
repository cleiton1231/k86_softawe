import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScreenAnimation } from "./decode";
import { useScreenUpload } from "./useScreenUpload";

const decode = vi.hoisted(() => vi.fn());

vi.mock("./decode", () => ({
  decodeScreenFile: decode,
}));

function file(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/gif" });
}

function animation(name: string): ScreenAnimation {
  return {
    width: 240,
    height: 135,
    delayMs: 50,
    frames: [new Uint8ClampedArray([name.charCodeAt(0)])],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  decode.mockReset();
});

describe("useScreenUpload", () => {
  it("ignores a stale decode that resolves after a newer file", async () => {
    const first = deferred<ScreenAnimation>();
    const second = deferred<ScreenAnimation>();
    decode.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useScreenUpload());
    let firstLoad: Promise<void> = Promise.resolve();
    let secondLoad: Promise<void> = Promise.resolve();

    act(() => {
      firstLoad = result.current.loadFile(file("first.gif"));
    });
    act(() => {
      secondLoad = result.current.loadFile(file("second.gif"));
    });

    await act(async () => {
      second.resolve(animation("second"));
      await secondLoad;
    });
    expect(result.current.state).toMatchObject({
      status: "ready",
      fileName: "second.gif",
    });

    await act(async () => {
      first.resolve(animation("first"));
      await firstLoad;
    });
    expect(result.current.state).toMatchObject({
      status: "ready",
      fileName: "second.gif",
    });
  });
});
