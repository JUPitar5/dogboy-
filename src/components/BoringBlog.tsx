import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Instagram, Mail, Moon, Pause, Play, Power, Sun, Volume2, VolumeX, X } from 'lucide-react';
import { mountField } from '../lib/field';
import type { FieldScene } from '../lib/field';
import { AuthProvider } from '../contexts/AuthContext';
import { handleGoogleRedirect } from '../lib/googleAuth';
import { fetchPublicJson, safeJsonFetch } from '../lib/safeJsonFetch';
import OwnerPage from './OwnerPage';
import WorkGallery from './WorkGallery';
import './boring.css';

void handleGoogleRedirect();

interface Site {
  title: string; description: string; author: string; instagram_url: string;
  work_url: string; plans_title: string; plans_description: string; plan_terms: string;
  included_title: string; included_features: string[]; plans: Plan[]; scenes: FieldScene[];
}
interface Plan { name: string; price: string; price_prefix?: string; note?: string; description: string }
interface Section { heading: string; paragraphs: string[] }
interface Post { id: number; slug: string; title: string; description: string; published_at: string; minutes: number; number: string; tags: string[]; author: string; content?: Section[] }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  if (!options?.method || options.method === 'GET') {
    if (url === '/api/site') return fetchPublicJson<T>(url, 'site');
    if (url === '/api/posts') return fetchPublicJson<T>(url, 'posts', [] as T);
  }
  return safeJsonFetch<T>(url, options);
}
function GrassMark() {
  return <svg className="mark__glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6.5C16.5 3 6 2.5 6 8c0 5.5 12 2.5 12 8 0 5.5-10.5 5-12 1.5" /><path d="M18 3.5v3M6 17.5v3" /></svg>;
}

const Hero = memo(function Hero({ site, heroRef }: { site: Site; heroRef: React.RefObject<HTMLElement | null> }) {
  return <section className="hero" ref={heroRef} aria-label="Welcome">
    <h1 className="hero__word"><span className="hero__row"><span data-type="true">{site.title}</span></span></h1>
    <p className="hero__blurb">{site.description}</p>
    <p className="hero__go"><Link className="split-button primary" to="/work"><span>Check our work</span><span className="split-button__icon"><ArrowRight size={16} /></span></Link></p>
  </section>;
});

function Plans({ site, open, close }: { site: Site; open: boolean; close: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 100);
    const down = (event: PointerEvent) => { if (box.current && !box.current.contains(event.target as Node) && !(event.target as Element).closest('.subscribe-trigger')) close(); };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab' && box.current) {
        const focusable = box.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('pointerdown', down); document.addEventListener('keydown', key);
    return () => { clearTimeout(timer); document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [open, close]);
  if (!open) return null;
  return <div className="subscribe plans-panel" role="dialog" aria-modal="true" aria-labelledby="plans-title" ref={box}>
    <button ref={closeRef} className="popover-close" aria-label="Close plans" onClick={close}><X size={16} /></button>
    <p className="eyebrow">{site.title} / PLANS</p>
    <h2 id="plans-title">{site.plans_title}</h2>
    <p className="subscribe__lede">{site.plans_description}</p>
    <div className="plans-grid">{site.plans.map(plan => <section className="plan-card" key={plan.name} aria-label={`${plan.name} plan`}>
      <h3>{plan.name}</h3>
      <p className="plan-price">{plan.price_prefix && <small>{plan.price_prefix} </small>}{plan.price}</p>
      {plan.note && <p className="plan-note">{plan.note}</p>}
      <p className="plan-description">{plan.description}</p>
    </section>)}</div>
    <h3 className="plans-included-title">{site.included_title}</h3>
    <ul className="plans-included">{site.included_features.map(feature => <li key={feature}><Check size={13} aria-hidden="true" />{feature}</li>)}</ul>
    <p className="plans-terms">{site.plan_terms}</p>
    <a className="split-button accent" href={site.instagram_url} target="_blank" rel="noopener noreferrer"><span>Discuss a plan</span><span className="split-button__icon"><ArrowRight size={15} /></span></a>
  </div>;
}

