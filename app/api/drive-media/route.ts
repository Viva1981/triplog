import { NextResponse } from "next/server";

type Mode = "media" | "thumb";

/**
 * /api/drive-media?id=<DRIVE_FILE_ID>&mode=thumb&sz=w1600
 * Header: Authorization: Bearer <GOOGLE_OAUTH_ACCESS_TOKEN>
 *
 * mode=media  -> Drive API alt=media (képfájlokra tökéletes)
 * mode=thumb  -> Drive API files.get(fields=thumbnailLink) + a thumbnailLink tartalmát proxyzza vissza
 *
 * A PDF-ekhez általában a thumbnailLink ad előnézetet (nem alt=media).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const mode = (url.searchParams.get("mode") as Mode) || "thumb";
    const sz = url.searchParams.get("sz") || "w1600"; // pl: w400, w800, w1600

    if (!id) {
      return new NextResponse("Missing id", { status: 400 });
    }

    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : "";

    if (!token) {
      return new NextResponse("Missing Google OAuth token (Authorization: Bearer ...)", {
        status: 401,
      });
    }

    // 1) Közvetlen tartalom (JPG/PNG stb.)
    if (mode === "media") {
      const googleRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!googleRes.ok) {
        const txt = await googleRes.text().catch(() => "");
        return new NextResponse(
          `Drive media fetch error: ${googleRes.status}\n${txt}`,
          { status: 502 }
        );
      }

      const contentType =
        googleRes.headers.get("content-type") || "application/octet-stream";

      return new NextResponse(googleRes.body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          // cache-elhető, de ne túl sokáig
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    // 2) Thumbnail mód (PDF + sok dokumentum + sok kép esetén is működik)
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=thumbnailLink,mimeType,name`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!metaRes.ok) {
      const txt = await metaRes.text().catch(() => "");
      return new NextResponse(
        `Drive meta fetch error: ${metaRes.status}\n${txt}`,
        { status: 502 }
      );
    }

    const meta = (await metaRes.json()) as {
      thumbnailLink?: string;
      mimeType?: string;
      name?: string;
    };

    if (!meta.thumbnailLink) {
      // Nincs thumbnail -> nem tudunk mit proxyzni
      return new NextResponse("No thumbnail available for this file", {
        status: 404,
      });
    }

    // thumbnailLink általában így néz ki: ...=s220
    // lecseréljük nagyobbra, hogy grid + lightbox is szép legyen
    const thumbUrl = meta.thumbnailLink.replace(/=s\d+/, `=s${sz.replace("w", "")}`);

    const thumbRes = await fetch(thumbUrl);

    if (!thumbRes.ok) {
      const txt = await thumbRes.text().catch(() => "");
      return new NextResponse(
        `Thumbnail fetch error: ${thumbRes.status}\n${txt}`,
        { status: 502 }
      );
    }

    const contentType =
      thumbRes.headers.get("content-type") || "image/jpeg";

    return new NextResponse(thumbRes.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("drive-media route error:", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
