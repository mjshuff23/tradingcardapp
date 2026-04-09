import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AuthSession,
  AuthUser,
  getCurrentSession,
  login as loginRequest,
  logout as logoutRequest,
  signup as signupRequest,
} from './api';

type AuthContextValue = {
  user: AuthUser | null;
  authenticated: boolean;
  loading: boolean;
  refresh: () => Promise<AuthSession>;
  login: (payload: { email: string; password: string }) => Promise<AuthSession>;
  signup: (payload: { username: string; email: string; password: string }) => Promise<AuthSession>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>({ authenticated: false, user: null });
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const nextSession = await getCurrentSession();
    setSession(nextSession);
    return nextSession;
  };

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session.user,
      authenticated: session.authenticated,
      loading,
      refresh,
      login: async (payload) => {
        const nextSession = await loginRequest(payload);
        setSession(nextSession);
        return nextSession;
      },
      signup: async (payload) => {
        const nextSession = await signupRequest(payload);
        setSession(nextSession);
        return nextSession;
      },
      logout: async () => {
        await logoutRequest();
        setSession({ authenticated: false, user: null });
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}
