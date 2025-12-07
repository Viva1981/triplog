"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export default function DestinationAutocomplete({ value, onChange }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const sessionTokenRef = useRef<string | null>(null);

  // Új session token minden fókuszra → olcsóbb Google szerint
  const startNewSession = () => {
    sessionTokenRef.current = crypto.randomUUID();
  };

  useEffect(() => {
    if (isFocused && !sessionTokenRef.current) {
      startNewSession();
    }
  }, [isFocused]);

  // --------------------------------------------
  // Autocomplete API hívás (backend proxy)
  // --------------------------------------------
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      const res = await fetch(
        `/api/autocomplete?input=${encodeURIComponent(query)}&session=${sessionTokenRef.current}`
      );

      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  // --------------------------------------------
  // Város kiválasztása → details lekérés
  // --------------------------------------------
  const handleSelect = async (s: any) => {
    const placeId = s.placePrediction.placeId;

    // Session token átadása a backendnek
    const res = await fetch(
      `/api/place?placeId=${placeId}&session=${sessionTokenRef.current}`
    );

    const place = await res.json();

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

    // UX: AZONNAL zárjuk a találati listát
    setSuggestions([]);
    setIsFocused(false);

    // új session indul
    startNewSession();
  };

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#16ba53]/30"
        placeholder="Pl.: Barcelona, Spanyolország"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => {
          setIsFocused(true);
          startNewSession();
        }}
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
      />

      {isFocused && suggestions.length > 0 && (
        <div className="absolute z-20 bg-white w-full mt-2 rounded-xl shadow-lg border border-slate-100 max-h-64 overflow-y-auto">
          {suggestions.map((s: any, index: number) => {
            const main = s.placePrediction.text.text;
            const secondary =
              s.placePrediction.structuredFormat?.secondaryText?.text ?? "";

            return (
              <button
                key={index}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s)}
                className="flex items-start gap-2 w-full text-left px-3 py-2 hover:bg-slate-50"
              >
                <span className="mt-1 text-green-600">📍</span>
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
