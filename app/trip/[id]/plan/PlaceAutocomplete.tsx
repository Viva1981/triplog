"use client";

import { useState, useEffect, useRef } from "react";

type Suggestion = {
  placePrediction: {
    placeId: string;
    text: {
      text: string;
    };
    structuredFormat: {
      mainText: { text: string };
      secondaryText?: { text: string };
    };
  };
};

type PlaceAutocompleteProps = {
  value: string;
  // MÓDOSÍTÁS: Mostantól nem csak stringet, hanem placeId-t is átadhatunk
  onChange: (value: string, placeId?: string) => void;
};

export default function PlaceAutocomplete({ value, onChange }: PlaceAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        setSessionToken(crypto.randomUUID());
    } else {
        setSessionToken(Math.random().toString(36).substring(2));
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    // Ha a user kézzel ír, töröljük a placeId-t, mert az nem valid Google hely
    onChange(val, undefined);

    if (val.length > 2) {
      try {
        const res = await fetch(`/api/autocomplete?input=${encodeURIComponent(val)}&session=${sessionToken}&type=all`);
        const data = await res.json();
        
        if (data.suggestions) {
          setSuggestions(data.suggestions);
          setShowDropdown(true);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error("Place fetch error:", err);
      }
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  };

  const handleSelect = (suggestion: Suggestion) => {
    const fullText = suggestion.placePrediction.text.text;
    const placeId = suggestion.placePrediction.placeId;
    
    setInputValue(fullText);
    // VISSZAADJUK A PLACE_ID-t IS!
    onChange(fullText, placeId);
    
    setShowDropdown(false);
    
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        setSessionToken(crypto.randomUUID());
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53]"
        placeholder="Keresés... (pl. étterem, múzeum)"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
      />
      
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-100 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((item) => {
            const pred = item.placePrediction;
            return (
              <li
                key={pred.placeId}
                onClick={() => handleSelect(item)}
                className="cursor-pointer px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-none transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800">
                    {pred.structuredFormat.mainText.text}
                  </span>
                  <span className="text-xs text-slate-500 truncate">
                    {pred.structuredFormat.secondaryText?.text}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}