import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowUpRight, Check, FileText, Globe, Image, LayoutGrid, Loader2, LogOut, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import supabase from '../lib/supabase';
import { ownerRequest } from '../lib/ownerApi';
import type { OwnerData, StudioPlan, StudioSettings, WorkItem } from '../lib/ownerApi';

type WorkDraft = Pick<WorkItem, 'title' | 'category' | 'description' | 'image_url' | 'link_url' | 'published'>;
function emptyWork(): WorkDraft { return { title: '', category: '', description: '', image_url: '', link_url: '', published: true }; }
function emptyPlan(): StudioPlan { return { name: '', price: '', price_prefix: '', note: '', description: '' }; }

function WorkEditor({ value, close, save, busy }: { value: WorkDraft; close: () => void; save: (value: WorkDraft) => Promise<void>; busy: boolean }) {
  const [draft, setDraft] = useState(value);
  const update = (key: keyof WorkDraft, value: string | boolean) => setDraft(current => ({ ...current, [key]: value }));
  return <form className="owner-editor owner-form" onSubmit={event => { event.preventDefault(); void save(draft); }}>
    <div className="owner-panel-heading"><h3>{value.title ? 'Edit project' : 'New project'}</h3><button type="button" className="owner-icon" onClick={close} aria-label="Close project editor" disabled={busy}><X size={18} /></button></div>
    <div className="owner-form-pair"><label>Project title<input value={draft.title} onChange={e => update('title', e.target.value)} maxLength={140} required /></label><label>Category<input value={draft.category} onChange={e => update('category', e.target.value)} maxLength={80} placeholder="e.g. Brand identity" /></label></div>
    <label>About this project<textarea value={draft.description} onChange={e => update('description', e.target.value)} rows={4} maxLength={2400} /></label>
    <label>Project URL<input type="url" value={draft.link_url} onChange={e => update('link_url', e.target.value)} placeholder="https://" /><small>Optional. Visitors can open the finished project.</small></label>
    <label>Cover image URL<input type="url" value={draft.image_url} onChange={e => update('image_url', e.target.value)} placeholder="https://…/image.jpg" /><small>Optional. Use a publicly accessible image link.</small></label>
    <label className="owner-checkbox"><input type="checkbox" checked={draft.published} onChange={e => update('published', e.target.checked)} /> Publish on the Work page</label>
    <div className="owner-editor-actions"><button type="button" className="owner-secondary" onClick={close} disabled={busy}>Cancel</button><button type="submit" className="owner-primary" disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Save project</button></div>
  </form>;
}

function PlanEditor({ value, close, save, busy }: { value: StudioPlan; close: () => void; save: (value: StudioPlan) => Promise<void>; busy: boolean }) {
  const [draft, setDraft] = useState(value);
  const update = (key: keyof StudioPlan, value: string) => setDraft(current => ({ ...current, [key]: value }));
  return <form className="owner-editor owner-form" onSubmit={event => { event.preventDefault(); void save(draft); }}>
    <div className="owner-panel-heading"><h3>{value.name ? 'Edit plan' : 'New plan'}</h3><button type="button" className="owner-icon" onClick={close} aria-label="Close plan editor" disabled={busy}><X size={18} /></button></div>
    <label>Plan name<input value={draft.name} onChange={e => update('name', e.target.value)} maxLength={80} required /></label>
    <div className="owner-form-pair"><label>Price<input value={draft.price} onChange={e => update('price', e.target.value)} maxLength={40} placeholder="₹9,999" required /></label><label>Price prefix<input value={draft.price_prefix || ''} onChange={e => update('price_prefix', e.target.value)} maxLength={30} placeholder="e.g. from" /></label></div>
    <label>Short note<input value={draft.note || ''} onChange={e => update('note', e.target.value)} maxLength={200} /></label>
    <label>What’s included<textarea value={draft.description} onChange={e => update('description', e.target.value)} rows={3} maxLength={1200} /></label>
    <div className="owner-editor-actions"><button type="button" className="owner-secondary" onClick={close} disabled={busy}>Cancel</button><button type="submit" className="owner-primary" disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Save plan</button></div>
  </form>;
}

