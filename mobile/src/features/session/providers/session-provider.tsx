import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getDemoSession } from '@/features/session/services/session.mock';

import type { AppSession } from '@/features/session/types/session';

type SessionContextValue = {
  session: AppSession | null;
  isLoading: boolean;
};

const SessionContext =
  createContext<SessionContextValue | null>(
    null,
  );

export function SessionProvider({
  children,
}: PropsWithChildren) {
  const [session, setSession] =
    useState<AppSession | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  useEffect(() => {
    let active = true;

    void getDemoSession().then(
      (nextSession) => {
        if (active) {
          setSession(nextSession);
          setIsLoading(false);
        }
      },
    );

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      isLoading,
    }),
    [isLoading, session],
  );

  return (
    <SessionContext.Provider
      value={value}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value =
    useContext(SessionContext);

  if (!value) {
    throw new Error(
      'useSession must be used inside SessionProvider.',
    );
  }

  return value;
}