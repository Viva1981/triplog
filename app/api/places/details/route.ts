import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('placeId');
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!placeId || !apiKey) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // JAVÍTÁS: Átállás a Google Places API (New) V1-re
  // Ez a modern végpont, ami biztosan kompatibilis a keresővel
  const url = `https://places.googleapis.com/v1/places/${placeId}?fields=location&key=${apiKey}&languageCode=hu`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    // A V1 API válasza kicsit más: location: { latitude, longitude }
    if (data.location) {
      return NextResponse.json({ 
        lat: data.location.latitude,
        lng: data.location.longitude 
      });
    } else {
      console.error("Google API Error:", data);
      return NextResponse.json({ error: 'Not found or API error' }, { status: 404 });
    }
  } catch (error) {
    console.error("Server Fetch Error:", error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}