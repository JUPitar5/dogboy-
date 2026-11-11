export const API_UNAVAILABLE_MESSAGE = 'The backend is unavailable in this preview. Open the deployed website to sign in or save changes.';

export class ApiFetchError extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = 'ApiFetchError';
    this.status = status;
  }
}

interface JsonOptions<T> {
  fallback?: () => T | Promise<T>;
  validate?: (value: unknown) => boolean;
  onSuccess?: (value: T) => void;
  timeoutMs?: number;
}

function isJson(response: Response) {
  const type = response.headers.get('content-type')?.toLowerCase() || '';
  return type.includes('application/json') || /^application\/[\w.+-]+\+json(?:;|$)/.test(type);
}
function errorMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object') return fallback;
  const data = value as Record<string, unknown>;
  for (const key of ['error_description', 'message', 'error']) {
    if (typeof data[key] === 'string' && data[key]) return data[key] as string;
  }
  return fallback;
}
async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init.signal?.aborted) abort();
  else init.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); init.signal?.removeEventListener('abort', abort); }
}

/** Public GETs may use a read-only fallback. Writes and authentication fail closed. */
export async function safeJsonFetch<T>(input: RequestInfo | URL, init: RequestInit = {}, options: JsonOptions<T> = {}): Promise<T> {
  try {
    const response = await fetchWithTimeout(input, init, options.timeoutMs ?? 10000);
    if (!response.ok) {
      let message = response.status >= 500 ? API_UNAVAILABLE_MESSAGE : `The request could not be completed (${response.status}).`;
      if (isJson(response)) {
        try { message = errorMessage(await response.json(), message); } catch { /* Never expose a JSON parser error from an error page. */ }
      }
      throw new ApiFetchError(message, response.status);
    }
    if (!isJson(response)) throw new ApiFetchError(API_UNAVAILABLE_MESSAGE);
    let data: T;
    try { data = await response.json() as T; }
    catch { throw new ApiFetchError('The server returned an invalid response. Please try again on the deployed website.'); }
    if (options.validate && !options.validate(data)) throw new ApiFetchError(API_UNAVAILABLE_MESSAGE);
    options.onSuccess?.(data);
    return data;
  } catch (error) {
    const method = (init.method || 'GET').toUpperCase();
    if ((method === 'GET' || method === 'HEAD') && options.fallback) return await options.fallback();
    if (error instanceof ApiFetchError) throw error;
    throw new ApiFetchError(API_UNAVAILABLE_MESSAGE);
  }
}

type PublicResource = 'site' | 'posts' | 'work';
const publicMemory = new Map<PublicResource, unknown>();
function validPublicData(resource: PublicResource, value: unknown) {
  if (resource !== 'site') return Array.isArray(value);
  if (!value || typeof value !== 'object') return false;
  const site = value as Record<string, unknown>;
  return typeof site.title === 'string' && typeof site.description === 'string' && Array.isArray(site.scenes) && Array.isArray(site.plans) && Array.isArray(site.included_features);
}
function remember(resource: PublicResource, value: unknown) {
  publicMemory.set(resource, value);
  try { localStorage.setItem(`saaf:public:v1:${resource}`, JSON.stringify({ savedAt: Date.now(), value })); } catch { /* Browsing in private mode must still work. */ }
}
function remembered(resource: PublicResource) {
  if (publicMemory.has(resource)) return publicMemory.get(resource);
  try {
    const cached = JSON.parse(localStorage.getItem(`saaf:public:v1:${resource}`) || 'null');
    if (cached && Date.now() - cached.savedAt < 86400000 && validPublicData(resource, cached.value)) return cached.value;
  } catch { /* Ignore stale or malformed browser cache entries. */ }
  return undefined;
}
function inlineSnapshot(resource: PublicResource) {
  try {
    const value = JSON.parse(document.getElementById('saaf-public-snapshot')?.textContent || 'null')?.[resource];
    return validPublicData(resource, value) ? value : undefined;
  } catch { return undefined; }
}

/** Snapshots contain only real, published database content, never owner data. */
export function fetchPublicJson<T>(url: string, resource: PublicResource, defaultValue?: T): Promise<T> {
  return safeJsonFetch<T>(url, {}, {
    validate: value => validPublicData(resource, value),
    onSuccess: value => remember(resource, value),
    fallback: async () => {
      const cached = remembered(resource);
      if (validPublicData(resource, cached)) return cached as T;
      const embedded = inlineSnapshot(resource);
      if (validPublicData(resource, embedded)) return embedded as T;
      const base = import.meta.env.BASE_URL || '/';
      return safeJsonFetch<T>(`${base}data/${resource}.json`, {}, {
        timeoutMs: 3000,
        validate: value => validPublicData(resource, value),
        ...(defaultValue !== undefined ? { fallback: () => defaultValue } : {}),
      });
    },
  });
}

/** Supabase's auth SDK also parses JSON internally; normalize bad routing responses. */
export async function safeAuthFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  try {
    const response = await fetchWithTimeout(input, init, 10000);
    if (response.ok && response.status === 204) return response;
    if (!isJson(response)) throw new ApiFetchError(API_UNAVAILABLE_MESSAGE);
    // Validate a clone so the SDK still receives its original, unread response body.
    await response.clone().json();
    return response;
  } catch {
    return new Response(JSON.stringify({ error: 'backend_unavailable', code: 'backend_unavailable', error_description: API_UNAVAILABLE_MESSAGE, message: API_UNAVAILABLE_MESSAGE }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}
