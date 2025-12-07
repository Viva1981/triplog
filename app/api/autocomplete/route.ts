import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const input = searchParams.get("input") ?? "";
  const session = searchParams.get("session") ?? "";

  const apiKey = process.env.GOOGLE_PLACES_API_KEY!;

  const res = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.placeId",
      },
      body: JSON.stringify({
        input,
        languageCode: "hu",
        regionCode: "HU",
        sessionToken: session,
        includedPrimaryTypes: ["locality"], // város-only
      }),
    }
  );

  const data = await res.json();
  return NextResponse.json({ suggestions: data.suggestions ?? [] });
}
