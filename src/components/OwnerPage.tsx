import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2, Power, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import { API_UNAVAILABLE_MESSAGE } from '../lib/safeJsonFetch';
import ProtectedOwner from './ProtectedOwner';
import OwnerDashboard from './OwnerDashboard';
import './owner.css';

function OwnerLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    if (!username.trim() || !password) { setError('Enter your username and password.'); return; }
    setBusy(true);
    try {
      const name = username.trim().toLowerCase();
      const email = name.includes('@') ? name : `${name}@saafstudio.owner`;
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(signInError.status && signInError.status >= 500 ? API_UNAVAILABLE_MESSAGE : 'The username or password is incorrect. Please try again.');
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  return <section className="owner-login-card">
    <div className="owner-power-mark"><Power size={23} /></div>
    <p className="eyebrow">SAAFSTUDIO / OWNER ACCESS</p><h1>Your studio.<br />Your controls.</h1>
    <p className="owner-muted">Sign in to post your work, update your plans, and make this space your own.</p>
    <form className="owner-form" onSubmit={submit}>
      <label>Username<input name="username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus maxLength={254} required /></label>
      <label>Password<span className="owner-password"><input name="password" type={visible ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
      {error && <p className="owner-error" role="alert">{error}</p>}
      <button className="owner-primary" disabled={busy} type="submit">{busy ? <><Loader2 size={15} className="spin" /> Signing in…</> : <><Power size={15} /> Unlock studio</>}</button>
    </form>
    <div className="owner-or"><span />or<span /></div>
    <button className="owner-secondary owner-google" onClick={() => { setError(''); try { signInWithGoogle('SaafStudio', setError); } catch (err) { setError((err as Error).message); } }}><span aria-hidden="true">G</span> Sign in with Google</button>
    <p className="owner-security-note"><ShieldCheck size={13} /> Only an approved owner account can edit this site.</p>
  </section>;
}

export default function OwnerPage() {
  const { session, loading } = useAuth();
  useEffect(() => { document.title = 'Owner studio — SaafStudio'; }, []);
  return <div className="owner-page"><header className="owner-shell-header"><Link to="/"><ArrowLeft size={15} /> Back to the website</Link><span>SaafStudio <small>OWNER STUDIO</small></span></header>{loading ? <div className="owner-loading"><Loader2 className="spin" size={22} /><p>Opening your studio…</p></div> : session ? <ProtectedOwner><OwnerDashboard /></ProtectedOwner> : <OwnerLogin />}</div>;
}
