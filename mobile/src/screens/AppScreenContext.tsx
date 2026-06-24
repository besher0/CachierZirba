import { createContext, useContext } from "react";

export type AppScreenContextValue = Record<string, unknown>;

export const AppScreenContext = createContext<AppScreenContextValue | null>(null);
export const AppShellContext = createContext<AppScreenContextValue | null>(null);

export function useAppScreenContext(): AppScreenContextValue {
  const value = useContext(AppScreenContext);
  if (!value) {
    throw new Error("App screen context is not available.");
  }

  return value;
}

export function useAppShellContext(): AppScreenContextValue {
  const value = useContext(AppShellContext);
  if (!value) {
    throw new Error("App shell context is not available.");
  }

  return value;
}
