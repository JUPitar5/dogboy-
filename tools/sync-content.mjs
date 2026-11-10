import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter(line => line.includes('=')).map(line => { const at = line.indexOf('='); return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const articles = JSON.parse(readFileSync('.reference/articles.json', 'utf8'));
for (const article of articles) {
  if (!article.content.length) throw new Error('No content found for ' + article.slug);
  const { error, data } = await db.from('boring_posts').update({ content: article.content }).eq('slug', article.slug).select('slug');
  if (error) throw error;
  console.log('Saved', data[0]?.slug, article.content.length, 'sections');
}
