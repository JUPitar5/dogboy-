import './runtime-env.js';
import supabase from './db-client.js';
import { requireOwner, httpError } from './owner-access.js';

function text(value, label, max, required = false) {
  if (typeof value !== 'string') throw httpError(`${label} must be text.`);
  const result = value.trim();
  if (required && !result) throw httpError(`${label} is required.`);
  if (result.length > max) throw httpError(`${label} must be ${max} characters or fewer.`);
  return result;
}
function webUrl(value, label) {
  const result = text(value || '', label, 2048);
  if (!result) return '';
  try { const parsed = new URL(result); if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error(); } catch { throw httpError(`${label} must be a complete http or https URL.`); }
  return result;
}
function project(body) {
  return {
    title: text(body.title, 'Project title', 140, true),
    category: text(body.category || '', 'Category', 80),
    description: text(body.description || '', 'Project description', 2400),
    image_url: webUrl(body.image_url, 'Image URL'),
    link_url: webUrl(body.link_url, 'Project URL'),
    published: body.published === true,
  };
}
function projectId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw httpError('A valid project ID is required.');
  return id;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const { db, user, owner } = await requireOwner(req);
    if (req.method === 'GET') {
      if (req.query?.action === 'check') return res.status(200).json({ owner: true, username: owner.username });
      const [settings, work] = await Promise.all([
        db.from('boring_settings').select('content').eq('id', 'main').single(),
        db.from('saaf_work').select('*').order('created_at', { ascending: false }),
      ]);
      if (settings.error) throw settings.error;
      if (work.error) throw work.error;
      return res.status(200).json({ settings: settings.data.content, work: work.data, username: owner.username });
    }
    const body = req.body || {};
    if (body.resource === 'work') {
      if (req.method === 'POST') {
        const { data, error } = await db.from('saaf_work').insert({ ...project(body), user_id: user.id }).select('*').single();
        if (error) throw error;
        return res.status(201).json(data);
      }
      if (req.method === 'PUT') {
        const { data, error } = await db.from('saaf_work').update(project(body)).eq('id', projectId(body.id)).eq('user_id', user.id).select('*').single();
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (req.method === 'DELETE') {
        const { data, error } = await db.from('saaf_work').delete().eq('id', projectId(body.id)).eq('user_id', user.id).select('id');
        if (error) throw error;
        if (!data.length) throw httpError('Project not found.', 404);
        return res.status(200).json({ ok: true });
      }
    }
    if (req.method === 'PUT' && (body.resource === 'site' || body.resource === 'plans')) {
      const { data: existing, error: readError } = await db.from('boring_settings').select('content').eq('id', 'main').single();
      if (readError) throw readError;
      const next = { ...existing.content, work_url: '/work' };
      if (body.resource === 'site') {
        const values = body.values || {};
        for (const [key, max] of Object.entries({ title: 80, description: 400, plans_title: 120, plans_description: 1200, plan_terms: 1200, included_title: 120 })) {
          if (Object.prototype.hasOwnProperty.call(values, key)) next[key] = text(values[key], key.replaceAll('_', ' '), max, key === 'title');
        }
        if ('instagram_url' in values) next.instagram_url = webUrl(values.instagram_url, 'Instagram URL');
        if ('included_features' in values) {
          if (!Array.isArray(values.included_features) || values.included_features.length > 30) throw httpError('Use no more than 30 included features.');
          next.included_features = values.included_features.map(value => text(value, 'Included feature', 160, true));
        }
      } else {
        if (!Array.isArray(body.plans) || body.plans.length > 24) throw httpError('Use no more than 24 plans.');
        next.plans = body.plans.map(plan => ({ name: text(plan.name, 'Plan name', 80, true), price: text(plan.price, 'Plan price', 40, true), price_prefix: text(plan.price_prefix || '', 'Price prefix', 30), note: text(plan.note || '', 'Plan note', 200), description: text(plan.description || '', 'Plan description', 1200) }));
        if (new Set(next.plans.map(plan => plan.name.toLowerCase())).size !== next.plans.length) throw httpError('Give each plan a different name.');
      }
      const { data, error } = await db.from('boring_settings').update({ content: next }).eq('id', 'main').select('*').single();
      if (error) throw error;
      return res.status(200).json(data.content);
    }
    return res.status(405).json({ error: 'This action is not supported.' });
  } catch (error) {
    console.error('Owner API:', error.message);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Your changes could not be saved. Please try again.' });
  }
}
