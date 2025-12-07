"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export default function DestinationAutocomplete({ value, onChange }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);

  // -----------------------------
  // SCRIPT BETÖLTÉS: Google Maps Places API
  // -----------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ((window as any).google?.maps?.places) {
      setLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setLoaded(true);
    };

    document.body.appendChild(script);
  }, []);

  // -----------------------------
  // AUTOCOMPLETE SERVICE INIT
  // -----------------------------
  useEffect(() => {
    if (!loaded) return;

    const { google } = window as any;
    if (!google) return;

    autocompleteServiceRef.current =
      new google.maps.places.AutocompleteService();

    const dummy = document.createElement("div");
    placesServiceRef.current = new google.maps.places.PlacesService(dummy);
  }, [loaded]);

  // -----------------------------
  // GET SUGGESTIONS (CITY-ONLY MODE)
  // -----------------------------
  useEffect(() => {
    if (!loaded) return;
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const { google } = window as any;

    autocompleteServiceRef.current.getPlacePredictions(
      {
        input: query,
        types: ["(cities)"], // CITY-ONLY MODE
        language: "hu",
        region: "hu",
      },
      (predictions: any[]) => {
        if (!predictions) {
          setSuggestions([]);
          return;
        }
        setSuggestions(predictions);
      }
    );
  }, [query, loaded]);

  // -----------------------------
  // KIVÁLASZTOTT HELY RÉSZLETEINEK LEKÉRÉSE
  // -----------------------------
  const handleSelect = (prediction: any) => {
    if (!placesServiceRef.current) return;

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["address_components", "formatted_address", "geometry"],
      },
      (place: any) => {
        if (!place) return;

        const comps = place.address_components || [];

        const city =
          comps.find((c: any) =>
            c.types.includes("locality")
          )?.long_name ||
          comps.find((c: any) =>
            c.types.includes("administrative_area_level_1")
          )?.long_name;

        const region = comps.find((c: any) =>
          c.types.includes("administrative_area_level_1")
        )?.long_name;

        const country = comps.find((c: any) =>
          c.types.includes("country")
        )?.long_name;

        // BOOKING STYLE FORMAT
        const finalString = [city, region, country].filter(Boolean).join(", ");

        onChange(finalString);
        setQuery(finalString);
        setSuggestions([]);
      }
    );
  };

  return (
    <div className="relative">
      {/* INPUT */}
      <input
        type="text"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
        placeholder="Pl.: Barcelona, Spanyolország"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value); // fallback plain text
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
      />

      {/* SUGGESTION LIST */}
      {isFocused && suggestions.length > 0 && (
        <div className="absolute z-20 bg-white w-full mt-2 rounded-xl shadow-lg border border-slate-100 max-h-64 overflow-y-auto">
          {suggestions.map((s) => {
            const main = s.structured_formatting.main_text;
            const secondary = s.structured_formatting.secondary_text;

            return (
              <button
                key={s.place_id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s)}
                className="flex items-start gap-2 w-full text-left px-3 py-2 hover:bg-slate-50"
              >
                <span className="mt-1 text-slate-500">📍</span>
                <div>
                  <div className="font-medium text-slate-800">{main}</div>
                  <div className="text-xs text-slate-500">{secondary}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
