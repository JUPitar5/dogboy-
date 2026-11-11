import { defineConfig, loadEnv } from 'vite'
import type { PluginOption, PreviewServer, ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

type PublicSnapshot = { site: Record<string, unknown>; posts: Array<{ slug: string }>; work: unknown[] }

function protectApiPaths(server: ViteDevServer | PreviewServer) {
  if (server.config.server.proxy?.['/api'] || server.config.preview.proxy?.['/api']) return;
  server.middlewares.use((req, res, next) => {
    const path = (req.url || '').split('?')[0];
    if (path !== '/api' && !path.startsWith('/api/')) return next();
    // Vite does not execute Vercel functions. Never let its SPA fallback handle APIs.
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'The backend is unavailable in this preview. Open the deployed website to sign in or save changes.' }));
  });
}

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins: PluginOption[] = [react(), tailwindcss()];
  try {
    // @ts-ignore
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch {}

  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
  }

  let snapshotPromise: Promise<PublicSnapshot> | undefined;
  const getSnapshot = () => snapshotPromise ||= (async () => {
    let snapshot: PublicSnapshot;
    try {
      const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      const [settings, scenes, posts, work] = await Promise.all([
        db.from('boring_settings').select('content').eq('id', 'main').single(),
        db.from('boring_scenes').select('*').order('position', { ascending: true }),
        db.from('boring_posts').select('*').order('published_at', { ascending: false }),
        db.from('saaf_work').select('id,title,category,description,image_url,link_url,published,created_at').eq('published', true).order('created_at', { ascending: false }),
      ]);
      for (const result of [settings, scenes, posts, work]) if (result.error) throw result.error;
      snapshot = { site: { ...settings.data!.content, scenes: scenes.data }, posts: posts.data || [], work: work.data || [] };
      await mkdir('public/data', { recursive: true });
      await Promise.all(Object.entries(snapshot).map(([name, data]) => writeFile(`public/data/${name}.json`, JSON.stringify(data))));
    } catch {
      // Existing public snapshots support offline/static previews without restoring deleted posts.
      console.warn('Live public content unavailable; using the saved public/data snapshots.');
      const [site, posts, work] = await Promise.all(['site', 'posts', 'work'].map(async name => JSON.parse(await readFile(`public/data/${name}.json`, 'utf8'))));
      snapshot = { site, posts, work };
    }
    return snapshot;
  })();

  // Read-only snapshots are generated from actual published database content.
  // They live in public/, never src/, and contain no sessions or owner credentials.
  plugins.push({
    name: 'studio-public-preview',
    async buildStart() { await getSnapshot(); },
    configureServer: protectApiPaths,
    configurePreviewServer: protectApiPaths,
    async transformIndexHtml() {
      const snapshot = await getSnapshot();
      return [{ tag: 'script', attrs: { id: 'saaf-public-snapshot', type: 'application/json' }, children: JSON.stringify(snapshot).replace(/</g, '\\u003c'), injectTo: 'head' as const }];
    },
    async closeBundle() {
      const snapshot = await getSnapshot();
      const html = await readFile('dist/index.html', 'utf8');
      const routes = ['posts', 'work', 'owner', ...snapshot.posts.map(post => `posts/${post.slug}`)];
      for (const route of routes) {
        if (!/^(?:posts(?:\/[a-z0-9-]+)?|work|owner)$/.test(route)) continue;
        await mkdir(`dist/${route}`, { recursive: true });
        await writeFile(`dist/${route}/index.html`, html);
      }
    },
  });

  return {
    base: '/',
    publicDir: 'public',
    plugins,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: processEnvDefines,
  };
})
