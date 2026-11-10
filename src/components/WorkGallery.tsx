import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Image, Loader2 } from 'lucide-react';
import type { WorkItem } from '../lib/ownerApi';
import './owner.css';

export default function WorkGallery({ brand }: { brand: string }) {
  const [work, setWork] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const res = await fetch('/api/work'); const result = await res.json(); if (!res.ok) throw new Error(result.error || 'Could not load our work.'); setWork(result); } catch (err) { setError((err as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="reader" data-shown="true"><main className="studio-work" id="main-content"><p className="eyebrow">{brand} / SELECTED WORK</p><h1>Our work</h1><p className="studio-work-lede">A collection of things we’ve made with care.</p>
    {loading && <div className="owner-loading"><Loader2 size={20} className="spin" /><p>Gathering our work…</p></div>}
    {error && <div className="inline-error" role="alert"><p>{error}</p><button className="text-button" onClick={load}>Try again</button></div>}
    {!loading && !error && !work.length && <div className="studio-work-empty"><Image size={26} /><p>Our work will appear here.</p></div>}
    <div className="studio-work-grid">{work.map(item => <article className="studio-work-card" key={item.id}>{item.image_url && <div className="studio-work-cover"><img src={item.image_url} alt={item.title} loading="lazy" onError={e => { e.currentTarget.parentElement!.style.display = 'none'; }} /></div>}<div className="studio-work-body">{item.category && <p className="eyebrow">{item.category}</p>}<h2>{item.title}</h2>{item.description && <p className="studio-work-description">{item.description}</p>}{item.link_url && <a href={item.link_url} target="_blank" rel="noopener noreferrer">View project <ArrowUpRight size={15} /></a>}</div></article>)}</div>
  </main></div>;
}