export default function OwnerDashboard() {
  const [data, setData] = useState<OwnerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'work' | 'plans' | 'website'>('work');
  const [workEdit, setWorkEdit] = useState<WorkItem | 'new' | null>(null);
  const [planEdit, setPlanEdit] = useState<number | 'new' | null>(null);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const load = useCallback(async () => {
    const next = await ownerRequest<OwnerData>();
    setData(next); setSettings(next.settings); return next;
  }, []);
  const reload = useCallback(async () => { setLoading(true); setError(''); try { await load(); } catch (err) { setError((err as Error).message); } finally { setLoading(false); } }, [load]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { if (!notice) return; const timeout = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timeout); }, [notice]);
  const mutate = async (method: string, body: unknown, message: string, done?: () => void) => {
    setBusy(true); setError(''); setNotice('');
    try { await ownerRequest(method, body); await load(); done?.(); setNotice(message); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const saveWork = async (value: WorkDraft) => { await mutate(workEdit === 'new' ? 'POST' : 'PUT', { resource: 'work', ...(workEdit && workEdit !== 'new' ? { id: workEdit.id } : {}), ...value }, value.published ? 'Project published. It is now on your Work page.' : 'Project saved as a draft.', () => setWorkEdit(null)); };
  const savePlan = async (value: StudioPlan) => {
    if (!data) return;
    const plans = [...data.settings.plans];
    if (planEdit === 'new') plans.push(value); else if (typeof planEdit === 'number') plans[planEdit] = value;
    await mutate('PUT', { resource: 'plans', plans }, 'Your plans are updated on the website.', () => setPlanEdit(null));
  };
  const updateSetting = (key: string, value: string | string[]) => setSettings(current => current ? { ...current, [key]: value } : current);
  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!settings) return;
    const values = tab === 'website' ? { title: settings.title, description: settings.description, instagram_url: settings.instagram_url } : { plans_title: settings.plans_title, plans_description: settings.plans_description, plan_terms: settings.plan_terms, included_title: settings.included_title, included_features: settings.included_features.map(item => item.trim()).filter(Boolean) };
    await mutate('PUT', { resource: 'site', values }, 'Website changes saved.');
  };
  const signOut = async () => { setError(''); const result = await supabase.auth.signOut(); if (result.error) setError(result.error.message); };
  if (loading) return <div className="owner-loading"><Loader2 size={22} className="spin" /><p>Loading your content…</p></div>;
  if (!data || !settings) return <div className="owner-login-card"><h1>Let’s try that again.</h1><p role="alert">{error}</p><button className="owner-primary" onClick={reload}>Reload studio</button><button className="owner-secondary" onClick={signOut}>Sign out</button></div>;
  return <main className="owner-dashboard">
    <div className="owner-dashboard-head"><div><p className="eyebrow">WELCOME BACK, {data.username}</p><h1>Make it yours.</h1><p className="owner-muted">Your website, your work, your next chapter.</p></div><div className="owner-head-actions"><a href="/" className="owner-secondary">View website <ArrowUpRight size={15} /></a><button className="owner-icon" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={18} /></button></div></div>
    <nav className="owner-tabs" aria-label="Owner sections"> <button aria-current={tab === 'work' ? 'page' : undefined} onClick={() => { setTab('work'); setError(''); }}><LayoutGrid size={16} /> Work <small>{data.work.length}</small></button><button aria-current={tab === 'plans' ? 'page' : undefined} onClick={() => { setTab('plans'); setError(''); }}><FileText size={16} /> Plans <small>{data.settings.plans.length}</small></button><button aria-current={tab === 'website' ? 'page' : undefined} onClick={() => { setTab('website'); setError(''); }}><Globe size={16} /> Website</button></nav>
    {error && <p className="owner-error owner-banner" role="alert">{error}</p>}{notice && <p className="owner-success owner-banner" role="status"><Check size={16} />{notice}</p>}
    {tab === 'work' && <section className="owner-panel"><div className="owner-panel-heading"><div><h2>Your work</h2><p>Add a project, keep a draft, or share it with the world.</p></div><button className="owner-primary" onClick={() => { setError(''); setWorkEdit('new'); }} disabled={busy}><Plus size={15} /> Add project</button></div>
      {workEdit && <WorkEditor key={workEdit === 'new' ? 'new' : workEdit.id} value={workEdit === 'new' ? emptyWork() : workEdit} close={() => setWorkEdit(null)} save={saveWork} busy={busy} />}
      {!data.work.length && !workEdit && <div className="owner-empty"><Image size={29} /><h3>A fresh canvas.</h3><p>Add your first project. Only published work appears on the website.</p></div>}
      <div className="owner-work-list">{data.work.map(item => <article className="owner-work-row" key={item.id}><div className="owner-work-thumbnail">{item.image_url ? <img src={item.image_url} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} /> : <Image size={21} />}</div><div className="owner-work-info"><h3>{item.title}</h3><p>{item.category || 'Project'} <span className={item.published ? 'owner-live' : ''}>{item.published ? 'Published' : 'Draft'}</span></p></div><button className="owner-icon" aria-label={`Edit ${item.title}`} onClick={() => { setError(''); setWorkEdit(item); }} disabled={busy}><Pencil size={16} /></button><button className="owner-icon owner-danger" aria-label={`Delete ${item.title}`} disabled={busy} onClick={() => { if (window.confirm(`Delete “${item.title}”? This removes it from your website.`)) void mutate('DELETE', { resource: 'work', id: item.id }, 'Project deleted.', () => setWorkEdit(null)); }}><Trash2 size={16} /></button></article>)}</div>
    </section>}
    {tab === 'plans' && <section className="owner-panel"><div className="owner-panel-heading"><div><h2>Your plans</h2><p>Set your pricing and tell clients what’s included.</p></div><button className="owner-primary" onClick={() => { setError(''); setPlanEdit('new'); }} disabled={busy}><Plus size={15} /> Add plan</button></div>
      {planEdit !== null && <PlanEditor key={planEdit} value={planEdit === 'new' ? emptyPlan() : data.settings.plans[planEdit]} close={() => setPlanEdit(null)} save={savePlan} busy={busy} />}
      <div className="owner-plan-list">{data.settings.plans.map((plan, index) => <article className="owner-plan-item" key={`${index}-${plan.name}`}><div><h3>{plan.name}</h3><p>{plan.price_prefix} {plan.price}</p><small>{plan.description}</small></div><div className="owner-row-actions"><button className="owner-icon" aria-label={`Edit ${plan.name} plan`} onClick={() => { setError(''); setPlanEdit(index); }} disabled={busy}><Pencil size={16} /></button><button className="owner-icon owner-danger" aria-label={`Delete ${plan.name} plan`} disabled={busy} onClick={() => { if (window.confirm(`Remove the “${plan.name}” plan from your website?`)) void mutate('PUT', { resource: 'plans', plans: data.settings.plans.filter((_, i) => i !== index) }, 'Plan removed.', () => setPlanEdit(null)); }}><Trash2 size={16} /></button></div></article>)}</div>
      <form className="owner-form owner-plan-settings" onSubmit={saveSettings}><h3>Plans section details</h3><label>Section heading<input value={settings.plans_title} onChange={e => updateSetting('plans_title', e.target.value)} maxLength={120} /></label><label>Introduction<textarea value={settings.plans_description} onChange={e => updateSetting('plans_description', e.target.value)} rows={3} maxLength={1200} /></label><label>Included features heading<input value={settings.included_title} onChange={e => updateSetting('included_title', e.target.value)} maxLength={120} /></label><label>Included features<textarea value={settings.included_features.join('\n')} onChange={e => updateSetting('included_features', e.target.value.split('\n'))} rows={6} /><small>Write one feature per line.</small></label><label>Payment terms / offer note<textarea value={settings.plan_terms} onChange={e => updateSetting('plan_terms', e.target.value)} rows={3} maxLength={1200} /></label><button className="owner-primary" type="submit" disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Save section details</button></form>
    </section>}
    {tab === 'website' && <section className="owner-panel"><div className="owner-panel-heading"><div><h2>Your website</h2><p>A few thoughtful words go a long way.</p></div></div><form className="owner-form owner-site-form" onSubmit={saveSettings}><label>Brand name<input value={settings.title} onChange={e => updateSetting('title', e.target.value)} maxLength={80} required /></label><label>Homepage description<textarea value={settings.description} onChange={e => updateSetting('description', e.target.value)} maxLength={400} rows={4} /></label><label>Instagram URL<input type="url" value={settings.instagram_url} onChange={e => updateSetting('instagram_url', e.target.value)} required /></label><div className="owner-info-note">“Check our work” opens your own Work page. Publish projects in the Work tab to add content there.</div><button className="owner-primary" type="submit" disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Save website</button></form></section>}
    <footer className="owner-dashboard-foot"><Check size={13} /> Changes are saved to your website’s database.</footer>
  </main>;
}
