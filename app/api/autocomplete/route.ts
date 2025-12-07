import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const input = searchParams.get("input");

  if (!input) {
    return NextResponse.json({ suggestions: [] });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY; // SERVER-ONLY kulcs!

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places:autocomplete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey!,
          "X-Goog-FieldMask":
            "suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text,suggestions.placePrediction.placeId",
        },
        body: JSON.stringify({
          input,
          languageCode: "hu",
          regionCode: "HU",
          includedPrimaryTypes: ["locality"],
        }),
      }
    );

    const data = await res.json();
    return NextResponse.json({ suggestions: data.suggestions ?? [] });
  } catch (e) {
    return NextResponse.json({ suggestions: [] }, { status: 500 });
  }
}
