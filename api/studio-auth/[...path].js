import '../runtime-env.js';
import supabase from '../db-client.js';

// Only authentication endpoints are exposed. Database credentials and all
// database mutations stay behind the owner-verified server endpoints.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info, x-supabase-api-version');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const path = Array.isArray(req.query?.path) ? req.query.path.join('/') : String(req.query?.path || '');
  const endpoint = path.replace(/^auth\/v1\//, '');
  const permitted = (endpoint === 'token' && req.method === 'POST') || (endpoint === 'user' && req.method === 'GET') || (endpoint === 'logout' && req.method === 'POST');
  if (!path.startsWith('auth/v1/') || !permitted) return res.status(403).json({ error: 'access_denied', error_description: 'This endpoint is not available.' });
  try {
    const query = new URLSearchParams();
    if (endpoint === 'token') {
      const grant = String(req.query?.grant_type || '');
      if (!['password', 'refresh_token', 'id_token'].includes(grant)) return res.status(400).json({ error: 'unsupported_grant_type', error_description: 'Use your owner credentials to sign in.' });
      query.set('grant_type', grant);
    }
    if (endpoint === 'logout') query.set('scope', 'local');
    const headers = { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    if (req.headers?.authorization?.startsWith('Bearer ') && req.headers.authorization !== 'Bearer studio-auth-proxy') headers.Authorization = req.headers.authorization;
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/${endpoint}?${query}`, { method: req.method, headers, ...(req.method === 'POST' ? { body: JSON.stringify(req.body || {}) } : {}) });
    if (response.status === 204) return res.status(204).end();
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Authentication service did not return JSON.');
    let result;
    try { result = await response.json(); } catch { throw new Error('Authentication service returned invalid JSON.'); }
    if (response.ok && endpoint === 'token') {
      const userId = result.user?.id;
      if (!userId) return res.status(401).json({ error: 'invalid_credentials', error_description: 'Please sign in again.' });
      const { data: owner, error } = await supabase.from('saaf_owners').select('user_id').eq('user_id', userId).maybeSingle();
      if (error || !owner) return res.status(403).json({ error: 'access_denied', error_description: 'This account does not have owner access.' });
    }
    return res.status(response.status).json(result);
  } catch (error) {
    console.error('Owner authentication:', error.message);
    return res.status(503).json({ error: 'authentication_unavailable', error_description: 'Sign-in is temporarily unavailable. Please try again.' });
  }
}
