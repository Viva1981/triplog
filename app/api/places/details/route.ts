import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('placeId');
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!placeId || !apiKey) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // JAVÍTÁS: A mezőket (location) és a kulcsot Header-ben küldjük.
  // Ez a "Places API (New)" hivatalos, ajánlott módja.
  const url = `https://places.googleapis.com/v1/places/${placeId}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'location', // Itt kérjük le a koordinátát
        'Accept-Language': 'hu',
      },
    });

    const data = await res.json();

    // Debugoláshoz: Ha hiba van, látni fogjuk a Vercel logokban
    if (!res.ok) {
      console.error("GOOGLE API ERROR:", data);
      return NextResponse.json({ error: data.error?.message || 'Google API Error' }, { status: res.status });
    }

    if (data.location) {
      return NextResponse.json({ 
        lat: data.location.latitude,
        lng: data.location.longitude 
      });
    } else {
      console.error("NO LOCATION IN DATA:", data);
      return NextResponse.json({ error: 'Location not found in response' }, { status: 404 });
    }

  } catch (error) {
    console.error("SERVER FETCH ERROR:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}