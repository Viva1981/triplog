"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export default function DestinationAutocomplete({ value, onChange }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [placesLib, setPlacesLib] = useState<any>(null);
  const [isFocused, setIsFocused] = useState(false);

  const sessionTokenRef = useRef<any>(null);
  const autocompleteServiceRef = useRef<any>(null);

  // ------------------------------------------------------------
  // 1) Google Places Library betöltése (2025 ajánlott mód)
  // ------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function loadPlaces() {
      try {
        // Google Maps Places library betöltése
        // A kulcsot a script automatikusan betölti
        const { AutocompleteSessionToken, AutocompleteService, Place } =
          (await (window as any).google.maps.importLibrary("places")) as any;

        if (!isMounted) return;

        setPlacesLib({ AutocompleteSessionToken, AutocompleteService, Place });

        // Session token (Google szerint kötelező minden új sessionhöz)
        sessionTokenRef.current = new AutocompleteSessionToken();

        autocompleteServiceRef.current =
          new AutocompleteService();
      } catch (err) {
        console.error("Places library load error:", err);
      }
    }

    // Ha google még nincs betöltve, várjunk
    const check = setInterval(() => {
      if ((window as any).google?.maps?.importLibrary) {
        clearInterval(check);
        loadPlaces();
      }
    }, 100);

    return () => {
      isMounted = false;
      clearInterval(check);
    };
  }, []);

  // ------------------------------------------------------------
  // 2) Ha a user gépel → város-only autocomplete kérés
  // ------------------------------------------------------------
  useEffect(() => {
    if (!placesLib) return;
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const service = autocompleteServiceRef.current;
    if (!service) return;

    service.getPlacePredictions(
      {
        input: query,
        types: ["(cities)"], // CITY-ONLY ⚡
        sessionToken: sessionTokenRef.current,
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
  }, [query, placesLib]);

  // ------------------------------------------------------------
  // 3) Város kiválasztása → részletes adatok lekérése
  // ------------------------------------------------------------
  const handleSelect = async (prediction: any) => {
    try {
      if (!placesLib) return;

      const { Place } = placesLib;

      const place = new Place({
        placeId: prediction.place_id,
        requestedLanguage: "hu",
      });

      // Fetch fields (2025 új módszer)
      await place.fetchFields({
        fields: ["addressComponents", "displayName", "formattedAddress"],
      });

      const components = place.addressComponents || [];

      // város
      const city =
        components.find((c: any) =>
          c.types.includes("locality")
        )?.longText ??
        components.find((c: any) =>
          c.types.includes("administrative_area_level_1")
        )?.longText ??
        place.displayName;

      // régió
      const region = components.find((c: any) =>
        c.types.includes("administrative_area_level_1")
      )?.longText;

      // ország
      const country = components.find((c: any) =>
        c.types.includes("country")
      )?.longText;

      // Booking-stílusú format
      const finalString = [city, region, country].filter(Boolean).join(", ");

      onChange(finalString);
      setQuery(finalString);
      setSuggestions([]);
    } catch (err) {
      console.error("Place details error:", err);
    }
  };

  // ------------------------------------------------------------
  // UI — Booking stílusú lista
  // ------------------------------------------------------------
  return (
    <div className="relative">
      <input
        type="text"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
        placeholder="Pl.: Barcelona, Katalónia, Spanyolország"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value); // fallback text
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
      />

      {isFocused && suggestions.length > 0 && (
        <div className="absolute z-20 bg-white w-full mt-2 rounded-xl shadow-lg border border-slate-100 max-h-64 overflow-y-auto">
          {suggestions.map((s: any) => {
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
