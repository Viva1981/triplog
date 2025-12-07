import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const placeId = searchParams.get("placeId");

  if (!placeId) {
    return NextResponse.json({ error: "Missing placeId" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?fields=addressComponents,displayName,formattedAddress`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey!,
        },
      }
    );

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
