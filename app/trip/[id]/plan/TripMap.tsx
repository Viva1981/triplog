"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useMemo, useState } from "react";
import type { TripActivity } from "../../../../lib/trip/types";

// Stílus a térkép konténernek
const containerStyle = {
  width: "100%",
  height: "500px",
  borderRadius: "1rem",
};

// Alapértelmezett középpont (ha nincs adat): Európa közepe
const defaultCenter = {
  lat: 47.4979,
  lng: 19.0402,
};

type TripMapProps = {
  activities: TripActivity[];
};

export default function TripMap({ activities }: TripMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY!,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Csak azok a programok kellenek, amiknek van koordinátája
  const markers = useMemo(() => {
    return activities.filter(a => a.location_lat && a.location_lng);
  }, [activities]);

  const center = useMemo(() => {
    if (markers.length > 0) {
      return { lat: markers[0].location_lat!, lng: markers[0].location_lng! };
    }
    return defaultCenter;
  }, [markers]);

  // Amikor betölt a térkép, igazítsuk a zoomot a pontokhoz
  const onLoad = (mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    if (markers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach(m => bounds.extend({ lat: m.location_lat!, lng: m.location_lng! }));
      mapInstance.fitBounds(bounds);
    }
  };

  // Ha változnak a markerek, újra igazítjuk a nézetet
  useMemo(() => {
    if (map && markers.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        markers.forEach(m => bounds.extend({ lat: m.location_lat!, lng: m.location_lng! }));
        map.fitBounds(bounds);
    }
  }, [map, markers]);

  if (!isLoaded) {
    return (
      <div className="w-full h-[500px] bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 animate-pulse">
        Térkép betöltése...
      </div>
    );
  }

  if (markers.length === 0) {
      return (
        <div className="w-full h-64 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
            <span className="text-2xl mb-2">🗺️</span>
            <p className="text-sm">Nincsenek megjeleníthető helyszínek.</p>
            <p className="text-xs">Adj hozzá programokat konkrét helyszínnel!</p>
        </div>
      )
  }

  return (
    <div className="shadow-lg rounded-2xl border border-slate-100 overflow-hidden">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={10}
        onLoad={onLoad}
        options={{
            disableDefaultUI: true, // Letisztult nézet
            zoomControl: true,
            styles: [ // Opcionális: Kicsit tompított, modern térkép stílus (Google JSON style)
                {
                    "featureType": "poi",
                    "stylers": [{ "visibility": "off" }] // Ne zavarjanak a Google saját ikonjai
                }
            ]
        }}
      >
        {markers.map((activity) => (
          <Marker
            key={activity.id}
            position={{ lat: activity.location_lat!, lng: activity.location_lng! }}
            title={activity.title}
            // Itt később lehet custom ikont beállítani (pl. zöld pötty)
            // icon={{ url: '/path/to/icon.png' }} 
          />
        ))}
      </GoogleMap>
    </div>
  );
}