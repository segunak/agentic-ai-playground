"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState, useCallback } from "react";
import { AVAILABLE_TOOLS } from "@/lib/tools";
import ToolCard from "@/components/ToolCard";
import ReasoningPanel, { type ReasoningStep } from "@/components/ReasoningPanel";
import WorkshopKeyModal from "@/components/WorkshopKeyModal";

export default function ChatPlayground() {
  const [workshopKey, setWorkshopKey] = useState<string | null>(null);
  const [enabledTools, setEnabledTools] = useState<Set<string>>(new Set());
  const [highlightedTool, setHighlightedTool] = useState<string | null>(null);
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[]>([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check localStorage for saved key on mount
  useEffect(() => {
    const saved = localStorage.getItem("wk");
    if (saved) setWorkshopKey(saved);
  }, []);

  // Check URL params for tool configuration
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const toolsParam = params.get("tools");
    if (toolsParam === "none") {
      setEnabledTools(new Set());
    } else if (toolsParam === "all") {
      setEnabledTools(new Set(AVAILABLE_TOOLS.map((t) => t.id)));
    } else if (toolsParam) {
      setEnabledTools(new Set(toolsParam.split(",").map((t) => t.trim())));
    }
    const keyParam = params.get("key");
    if (keyParam) {
      setWorkshopKey(keyParam);
      try { localStorage.setItem("wk", keyParam); } catch { /* noop */ }
    }
  }, []);

  const addReasoning = useCallback((step: ReasoningStep) => {
    setReasoningSteps((prev) => [...prev, step]);
  }, []);

  // Use refs so transport functions always read current values
  const workshopKeyRef = useRef(workshopKey);
  const enabledToolsRef = useRef(enabledTools);
  useEffect(() => { workshopKeyRef.current = workshopKey; }, [workshopKey]);
  useEffect(() => { enabledToolsRef.current = enabledTools; }, [enabledTools]);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: () => ({
        "X-Workshop-Key": workshopKeyRef.current || "",
      }),
      body: () => ({
        enabledTools: Array.from(enabledToolsRef.current),
        workshopKey: workshopKeyRef.current || "",
      }),
    }),
    onToolCall: ({ toolCall }) => {
      if (toolCall.dynamic) return;
      addReasoning({
        type: "tool-call",
        label: `Calling: ${toolCall.toolName}`,
        detail: "",
      });
      setHighlightedTool(toolCall.toolName);
      setTimeout(() => setHighlightedTool(null), 3000);
    },
    onError: (err: Error) => {
      addReasoning({ type: "response", label: "Error", detail: err.message });
    },
  });

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Derive reasoning steps from message parts (tool calls and results)
  // This is data-driven, not event-driven, so it's always accurate
  const derivedReasoningSteps: ReasoningStep[] = [];
  let turnIdx = 0;
  for (const m of messages) {
    if (m.role === "user") {
      turnIdx++;
      if (turnIdx > 1) derivedReasoningSteps.push({ type: "divider" });
      derivedReasoningSteps.push({ type: "thinking", label: "Thinking", detail: "Processing message..." });
    }
    if (m.role === "assistant") {
      for (const part of m.parts) {
        if (part.type === "step-start") {
          // Multi-step boundary
        } else if (part.type.startsWith("tool-")) {
          const toolPart = part as { type: string; toolName: string; state: string; input?: unknown; output?: unknown };
          if (toolPart.state === "input-available" || toolPart.state === "input-streaming") {
            derivedReasoningSteps.push({
              type: "tool-call",
              label: `Calling: ${toolPart.toolName}`,
              detail: toolPart.input ? JSON.stringify(toolPart.input) : "",
            });
          }
          if (toolPart.state === "output-available") {
            const preview = JSON.stringify(toolPart.output, null, 1);
            derivedReasoningSteps.push({
              type: "tool-result",
              label: `Result from ${toolPart.toolName}`,
              detail: preview.length > 200 ? preview.slice(0, 200) + "..." : preview,
            });
            derivedReasoningSteps.push({ type: "thinking", label: "Thinking", detail: "Analyzing tool results..." });
          }
        } else if (part.type === "text" && part.text) {
          // Only add "Response complete" once at the end if we had tool calls
          // (detected by checking if there are any tool steps before this)
        }
      }
    }
  }
  // If we're streaming and last message is assistant, show "streaming" indicator
  if (status === "streaming") {
    derivedReasoningSteps.push({ type: "thinking", label: "Generating response...", detail: "" });
  }
  // If last assistant message is complete and had content, mark response done
  if (status === "ready" && messages.length > 0 && messages[messages.length - 1]?.role === "assistant") {
    derivedReasoningSteps.push({ type: "response", label: "Response complete" });
  }

  const toggleTool = (id: string) => {
    setEnabledTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Determine which tools to show based on URL params
  const [visibleTools, setVisibleTools] = useState(AVAILABLE_TOOLS);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTools = params.get("tools");
    if (urlTools === "none") {
      setVisibleTools([]);
    } else if (urlTools) {
      const allowed = urlTools === "all"
        ? AVAILABLE_TOOLS
        : AVAILABLE_TOOLS.filter((t) =>
            urlTools.split(",").map((s) => s.trim()).includes(t.id)
          );
      setVisibleTools(allowed);
    }
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || status !== "ready") return;
    sendMessage({ text: inputValue });
    setInputValue("");
  };

  if (workshopKey === null) {
    return <WorkshopKeyModal onSubmit={setWorkshopKey} />;
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900/80 px-5 py-3 backdrop-blur-sm">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            <span className="mr-2">{"\u{1F916}"}</span>Agent Playground
          </h1>
          <p className="text-xs text-gray-500">
            Agentic AI: From Acronyms to Applications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gray-800 px-3 py-1 text-[11px] font-medium text-gray-400 ring-1 ring-gray-700">
            Microsoft Foundry
          </span>
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
              status !== "ready"
                ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30"
                : "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30"
            }`}
          >
            {status !== "ready" ? "Thinking..." : "Ready"}
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 overflow-hidden">
        {/* Chat Panel */}
        <section className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Welcome message */}
            {messages.length === 0 && (
              <div className="animate-fade-slide-in mb-4 flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm">
                  {"\u{1F916}"}
                </div>
                <div className="rounded-xl rounded-tl-sm border border-gray-800 bg-gray-900 px-4 py-3 text-sm leading-relaxed text-gray-300">
                  <p>
                    Hi! I&apos;m a <strong className="text-gray-100">Data Assistant</strong>.
                    {enabledTools.size === 0
                      ? " I have no tools right now, so I can only answer from my training data."
                      : ` I have ${enabledTools.size} tool${enabledTools.size === 1 ? "" : "s"} available to help answer your questions.`}
                  </p>
                  <p className="mt-2 text-gray-400">
                    {enabledTools.size === 0
                      ? "Try asking: \"What's the weather in Charlotte right now?\" or \"Who won the last Super Bowl?\""
                      : "Try asking something and watch the Agent Reasoning panel on the right!"}
                  </p>
                </div>
              </div>
            )}

            {/* Chat messages */}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`animate-fade-slide-in mb-4 flex gap-3 ${
                  m.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    m.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-sm"
                  }`}
                >
                  {m.role === "user" ? "You" : "\u{1F916}"}
                </div>
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-tr-sm bg-blue-600 text-white"
                      : "rounded-tl-sm border border-gray-800 bg-gray-900 text-gray-300"
                  }`}
                >
                  {m.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <div
                          key={i}
                          className="prose prose-sm prose-invert max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: part.text
                              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                              .replace(/\n/g, "<br/>"),
                          }}
                        />
                      );
                    }
                    if (part.type === "step-start") {
                      return i > 0 ? (
                        <hr key={i} className="my-2 border-gray-700" />
                      ) : null;
                    }
                    // Tool invocation parts (typed as tool-<name>)
                    if (part.type.startsWith("tool-")) {
                      const toolPart = part as { type: string; toolCallId: string; toolName: string; state: string; input?: unknown; output?: unknown };
                      if (toolPart.state === "output-available") {
                        return (
                          <div
                            key={i}
                            className="my-2 rounded-md border border-gray-700 bg-gray-800/50 px-3 py-2 font-mono text-[11px] text-amber-300"
                          >
                            {"\u{1F527}"} Used tool: {toolPart.toolName}
                          </div>
                        );
                      }
                      if (toolPart.state === "input-available" || toolPart.state === "input-streaming") {
                        return (
                          <div key={i} className="my-1 text-[11px] italic text-gray-500">
                            Calling {toolPart.toolName}...
                          </div>
                        );
                      }
                      return null;
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {status !== "ready" && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
              <div className="animate-fade-slide-in mb-4 flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm">
                  {"\u{1F916}"}
                </div>
                <div className="rounded-xl rounded-tl-sm border border-gray-800 bg-gray-900 px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            className="flex gap-2 border-t border-gray-800 bg-gray-900/80 px-5 py-3 backdrop-blur-sm"
          >
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask the agent something..."
              disabled={status !== "ready"}
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={status !== "ready" || !inputValue.trim()}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status !== "ready" ? "..." : "Send"}
            </button>
          </form>
        </section>

        {/* Sidebar */}
        <aside className="flex w-[320px] shrink-0 flex-col border-l border-gray-800 bg-gray-900/50">
          <div className="border-b border-gray-800 p-4">
            <h3 className="mb-1 text-sm font-semibold">
              {"\u{1F6E0}\u{FE0F}"} Available Tools
            </h3>
            <p className="mb-3 text-[11px] text-gray-500">
              The agent <strong className="text-gray-400">decides</strong> when to use tools.
            </p>
            {visibleTools.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-700 bg-gray-800/30 p-3 text-center text-xs text-gray-500">
                No tools enabled.<br />This AI has no agency.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {visibleTools.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    enabled={enabledTools.has(tool.id)}
                    highlighted={highlightedTool === tool.id}
                    onToggle={toggleTool}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col p-4">
            <h3 className="mb-1 text-sm font-semibold">
              {"\u{1F9E0}"} Agent Reasoning
            </h3>
            <p className="mb-3 text-[11px] text-gray-500">
              Watch the decision-making process.
            </p>
            <ReasoningPanel steps={reasoningSteps} />
          </div>
        </aside>
      </main>

      {error && (
        <div className="border-t border-red-900/50 bg-red-950/30 px-5 py-2 text-xs text-red-400">
          Error: {error.message}
        </div>
      )}
    </div>
  );
}
