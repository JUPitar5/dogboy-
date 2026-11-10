import './runtime-env.js';
import supabase from './db-client.js';
import { randomUUID } from 'node:crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'POST') {
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Please enter a valid email address.' });
      if (req.body?.website) return res.status(400).json({ error: 'Please leave the website field empty.' });
      const token = randomUUID();
      const { data, error } = await supabase.from('boring_subscriptions').insert({ email, token }).select('*').single();
      if (error) throw error;
      return res.status(201).json({ token: data.token, email: data.email });
    }
    if (req.method === 'GET') {
      const token = String(req.query.token || '');
      if (!/^[a-f0-9-]{36}$/.test(token)) return res.status(400).json({ error: 'Invalid subscription token.' });
      const { data, error } = await supabase.from('boring_subscriptions').select('email,token').eq('token', token).maybeSingle();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const token = String(req.body?.token || '');
      if (!/^[a-f0-9-]{36}$/.test(token)) return res.status(400).json({ error: 'Invalid subscription token.' });
      const { error } = await supabase.from('boring_subscriptions').delete().eq('token', token);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Subscription API:', err);
    return res.status(500).json({ error: 'Your address couldn’t be saved just now. Please try again.' });
  }
}
