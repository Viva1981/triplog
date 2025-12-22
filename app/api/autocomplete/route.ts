import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const input = searchParams.get("input") ?? "";
  const session = searchParams.get("session") ?? "";
  
  // ÚJ: Megnézzük, van-e 'type' paraméter
  // Ha 'all', akkor mindent keresünk (étterem, múzeum, stb.)
  // Ha nincs, akkor marad a 'locality' (csak település)
  const typeParam = searchParams.get("type");

  const apiKey = process.env.GOOGLE_PLACES_API_KEY!;

  const requestBody: any = {
    input,
    languageCode: "hu",
    regionCode: "HU", // Ezt opcionálisan kiveheted, ha globálisan akarsz keresni, de így pontosabb
    sessionToken: session,
  };

  // Csak akkor szűkítünk városokra, ha NEM 'all' a kérés
  if (typeParam !== "all") {
    requestBody.includedPrimaryTypes = ["locality"];
  }

  const res = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // Kérjük a 'placeId'-t, a teljes szöveget és a strukturált szöveget
        "X-Goog-FieldMask":
          "suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.placeId",
      },
      body: JSON.stringify(requestBody),
    }
  );

  const data = await res.json();
  return NextResponse.json({ suggestions: data.suggestions ?? [] });
}