function PostIndex({ posts, loading, error, retry }: { posts: Post[]; loading: boolean; error: string; retry: () => void }) {
  const [sound, setSound] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  useEffect(() => { setSpeechAvailable('speechSynthesis' in window); return () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }; }, []);
  const preview = (post: Post) => { if (!sound || !speechAvailable) return; window.speechSynthesis.cancel(); const voice = new SpeechSynthesisUtterance(post.description); voice.rate = 1; window.speechSynthesis.speak(voice); };
  const years = Array.from(new Set(posts.map(post => new Date(post.published_at).getUTCFullYear())));
  return <div className="reader" data-shown="true"><main className="reader__sheet" id="main-content">
    <p className="eyebrow">SAAFSTUDIO</p><h2>Our work</h2>
    <div className="reader__lede reader__lede--index"><p>{loading ? 'Gathering our work…' : posts.length ? `${posts.length} projects, and counting.` : 'Our work will appear here.'}</p>{speechAvailable && posts.length > 0 && <button className="reader__sound" onClick={() => { setSound(!sound); window.speechSynthesis.cancel(); }} aria-pressed={sound}>{sound ? <Volume2 size={15} /> : <VolumeX size={15} />}{sound ? 'Sound off' : 'Sound on'}</button>}</div>
    {loading && <div className="post-skeleton" aria-label="Loading articles"><i /><i /><i /></div>}
    {error && <div className="inline-error" role="alert"><p>{error}</p><button className="text-button" onClick={retry}>Try again <ArrowRight size={14} /></button></div>}
    {!loading && !error && years.map(year => <section className="reader__index" key={year} aria-label={`${year} articles`}>
      <div className="reader__year"><b>{year}</b><span>{posts.filter(p => new Date(p.published_at).getUTCFullYear() === year).length} {posts.filter(p => new Date(p.published_at).getUTCFullYear() === year).length === 1 ? 'entry' : 'entries'}</span></div>
      <div>{posts.filter(p => new Date(p.published_at).getUTCFullYear() === year).map(post => <Link key={post.id} to={`/posts/${post.slug}`} className="reader__row" onMouseEnter={() => preview(post)} onMouseLeave={() => { if (sound) window.speechSynthesis.cancel(); }} onClick={() => { if (speechAvailable) window.speechSynthesis.cancel(); }}>
        <span className="reader__title">{post.title}{posts[0]?.id === post.id && <span className="reader__latest">Latest</span>}</span>
        <span className="reader__blurb">{post.description}</span>
        <span className="reader__when"><span className="reader__tags">{post.tags.map(tag => <span key={tag}>{tag}</span>)}</span><span>{post.number} · {formatDate(post.published_at)} · {post.minutes} min</span><ArrowRight size={13} className="row-arrow" /></span>
      </Link>)}</div>
    </section>)}
  </main></div>;
}
function formatDate(date: string) { return new Date(date).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }); }

