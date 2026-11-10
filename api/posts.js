import './runtime-env.js';
import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const slug = typeof req.query.slug === 'string' ? req.query.slug : null;
    let query = supabase.from('boring_posts').select(slug ? '*' : 'id,slug,title,description,published_at,minutes,number,tags,author').order('published_at', { ascending: false });
    if (slug) query = query.eq('slug', slug);
    const { data, error } = await query;
    if (error) throw error;
    if (slug && !data.length) return res.status(404).json({ error: 'This page has wandered out of the field.' });
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(slug ? data[0] : data);
  } catch (err) {
    console.error('Posts API:', err);
    return res.status(500).json({ error: 'We couldn’t bring the articles in. Please try again.' });
  }
}
