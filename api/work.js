import './runtime-env.js';
import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { data, error } = await supabase.from('saaf_work').select('id,title,category,description,image_url,link_url,published,created_at').eq('published', true).order('created_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json(data);
  } catch (error) {
    console.error('Work API:', error.message);
    return res.status(500).json({ error: 'Our work could not be loaded. Please try again.' });
  }
}
