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

  // Autocomplete lekérés (backend proxy!)
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/autocomplete?input=${query}`);
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = async (s: any) => {
    const placeId = s.placePrediction.placeId;

    const res = await fetch(`/api/place?placeId=${placeId}`);
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
    setSuggestions([]);
  };

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full rounded-xl border border-slate-200 px-3 py-2"
        placeholder="Pl.: Barcelona, Spanyolország"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
      />

      {isFocused && suggestions.length > 0 && (
        <div className="absolute z-20 bg-white w-full mt-2 rounded-xl shadow-lg border max-h-64 overflow-y-auto">
          {suggestions.map((s, i) => {
            const main = s.placePrediction.text.text;
            const secondary = s.placePrediction.structuredFormat?.secondaryText?.text ?? "";

            return (
              <button
                key={i}
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
