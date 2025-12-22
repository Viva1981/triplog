import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('placeId');
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!placeId || !apiKey) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // VISSZA A KLASSZIKUSHOZ: Ez a legstabilabb végpont
  // Nem kell header, csak sima URL paraméterek
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    // A klasszikus API válasza: result.geometry.location
    if (data.status === 'OK' && data.result?.geometry?.location) {
      return NextResponse.json({ 
        lat: data.result.geometry.location.lat,
        lng: data.result.geometry.location.lng 
      });
    } else {
      console.error("GOOGLE API ERROR:", data.status, data.error_message);
      return NextResponse.json({ error: data.error_message || 'Place not found' }, { status: 404 });
    }

  } catch (error) {
    console.error("SERVER FETCH ERROR:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}