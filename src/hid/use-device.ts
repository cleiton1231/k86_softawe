import { useCallback, useEffect, useRef, useState } from "react";
import { K86Session } from "../session/k86-session";
import { FakeTransport } from "./fake";
import type { HidTransport } from "./transport";
import {
  isWebHidSupported,
  openWebHidTransport,
  requestK86Device,
} from "./webhid";

export type ConnectionState = {
  status: "disconnected" | "connecting" | "connected" | "error";
  session?: K86Session;
  error?: string;
};

const WEBHID_UNAVAILABLE =
  "WebHID não está disponível neste navegador. Use Chrome ou Edge atualizado ou escolha o modo demo para explorar a interface.";

const GENERIC_ERROR =
  "Não foi possível conectar ao teclado. Tente novamente ou use o modo demo.";

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return GENERIC_ERROR;
}

async function closeQuietly(
  session: K86Session,
  message: string,
): Promise<void> {
  try {
    await session.close();
  } catch (error) {
    console.warn(message, error);
  }
}

/**
 * Owns the read-only device connection for the dashboard.
 *
 * `K86Session.open` takes ownership of the transport: if identification
 * fails it closes the transport itself. On success this hook keeps the
 * session and is responsible for closing it on disconnect or unmount.
 */
export function useDevice() {
  const [state, setState] = useState<ConnectionState>({
    status: "disconnected",
  });
  const sessionRef = useRef<K86Session | null>(null);
  const operationRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) {
        void closeQuietly(
          session,
          "K86 Studio: falha ao fechar a sessão ao desmontar.",
        );
      }
    };
  }, []);

  const adoptSession = useCallback(
    (session: K86Session, transport: HidTransport): void => {
      if (!mountedRef.current) {
        void closeQuietly(
          session,
          "K86 Studio: falha ao fechar a sessão após desmontar.",
        );
        return;
      }

      const previous = sessionRef.current;
      sessionRef.current = session;

      transport.onDisconnect(() => {
        if (sessionRef.current !== session) return;
        sessionRef.current = null;
        if (!mountedRef.current) return;
        setState({ status: "disconnected" });
      });

      if (previous && previous !== session) {
        void closeQuietly(
          previous,
          "K86 Studio: falha ao fechar a sessão anterior.",
        );
      }

      setState({ status: "connected", session });
    },
    [],
  );

  const connect = useCallback(async (): Promise<void> => {
    if (sessionRef.current) return;

    const operation = ++operationRef.current;
    setState({ status: "connecting" });

    try {
      if (!isWebHidSupported()) {
        throw new Error(WEBHID_UNAVAILABLE);
      }

      const device = await requestK86Device();
      const transport = await openWebHidTransport(device);
      const session = await K86Session.open(transport);

      if (operation !== operationRef.current) {
        await closeQuietly(
          session,
          "K86 Studio: falha ao fechar uma conexão descartada.",
        );
        return;
      }
      adoptSession(session, transport);
    } catch (error) {
      if (operation !== operationRef.current) return;
      setState({ status: "error", error: describeError(error) });
    }
  }, [adoptSession]);

  const connectDemo = useCallback(async (): Promise<void> => {
    if (sessionRef.current) return;

    const operation = ++operationRef.current;
    setState({ status: "connecting" });

    try {
      const transport = FakeTransport.withIdentify(1168, 0x4015);
      const session = await K86Session.open(transport);

      if (operation !== operationRef.current) {
        await closeQuietly(
          session,
          "K86 Studio: falha ao fechar uma conexão demo descartada.",
        );
        return;
      }
      adoptSession(session, transport);
    } catch (error) {
      if (operation !== operationRef.current) return;
      setState({ status: "error", error: describeError(error) });
    }
  }, [adoptSession]);

  const disconnect = useCallback(async (): Promise<void> => {
    operationRef.current += 1;
    const session = sessionRef.current;
    sessionRef.current = null;
    setState({ status: "disconnected" });

    if (session) {
      await closeQuietly(
        session,
        "K86 Studio: falha ao fechar a sessão do teclado.",
      );
    }
  }, []);

  return { state, connect, connectDemo, disconnect };
}
