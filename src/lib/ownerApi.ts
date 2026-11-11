import supabase from './supabase';
import { safeJsonFetch } from './safeJsonFetch';

export interface WorkItem { id: number; title: string; category: string; description: string; image_url: string; link_url: string; published: boolean; created_at: string }
export interface StudioPlan { name: string; price: string; price_prefix?: string; note?: string; description: string }
export interface StudioSettings { title: string; description: string; instagram_url: string; plans_title: string; plans_description: string; plan_terms: string; included_title: string; included_features: string[]; plans: StudioPlan[]; [key: string]: unknown }
export interface OwnerData { settings: StudioSettings; work: WorkItem[]; username: string }

export async function ownerRequest<T>(method = 'GET', body?: unknown, query = ''): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in to continue.');
  return safeJsonFetch<T>(`/api/owner${query}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, ...(body ? { body: JSON.stringify(body) } : {}) }, {
    // Never substitute local data for owner authorization or successful writes.
    validate: method === 'GET' ? value => {
      if (!value || typeof value !== 'object') return false;
      const data = value as Record<string, unknown>;
      return query.includes('action=check') ? data.owner === true : !!data.settings && Array.isArray(data.work) && typeof data.username === 'string';
    } : undefined,
  });
}
