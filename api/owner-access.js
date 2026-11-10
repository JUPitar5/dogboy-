import './runtime-env.js';
import supabase from './db-client.js';
import { createClient } from '@supabase/supabase-js';

export function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export async function requireOwner(req) {
  const token = req.headers?.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw httpError('Please sign in to access the owner studio.', 401);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw httpError('Your session has expired. Please sign in again.', 401);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: owner, error: ownerError } = await db.from('saaf_owners').select('user_id,username').eq('user_id', user.id).maybeSingle();
  if (ownerError || !owner) throw httpError('This account does not have owner access.', 403);
  return { db, user, owner };
}
