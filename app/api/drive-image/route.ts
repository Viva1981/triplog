import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return new NextResponse("Missing fileId", { status: 400 });
    }

    // Supabase server client that reads cookies
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const accessToken = session?.provider_token;

    if (!accessToken) {
      return new NextResponse("Missing Google token", { status: 401 });
    }

    // Fetch binary data from Google Drive
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
