import { useCallback, useEffect, useRef, useState } from "react";
import { maxScreenFrames } from "../protocol/screen";
import type { K86Session } from "../session/k86-session";
import { decodeScreenFile, type ScreenAnimation } from "./decode";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const FRAME_LIMIT = maxScreenFrames();

export type ScreenUploadState =
  | { status: "idle" }
  | { status: "decoding"; fileName: string }
  | {
      status: "ready";
      fileName: string;
      animation: ScreenAnimation;
      delayMs: number;
      slot: number;
    }
  | {
      status: "sending";
      fileName: string;
      animation: ScreenAnimation;
      delayMs: number;
      slot: number;
      done: number;
      total: number;
    }
  | { status: "done"; fileName: string; slot: number; frameCount: number }
  | { status: "error"; message: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "não foi possível processar a imagem";
}

export function useScreenUpload() {
  const [state, setState] = useState<ScreenUploadState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const loadFile = useCallback(async (file: File) => {
    abortRef.current?.abort();
    abortRef.current = null;

    if (!file.type.startsWith("image/")) {
      setState({ status: "error", message: "selecione um arquivo de imagem ou GIF" });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setState({ status: "error", message: "o arquivo passa do limite de 20 MB" });
      return;
    }

    setState({ status: "decoding", fileName: file.name });
    try {
      const animation = await decodeScreenFile(file);
      if (animation.frames.length > FRAME_LIMIT) {
        setState({
          status: "error",
          message: `o arquivo tem ${animation.frames.length} frames; o limite desta tela é ${FRAME_LIMIT}`,
        });
        return;
      }
      setState({
        status: "ready",
        fileName: file.name,
        animation,
        delayMs: animation.delayMs,
        slot: 4,
      });
    } catch (error) {
      setState({ status: "error", message: errorMessage(error) });
    }
  }, []);

  const setDelayMs = useCallback((value: number) => {
    setState((current) => {
      if (current.status !== "ready") return current;
      const delayMs = Math.max(0, Math.min(255, Math.round(value) || 0));
      return { ...current, delayMs };
    });
  }, []);

  const setSlot = useCallback((value: number) => {
    setState((current) => {
      if (current.status !== "ready") return current;
      if (!Number.isInteger(value) || value < 0 || value > 4) return current;
      return { ...current, slot: value };
    });
  }, []);

  const send = useCallback(async (session: K86Session) => {
    const current = state;
    if (current.status !== "ready") return;
    if (!session.writesAllowed) {
      setState({
        status: "error",
        message: "Este dispositivo está em modo somente leitura; envio de tela indisponível.",
      });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setState({
      status: "sending",
      fileName: current.fileName,
      animation: current.animation,
      delayMs: current.delayMs,
      slot: current.slot,
      done: 0,
      total: current.animation.frames.length,
    });

    try {
      await session.sendScreenAnimation(current.animation, {
        slot: current.slot,
        signal: controller.signal,
        onProgress: (done, total) => {
          if (controller.signal.aborted) return;
          setState((latest) =>
            latest.status === "sending" ? { ...latest, done, total } : latest,
          );
        },
      });
      setState({
        status: "done",
        fileName: current.fileName,
        slot: current.slot,
        frameCount: current.animation.frames.length,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        setState({ status: "idle" });
        return;
      }
      setState({ status: "error", message: errorMessage(error) });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [state]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ status: "idle" });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ status: "idle" });
  }, []);

  return {
    state,
    maxFrames: FRAME_LIMIT,
    loadFile,
    setDelayMs,
    setSlot,
    send,
    cancel,
    reset,
  };
}
