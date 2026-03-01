"use client";

import { useState } from "react";

interface WorkshopKeyModalProps {
  onSubmit: (key: string) => void;
}

export default function WorkshopKeyModal({ onSubmit }: WorkshopKeyModalProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Please enter a workshop key.");
      return;
    }
    try {
      localStorage.setItem("wk", trimmed);
    } catch {}
    onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[90%] max-w-md rounded-xl border border-gray-700 bg-gray-900 p-8 text-center shadow-2xl">
        <div className="mb-2 text-3xl">{"\u{1F510}"}</div>
        <h2 className="mb-2 text-xl font-bold text-gray-100">Workshop Key</h2>
        <p className="mb-6 text-sm text-gray-400">
          Enter the key shared by your workshop facilitator.
        </p>
        <input
          type="text"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Enter workshop key..."
          className="mb-3 w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-gray-100 placeholder-gray-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 active:scale-[0.98]"
        >
          Enter Playground
        </button>
        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
