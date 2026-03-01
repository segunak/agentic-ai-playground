/* ===================================================================
   Agent Playground  - Client Logic
   Chat, tool toggles, reasoning panel, URL param configuration
   =================================================================== */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let workshopKey = "";
let conversationHistory = []; // Messages sent to the API
let enabledTools = [];        // Currently enabled tool names
let isLoading = false;

// API base  - when embedded in VS Code for Education, use the Vercel URL
const API_BASE = getApiBase();

function getApiBase() {
  // If running on the Vercel deployment, use relative paths
  if (
    window.location.hostname === "agentic-ai-playground.vercel.app" ||
    window.location.hostname === "localhost"
  ) {
    return "";
  }
  // If embedded elsewhere (VS Code for Education), use the full Vercel URL
  return "https://agentic-ai-playground.vercel.app";
}

// ---------------------------------------------------------------------------
// URL Parameter Configuration
// ---------------------------------------------------------------------------
// ?tools=none                              - All tools hidden/off
// ?tools=all                               - All tools shown and on
// ?tools=get_current_date                  - Only that tool shown and on
// ?tools=get_current_date,get_random_fact  - Comma-separated list
// ?key=<workshopkey>                       - Auto-fill workshop key

function applyUrlConfig() {
  const params = new URLSearchParams(window.location.search);

  // Auto-fill key if provided (for VS Code for Education embedding)
  const keyParam = params.get("key");
  if (keyParam) {
    workshopKey = keyParam;
    document.getElementById("key-modal").style.display = "none";
    document.getElementById("app").style.display = "block";
  }

  // Tool configuration
  const toolsParam = params.get("tools");
  if (toolsParam) {
    const toolCheckboxes = document.querySelectorAll("[data-tool]");

    if (toolsParam === "none") {
      // Hide all tool cards
      toolCheckboxes.forEach((cb) => {
        cb.checked = false;
        const card = document.getElementById("tool-card-" + cb.dataset.tool);
        if (card) card.style.display = "none";
      });
    } else if (toolsParam === "all") {
      // Show and enable all tools
      toolCheckboxes.forEach((cb) => {
        cb.checked = true;
        const card = document.getElementById("tool-card-" + cb.dataset.tool);
        if (card) card.style.display = "";
      });
    } else {
      // Comma-separated list of specific tool names to enable
      const enabledSet = new Set(toolsParam.split(",").map((t) => t.trim()));
      toolCheckboxes.forEach((cb) => {
        const card = document.getElementById("tool-card-" + cb.dataset.tool);
        if (enabledSet.has(cb.dataset.tool)) {
          cb.checked = true;
          if (card) card.style.display = "";
        } else {
          cb.checked = false;
          if (card) card.style.display = "none";
        }
      });
    }

    updateTools();
  }
}

// ---------------------------------------------------------------------------
// Workshop Key
// ---------------------------------------------------------------------------

function submitKey() {
  const input = document.getElementById("key-input");
  const key = input.value.trim();

  if (!key) {
    showKeyError("Please enter a workshop key.");
    return;
  }

  workshopKey = key;
  try { localStorage.setItem("wk", key); } catch (e) {}
  document.getElementById("key-modal").style.display = "none";
  document.getElementById("app").style.display = "block";

  // Focus the chat input
  document.getElementById("chat-input").focus();
}

function showKeyError(msg) {
  const el = document.getElementById("key-error");
  el.textContent = msg;
  el.style.display = "block";
}

// Allow Enter key on key input
document.addEventListener("DOMContentLoaded", () => {
  // Check localStorage for a saved workshop key
  const savedKey = localStorage.getItem("wk");
  if (savedKey) {
    workshopKey = savedKey;
    document.getElementById("key-modal").style.display = "none";
    document.getElementById("app").style.display = "block";
  }

  document.getElementById("key-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitKey();
  });

  applyUrlConfig();
});

// ---------------------------------------------------------------------------
// Tool Toggles
// ---------------------------------------------------------------------------

function updateTools() {
  enabledTools = [];
  document.querySelectorAll("[data-tool]").forEach((cb) => {
    const card = document.getElementById("tool-card-" + cb.dataset.tool);
    if (cb.checked) {
      enabledTools.push(cb.dataset.tool);
      if (card) card.classList.add("active");
    } else {
      if (card) card.classList.remove("active");
    }
  });
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

async function sendMessage() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();

  if (!text || isLoading) return;

  // Add user message to UI
  appendMessage("user", text);
  input.value = "";

  // Add to conversation history
  conversationHistory.push({ role: "user", content: text });

  // Set loading state
  setLoading(true);
  clearReasoning();
  addReasoningStep("thinking", "🤔 Thinking", "Processing your message...");

  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Workshop-Key": workshopKey,
      },
      body: JSON.stringify({
        messages: conversationHistory,
        enabledTools: enabledTools,
        workshopKey: workshopKey,
      }),
    });

    if (response.status === 401) {
      appendMessage(
        "assistant",
        "⚠️ Invalid workshop key. Please refresh the page and try again with the correct key."
      );
      setLoading(false);
      return;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const data = await response.json();

    // Render reasoning steps
    clearReasoning();
    renderReasoningSteps(data.reasoning || []);

    // Highlight tools that were called
    highlightCalledTools(data.reasoning || []);

    // Add assistant response to UI and history
    appendMessage("assistant", data.response);
    conversationHistory.push({ role: "assistant", content: data.response });
  } catch (error) {
    console.error("Chat error:", error);
    appendMessage(
      "assistant",
      `⚠️ Something went wrong: ${error.message}. Please try again.`
    );
    addReasoningStep("response", "❌ Error", error.message);
  }

  setLoading(false);
}

