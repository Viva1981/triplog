import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const placeId = searchParams.get("placeId");
  const session = searchParams.get("session") ?? "";

  const apiKey = process.env.GOOGLE_PLACES_API_KEY!;

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?languageCode=hu&sessionToken=${session}&fields=addressComponents,displayName`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
      },
    }
  );

  const data = await res.json();
  return NextResponse.json(data);
}
