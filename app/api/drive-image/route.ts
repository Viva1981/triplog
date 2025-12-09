import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return new NextResponse("Missing fileId", { status: 400 });
    }

    // Create a Supabase server-side client with cookie access
    const cookieStore = cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Read session from cookies (works server-side!)
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const accessToken = session?.provider_token;

    if (!accessToken) {
      return new NextResponse("Missing Google token (server)", {
        status: 401,
      });
    }

    // Fetch binary image from Google Drive
    const googleRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!googleRes.ok) {
      return new NextResponse(
        `Drive fetch error: ${googleRes.status}`,
        { status: 500 }
      );
    }

    // Return binary image
    const contentType =
      googleRes.headers.get("content-type") ?? "image/jpeg";
    const arrayBuffer = await googleRes.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("PROXY ERROR:", error);
    return new NextResponse("Internal Proxy Error", { status: 500 });
  }
}