// ---------------------------------------------------------------------------
// UI Helpers
// ---------------------------------------------------------------------------

function appendMessage(role, content) {
  const container = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "You" : "🤖";

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  contentDiv.innerHTML = formatContent(content);

  div.appendChild(avatar);
  div.appendChild(contentDiv);
  container.appendChild(div);

  // Auto-scroll
  container.scrollTop = container.scrollHeight;
}

function formatContent(text) {
  // Basic markdown-ish formatting
  return text
    .split("\n")
    .map((line) => {
      // Bold
      line = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      // Inline code
      line = line.replace(/`(.*?)`/g, '<code style="background:var(--bg-tertiary);padding:1px 4px;border-radius:3px;font-size:0.85em;">$1</code>');
      // Bullet points
      if (line.startsWith("- ") || line.startsWith("• ")) {
        return `<div style="padding-left:12px;">• ${line.slice(2)}</div>`;
      }
      // Numbered lists
      const numMatch = line.match(/^(\d+)\.\s(.*)/);
      if (numMatch) {
        return `<div style="padding-left:12px;">${numMatch[1]}. ${numMatch[2]}</div>`;
      }
      return line;
    })
    .join("<br/>");
}

function setLoading(loading) {
  isLoading = loading;
  const btn = document.getElementById("send-btn");
  const input = document.getElementById("chat-input");
  const badge = document.getElementById("status-badge");

  btn.disabled = loading;
  input.disabled = loading;
  btn.textContent = loading ? "..." : "Send";

  badge.textContent = loading ? "Thinking..." : "Ready";
  badge.className = loading ? "status-badge loading" : "status-badge";
}

// ---------------------------------------------------------------------------
// Reasoning Panel
// ---------------------------------------------------------------------------

function clearReasoning() {
  const panel = document.getElementById("reasoning-panel");
  panel.innerHTML = "";
}

function addReasoningStep(type, label, detail) {
  const panel = document.getElementById("reasoning-panel");

  // Remove the empty state message if present
  const empty = panel.querySelector(".reasoning-empty");
  if (empty) empty.remove();

  const step = document.createElement("div");
  step.className = `reasoning-step ${type}`;

  step.innerHTML = `
    <span class="step-label">${label}</span>
    ${detail ? `<span class="step-detail">${detail}</span>` : ""}
  `;

  panel.appendChild(step);
  panel.scrollTop = panel.scrollHeight;
}

function renderReasoningSteps(steps) {
  for (const step of steps) {
    switch (step.type) {
      case "thinking":
        addReasoningStep("thinking", "🤔 Thinking", step.content);
        break;

      case "tool_call": {
        const argsStr = step.args && Object.keys(step.args).length > 0
          ? `(${JSON.stringify(step.args)})`
          : "()";
        addReasoningStep("tool-call", `🔧 Calling tool: ${step.tool}`, argsStr);
        break;
      }

      case "tool_result": {
        let preview = "";
        if (step.result) {
          const resultStr = JSON.stringify(step.result, null, 1);
          preview = resultStr.length > 200
            ? resultStr.slice(0, 200) + "..."
            : resultStr;
        }
        addReasoningStep("tool-result", `📋 Result from ${step.tool}`, preview);
        break;
      }

      case "response":
        addReasoningStep(
          "response",
          "💬 Final Response",
          step.content.length > 100
            ? step.content.slice(0, 100) + "..."
            : step.content
        );
        break;
    }
  }
}

function highlightCalledTools(steps) {
  // Reset all highlights
  document.querySelectorAll(".tool-card").forEach((card) => {
    card.classList.remove("highlighted");
  });

  // Highlight tools that were called
  const called = new Set(
    steps.filter((s) => s.type === "tool_call").map((s) => s.tool)
  );

  for (const toolName of called) {
    const card = document.getElementById("tool-card-" + toolName);
    if (card) {
      card.classList.add("highlighted");
      // Remove highlight after 3 seconds
      setTimeout(() => card.classList.remove("highlighted"), 3000);
    }
  }
}
