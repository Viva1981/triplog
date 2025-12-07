"use client";

import { useState, useEffect } from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export default function DestinationAutocomplete({ value, onChange }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  // ---------------------------------------------
  // Autocomplete Web API hívása (város-only mód)
  // ---------------------------------------------
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }

      setLoading(true);

      try {
        const res = await fetch(
          `https://places.googleapis.com/v1/places:autocomplete?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: query,
              languageCode: "hu",
              regionCode: "HU",
              includedPrimaryTypes: ["locality"], // város only
            }),
          }
        );

        const data = await res.json();

        if (data?.suggestions) {
          setSuggestions(data.suggestions);
        } else {
          setSuggestions([]);
        }
      } catch (e) {
        console.error("Autocomplete error:", e);
      }

      setLoading(false);
    };

    const timeout = setTimeout(fetchSuggestions, 200); // debounce

    return () => clearTimeout(timeout);
  }, [query]);

  // ---------------------------------------------
  // Kiválasztott város adatainak lekérése
  // ---------------------------------------------
  const handleSelect = async (suggestion: any) => {
    const placeId = suggestion.placePrediction?.placeId;
    if (!placeId) return;

    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}?fields=addressComponents,displayName,formattedAddress&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      );

      const place = await res.json();

      // Address components feldolgozása
      const comps = place.addressComponents || [];

      const city =
        comps.find((c: any) => c.types.includes("locality"))?.longText ??
        place.displayName;

      const region = comps.find((c: any) =>
        c.types.includes("administrative_area_level_1")
      )?.longText;

      const country = comps.find((c: any) =>
        c.types.includes("country")
      )?.longText;

      const finalString = [city, region, country].filter(Boolean).join(", ");

      onChange(finalString);
      setQuery(finalString);
      setSuggestions([]);
    } catch (err) {
      console.error("Place details error:", err);
    }
  };

  // ---------------------------------------------
  // UI – Booking style
  // ---------------------------------------------
  return (
    <div className="relative">
      <input
        type="text"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
        placeholder="Pl.: Barcelona, Katalónia, Spanyolország"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
      />

      {isFocused && suggestions.length > 0 && (
        <div className="absolute z-20 bg-white w-full mt-2 rounded-xl shadow-lg border border-slate-100 max-h-64 overflow-y-auto">
          {suggestions.map((s: any, i: number) => {
            const main = s.placePrediction?.text?.text ?? "";
            const secondary = s.placePrediction?.structuredFormat?.secondaryText?.text ?? "";

            return (
              <button
                key={i}
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
