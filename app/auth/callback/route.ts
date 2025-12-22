import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // A "next" paraméter megadja, hova irányítsunk login után (alapból a főoldalra)
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = cookies()
    
    // Szerver oldali Supabase kliens létrehozása a token beváltásához
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options })
          },
        },
      }
    )
    
    // A Google-től kapott kód beváltása session-re
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Ha sikerült, visszairányítunk az oldalra (már bejelentkezve)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Ha hiba volt, vagy nem volt kód, visszadobjuk a főoldalra (esetleg hibaüzenettel)
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}