function Article({ slug, onSubscribe, posts }: { slug: string; onSubscribe: () => void; posts: Post[] }) {
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const story = useRef<HTMLElement>(null);
  const fetchPost = useCallback(async () => { setLoading(true); setError(''); try { setPost(await request<Post>(`/api/posts?slug=${encodeURIComponent(slug)}`)); } catch (err) { setError((err as Error).message); } finally { setLoading(false); } }, [slug]);
  useEffect(() => { fetchPost(); setActive(0); setPlaying(false); story.current?.scrollTo({ top: 0 }); return () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); }; }, [fetchPost]);
  useEffect(() => { if (!post) return; document.title = `${post.title} — SaafStudio`; const observer = new IntersectionObserver(entries => { entries.forEach(entry => { if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.beat)); }); }, { root: story.current, threshold: 0.5 }); story.current?.querySelectorAll('[data-beat]').forEach(el => observer.observe(el)); return () => observer.disconnect(); }, [post]);
  const jump = (index: number) => story.current?.querySelector(`[data-beat="${index}"]`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  const listen = () => {
    if (!post || !('speechSynthesis' in window)) return;
    if (playing) { speechSynthesis.cancel(); setPlaying(false); return; }
    const section = active === 0 ? `${post.title}. ${post.description}` : post.content?.[active - 1] ? `${post.content[active - 1].heading}. ${post.content[active - 1].paragraphs.join(' ')}` : 'Thank you for reading.';
    const utterance = new SpeechSynthesisUtterance(section); utterance.onend = () => setPlaying(false); utterance.onerror = () => setPlaying(false); speechSynthesis.speak(utterance); setPlaying(true);
  };
  if (loading) return <div className="reader" data-shown="true"><div className="reader__sheet"><p className="eyebrow">A MOMENT, PLEASE</p><div className="post-skeleton"><i /><i /><i /></div></div></div>;
  if (error || !post) return <div className="reader" data-shown="true"><main className="lost"><GrassMark /><h1>A page off the beaten path.</h1><p>{error || 'This article could not be found.'}</p><button className="text-button" onClick={fetchPost}>Try again</button><Link className="split-button primary" to="/posts"><span>All posts</span><ArrowRight size={15} /></Link></main></div>;
  const next = posts[(posts.findIndex(p => p.slug === slug) + 1) % posts.length];
  return <main className="story" ref={story} id="main-content">
    <nav className="story__rail" aria-label="Article sections"><button onClick={() => jump(0)} aria-current={active === 0}><i /><span>Introduction</span></button>{post.content?.map((section, i) => <button key={i} onClick={() => jump(i + 1)} aria-current={active === i + 1}><i /><span>{section.heading || `Part ${i + 1}`}</span></button>)}<button onClick={() => jump((post.content?.length || 0) + 1)} aria-current={active === (post.content?.length || 0) + 1}><i /><span>A little more</span></button></nav>
    <section className="story__beat story__beat--title" data-beat="0"><div className="story__titleInner"><p className="story__kicker">{post.tags.join(' · ')} / {post.number}</p><h1 className="story__title">{post.title}</h1><p className="story__lede">{post.description}</p><p className="story__meta">{post.author} · {formatDate(post.published_at)} · {post.minutes} min read</p></div><button className="story__hint" onClick={() => jump(1)}>SCROLL TO READ <span>↓</span></button></section>
    {post.content?.map((section, i) => <section className="story__beat" data-beat={i + 1} key={`${slug}-${i}`}><div className="story__beatInner"><p className="story__count">{String(i + 1).padStart(2, '0')} / {String(post.content?.length).padStart(2, '0')}</p>{section.heading && <h2 className="story__heading">{section.heading}</h2>}<div className="story__prose">{section.paragraphs.map((paragraph, j) => <p key={j}>{paragraph}</p>)}</div></div></section>)}
    <section className="story__beat" data-beat={(post.content?.length || 0) + 1}><div className="story__beatInner end"><p className="eyebrow">THAT’S ALL FOR THIS ONE</p><h2 className="story__heading">Thanks for spending a little time here.</h2><p className="end__lede">More thoughts on art, engineering, AI, and the little things that rarely make noise. One letter a month, or near enough.</p><button className="split-button accent" onClick={onSubscribe}><span>Keep me in the loop</span><span className="split-button__icon"><Mail size={15} /></span></button>{next && <Link className="end__next" to={`/posts/${next.slug}`}><span>{next.title} <ArrowRight size={16} /></span><small>UP NEXT</small></Link>}<button className="text-button share-button" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setCopied(false); } }}>{copied ? <><Check size={14} /> Link copied</> : 'Copy article link'}</button></div></section>
    {'speechSynthesis' in window && <div className="reading-controls"><button onClick={listen} className="icon-button" aria-label={playing ? 'Stop reading aloud' : 'Read this section aloud'}>{playing ? <Pause size={14} /> : <Play size={14} />}</button><span>{playing ? 'Reading aloud' : 'Listen to this section'}</span><span className="reading-controls__count">{active + 1} / {(post.content?.length || 0) + 2}</span></div>}
  </main>;
}

