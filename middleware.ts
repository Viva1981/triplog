import { NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req) {
  const res = NextResponse.next();

  // SSR Supabase kliens létrehozása
  const supabase = createMiddlewareClient({ req, res });

  // Ez tölti be és frissíti a sessiont a cookie-ból
  await supabase.auth.getSession();

  return res;
}
