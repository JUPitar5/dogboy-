import './runtime-env.js';
import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const [settings, scenes] = await Promise.all([
      supabase.from('boring_settings').select('*').eq('id', 'main').single(),
      supabase.from('boring_scenes').select('*').order('position', { ascending: true }),
    ]);
    if (settings.error) throw settings.error;
    if (scenes.error) throw scenes.error;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ...settings.data.content, scenes: scenes.data });
  } catch (err) {
    console.error('Site API:', err);
    return res.status(500).json({ error: 'The field is taking a little longer to wake up. Please try again.' });
  }
}
