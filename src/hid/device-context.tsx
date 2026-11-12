import { createContext, useContext, type ReactNode } from "react";
import { useDevice } from "./use-device";

type DeviceContextValue = ReturnType<typeof useDevice>;

const DeviceContext = createContext<DeviceContextValue | null>(null);

/**
 * Owns the single K86 connection for the whole app.
 *
 * The provider must stay mounted across route changes so navigating between
 * pages does not tear down the session.
 */
export function DeviceProvider({ children }: { children: ReactNode }) {
  const device = useDevice();

  return (
    <DeviceContext.Provider value={device}>{children}</DeviceContext.Provider>
  );
}

export function useDeviceContext(): DeviceContextValue {
  const value = useContext(DeviceContext);

  if (!value) {
    throw new Error(
      "useDeviceContext deve ser usado dentro de DeviceProvider.",
    );
  }

  return value;
}
