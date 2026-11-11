import { createClient } from '@supabase/supabase-js';
import { safeAuthFetch } from './safeJsonFetch';

// The browser only talks to the restricted authentication proxy. Actual
// database credentials are never included in the public JavaScript bundle.
export const studioAuthUrl = `${window.location.origin}/api/studio-auth`;
export const studioAuthClientId = 'studio-auth-proxy';
const supabase = createClient(
  studioAuthUrl,
  studioAuthClientId,
  { global: { fetch: safeAuthFetch } },
);
export default supabase;
