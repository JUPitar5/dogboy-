import { defineConfig, loadEnv } from 'vite'
import type { PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

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

  // Emit entry documents so shared article URLs work without changing the
  // provisioned Vercel configuration. Article content still loads via the API.
  plugins.push({
    name: 'blog-route-documents',
    async closeBundle() {
      const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      const { data, error } = await db.from('boring_posts').select('slug');
      if (error) throw error;
      const html = await readFile('dist/index.html', 'utf8');
      const routes = ['posts', 'work', 'owner', ...data.map(post => `posts/${post.slug}`)];
      for (const route of routes) {
        if (!/^(?:posts(?:\/[a-z0-9-]+)?|work|owner)$/.test(route)) continue;
        await mkdir(`dist/${route}`, { recursive: true });
        await writeFile(`dist/${route}/index.html`, html);
      }
    },
  });

  return {
    plugins,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: processEnvDefines,
  };
})