function Experience() {
  const location = useLocation();
  const navigate = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [siteError, setSiteError] = useState('');
  const [postsError, setPostsError] = useState('');
  const [postsLoading, setPostsLoading] = useState(true);
  const [fieldError, setFieldError] = useState(false);
  const [night, setNight] = useState(() => { try { return localStorage.getItem('bb-theme') === 'night'; } catch { return false; } });
  const [subscribing, setSubscribing] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const mast = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const isHome = location.pathname === '/';
  const isPosts = ['/work', '/posts'].includes(location.pathname.replace(/\/$/, ''));
  const slug = /^\/posts\/([^/]+)\/?$/.exec(location.pathname)?.[1];
  const closeSubscribe = useCallback(() => { setSubscribing(false); window.setTimeout(() => document.querySelector<HTMLButtonElement>('.subscribe-trigger')?.focus(), 0); }, []);
  const fetchSite = useCallback(async () => { setSiteError(''); try { setSite(await request<Site>('/api/site')); } catch (err) { setSiteError((err as Error).message); } }, []);
  const fetchPosts = useCallback(async () => { setPostsLoading(true); setPostsError(''); try { setPosts(await request<Post[]>('/api/posts')); } catch (err) { setPostsError((err as Error).message); } finally { setPostsLoading(false); } }, []);
  useEffect(() => { fetchSite(); fetchPosts(); }, [fetchSite, fetchPosts]);
  useEffect(() => { document.documentElement.classList.toggle('dark', night); document.documentElement.style.setProperty('--night', night ? '1' : '0'); try { localStorage.setItem('bb-theme', night ? 'night' : 'day'); } catch { /* storage can be unavailable in a private browser */ } window.dispatchEvent(new Event('bb:dusk')); }, [night]);
  useEffect(() => {
    if (!site || !root.current || !stage.current || !hero.current || !mast.current || !track.current) return;
    let canceled = false;
    let dispose: (() => void) | undefined;
    const elements = { root: root.current, stage: stage.current, hero: hero.current, mast: mast.current, track: track.current, entries: [] };
    const timer = window.setTimeout(() => elements.root.classList.remove('is-entering'), 1800);
    mountField(elements, site.scenes).then(cleanup => {
      if (canceled) { cleanup(); return; }
      dispose = cleanup; initialized.current = true;
      if (window.location.pathname !== '/') elements.root.dispatchEvent(new CustomEvent('clearing:walk'));
    }).catch(err => { console.error('Field:', err); setFieldError(true); elements.root.classList.remove('is-entering'); });
    return () => { canceled = true; clearTimeout(timer); dispose?.(); initialized.current = false; };
  }, [site]);
  useEffect(() => {
    if (!slug) document.title = isHome ? `${site?.title || 'SaafStudio'} — Design studio` : `Work — ${site?.title || 'SaafStudio'}`;
    if (initialized.current) root.current?.dispatchEvent(new CustomEvent(isHome ? 'clearing:unwalk' : 'clearing:walk'));
    setSubscribing(false);
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }, [isHome, slug, site?.title]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !subscribing && !isHome && !(event.target as Element).closest('input')) navigate(slug ? '/posts' : '/'); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [isHome, slug, subscribing, navigate]);
  if (!site) return <main className="boot-screen"><GrassMark />{siteError ? <><p role="alert">{siteError}</p><button className="text-button" onClick={fetchSite}>Try again <ArrowRight size={15} /></button></> : <><span className="boot-line" /><p>Finding a quiet little place…</p></>}</main>;
  return <div ref={root} className={`clearing is-live${!isHome ? ' is-reading' : ''}${fieldError ? ' field-fallback' : ''}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="sky" aria-hidden="true"><img src="/images/dawn.webp" alt="" /></div>
    <Hero site={site} heroRef={hero} />
    <div ref={stage} className="stage" tabIndex={isHome ? 0 : -1} role="application" aria-label="A field you can turn. Left and right arrows turn it one step." />
    {fieldError && <div className="fallback-art"><img src="/images/creative-break.webp" alt="A boy sketching beside a sleeping cat in a quiet meadow" /><p>The meadow is resting. You can still explore our work.</p></div>}
    <header ref={mast} className="mast" data-veiled={!isHome || undefined}>
      {isHome ? <Link to="/" className="mark" aria-label={`${site.title} home`}><GrassMark /><span className="mark__say">{site.title}</span></Link> : <Link className="mast__back" to={slug ? '/posts' : '/'}><ArrowLeft size={15} /><span>{slug ? 'All work' : 'Back to the field'}</span></Link>}
      <div className="mast__end"><button className="icon-button sun-button" onClick={() => setNight(!night)} title={night ? 'Bring the sun up' : 'Put the sun down'} aria-label={night ? 'Bring the sun up' : 'Put the sun down'}>{night ? <Moon size={15} fill="currentColor" /> : <Sun size={15} fill="currentColor" />}</button><Link className="nav-posts" to="/work" aria-current={isPosts ? 'page' : undefined}>Work</Link><nav className="elsewhere" aria-label="Elsewhere"><div className="social-owner"><a className="icon-button social-button instagram-link" href={site.instagram_url} target="_blank" rel="noopener noreferrer" aria-label={`${site.title} on Instagram, opens in a new tab`}><Instagram size={16} /></a><Link className="owner-access-badge" to="/owner" aria-label="Owner access" title="Owner access"><Power size={11} /></Link></div></nav><button className="split-button accent subscribe-trigger" onClick={() => setSubscribing(v => !v)} aria-expanded={subscribing} aria-haspopup="dialog"><span>Plans</span><span className="split-button__icon"><ArrowRight size={14} /></span></button></div>
    </header>
    <div className="track" ref={track}><div className="track__inner"><div className="track__bar" tabIndex={isHome ? 0 : -1} role="slider" aria-label="Turn the field" aria-valuemin={0} aria-valuemax={23} aria-valuenow={0}><span className="track__seg track__seg--l" /><span className="track__seg track__seg--r" /></div><div className="track__meta"><p>Drag to turn</p><p className="track__keys"><button type="button" data-turn="-1" aria-label="Turn left"><ArrowLeft size={16} /></button><button type="button" data-turn="1" aria-label="Turn right"><ArrowRight size={16} /></button></p></div></div></div>
    {isHome && <span id="main-content" className="sr-only">{site.title}. {site.description}</span>}
    {isPosts && <WorkGallery brand={site.title} />}
    {slug && <Article slug={decodeURIComponent(slug)} posts={posts} onSubscribe={() => setSubscribing(true)} />}
    {!isHome && !isPosts && !slug && <div className="reader" data-shown="true"><main className="lost"><GrassMark /><p className="eyebrow">404 / A LITTLE LOST</p><h1>Nothing growing here. Yet.</h1><p>Let’s head back to a more familiar patch.</p><Link className="split-button primary" to="/"><span>Back to the field</span><ArrowRight size={16} /></Link></main></div>}
    <Plans site={site} open={subscribing} close={closeSubscribe} />
  </div>;
}
export default function BoringBlog() { return <BrowserRouter><AuthProvider><Routes><Route path="/owner" element={<OwnerPage />} /><Route path="*" element={<Experience />} /></Routes></AuthProvider></BrowserRouter>; }
