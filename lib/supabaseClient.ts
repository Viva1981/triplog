import { createBrowserClient } from '@supabase/ssr'

// A modern SSR-kompatibilis kliens létrehozása
// Ez biztosítja, hogy a login során 'code'-ot kapjunk, ne 'hash'-t.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
