import {
  type PropsWithChildren,
  createElement,
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

type AnonymousIdentity = {
  getPrincipal: () => { toString: () => string };
};

export type InternetIdentityContext = {
  identity?: AnonymousIdentity;
  login: () => void;
  clear: () => void;
  loginStatus: "idle" | "logging-in" | "success" | "loginError";
  isInitializing: boolean;
  isLoginIdle: boolean;
  isLoggingIn: boolean;
  isLoginSuccess: boolean;
  isLoginError: boolean;
  loginError?: Error;
};

const InternetIdentityReactContext =
  createContext<InternetIdentityContext | undefined>(undefined);

export const useInternetIdentity = (): InternetIdentityContext => {
  const context = useContext(InternetIdentityReactContext);
  if (!context) {
    throw new Error("InternetIdentityProvider is not present.");
  }
  return context;
};

export function InternetIdentityProvider({ children }: PropsWithChildren) {
  const [identity, setIdentity] = useState<AnonymousIdentity | undefined>(
    undefined,
  );

  const value = useMemo<InternetIdentityContext>(
    () => ({
      identity,
      login: () => {
        setIdentity({
          getPrincipal: () => ({ toString: () => "anonymous" }),
        });
      },
      clear: () => setIdentity(undefined),
      loginStatus: "idle",
      isInitializing: false,
      isLoginIdle: true,
      isLoggingIn: false,
      isLoginSuccess: false,
      isLoginError: false,
      loginError: undefined,
    }),
    [identity],
  );

  return createElement(InternetIdentityReactContext.Provider, {
    value,
    children,
  });
}
