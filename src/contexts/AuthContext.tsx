import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import supabase from '../lib/supabase';

const AuthContext = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data }) => { if (live) { setSession(data.session); setLoading(false); } }).catch(() => { if (live) setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setLoading(false); });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);
  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
