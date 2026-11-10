// Some provisioned environments expose the shared database credential under
// NEXT_PUBLIC_SUPABASE_ANON_KEY only. Preserve a dedicated server key when present.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
