"use client";

import type { ToolDefinition } from "@/lib/tools";

interface ToolCardProps {
  tool: ToolDefinition;
  enabled: boolean;
  highlighted: boolean;
  onToggle: (id: string) => void;
}

export default function ToolCard({
  tool,
  enabled,
  highlighted,
  onToggle,
}: ToolCardProps) {
  return (
    <div
      className={`rounded-lg border p-3 transition-all duration-300 ${
        highlighted
          ? "animate-pulse-glow border-amber-400 bg-gray-800/80"
          : enabled
          ? "border-blue-500/50 bg-gray-800/50"
          : "border-gray-700 bg-gray-800/30"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">{tool.icon}</span>
        <span className="flex-1 font-mono text-xs text-blue-400">
          {tool.name}
        </span>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={enabled}
            onChange={() => onToggle(tool.id)}
            className="peer sr-only"
          />
          <div className="h-5 w-9 rounded-full bg-gray-700 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-gray-400 after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:bg-white" />
        </label>
      </div>
      <p className="mt-1.5 text-xs text-gray-500">{tool.description}</p>
    </div>
  );
}
