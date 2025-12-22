"use client";

import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid"; // Ha nincs uuid, generálhatunk egyszerű random stringet is

// A te API-d válaszstruktúrája (Google Places v1)
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
  onChange: (value: string) => void;
};

export default function PlaceAutocomplete({ value, onChange }: PlaceAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Session token a Google API költségek optimalizálására
  // Egy keresési folyamat = 1 session
  const [sessionToken, setSessionToken] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    // Generálunk egy session tokent betöltéskor
    setSessionToken(crypto.randomUUID());
  }, []);

  // Klikk esemény kezelése (bezárás, ha mellékattintasz)
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
    onChange(val);

    if (val.length > 2) {
      try {
        // ITT A LÉNYEG: type=all paramétert küldünk!
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
    // A teljes név (pl. "VakVarjú Étterem, Budapest, Paulay Ede utca")
    const fullText = suggestion.placePrediction.text.text;
    
    setInputValue(fullText);
    onChange(fullText);
    setShowDropdown(false);
    
    // Új session token a következő kereséshez
    setSessionToken(crypto.randomUUID());
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