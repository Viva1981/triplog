import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return new NextResponse("Missing fileId", { status: 400 });
    }

    // Get Google OAuth token from Supabase session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const accessToken = session?.provider_token;
    if (!accessToken) {
      return new NextResponse("Missing Google token", { status: 401 });
    }

    // Fetch the file from Google Drive (binary)
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

    // Pass through the content-type from Google
    const contentType = googleRes.headers.get("content-type") ?? "image/jpeg";
    const arrayBuffer = await googleRes.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "max-age=3600", // 1 hour caching
      },
    });
  } catch (err) {
    console.error("PROXY ERROR:", err);
    return new NextResponse("Internal Proxy Error", { status: 500 });
  }
}
