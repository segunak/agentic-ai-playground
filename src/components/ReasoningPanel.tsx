"use client";

import { useEffect, useRef } from "react";

export interface ReasoningStep {
  type: "thinking" | "tool-call" | "tool-result" | "response" | "divider";
  label?: string;
  detail?: string;
}

interface ReasoningPanelProps {
  steps: ReasoningStep[];
}

const ICONS: Record<string, string> = {
  thinking: "\u{1F914}",
  "tool-call": "\u{1F527}",
  "tool-result": "\u{1F4CB}",
  response: "\u{1F4AC}",
};

const STYLES: Record<string, string> = {
  thinking: "border-l-purple-400 bg-purple-950/40 text-purple-300",
  "tool-call": "border-l-amber-400 bg-amber-950/30 text-amber-300",
  "tool-result": "border-l-emerald-400 bg-emerald-950/30 text-emerald-300",
  response: "border-l-blue-400 bg-blue-950/30 text-blue-300",
};

export default function ReasoningPanel({ steps }: ReasoningPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps]);

  if (steps.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-1">
        <p className="py-8 text-center text-xs italic text-gray-500">
          Send a message to see the agent think!
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-1">
      {steps.map((step, i) => {
        if (step.type === "divider") {
          return (
            <hr
              key={i}
              className="my-3 border-0 border-t border-dashed border-gray-700"
            />
          );
        }

        return (
          <div
            key={i}
            className={`animate-fade-slide-in mb-1.5 rounded-md border-l-[3px] px-3 py-2 text-xs leading-relaxed ${
              STYLES[step.type] || ""
            }`}
          >
            <span className="font-semibold">
              {ICONS[step.type]} {step.label}
            </span>
            {step.detail && (
              <span className="mt-0.5 block break-words font-mono text-[10px] text-gray-400">
                {step.detail}
              </span>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
