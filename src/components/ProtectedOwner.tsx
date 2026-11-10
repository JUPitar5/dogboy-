import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ownerRequest } from '../lib/ownerApi';
import supabase from '../lib/supabase';

export default function ProtectedOwner({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setAllowed(false); setError('');
    ownerRequest('GET', undefined, '?action=check').then(() => { if (live) setAllowed(true); }).catch(err => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [session?.user.id]);
  if (error) return <section className="owner-login-card"><ShieldCheck size={24} /><h1>Owner access only.</h1><p role="alert">{error}</p><button className="owner-primary" onClick={async () => { const result = await supabase.auth.signOut(); if (result.error) setError(result.error.message); }}>Sign out and try again</button></section>;
  if (!allowed) return <div className="owner-loading"><Loader2 className="spin" size={22} /><p>Checking owner access…</p></div>;
  return <>{children}</>;
}
