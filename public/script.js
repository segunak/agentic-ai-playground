/* ===================================================================
   Agent Playground - Client Logic
   Streaming via Vercel AI SDK data protocol
   Persistent reasoning panel across conversation turns
   =================================================================== */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let workshopKey = "";
let conversationHistory = [];
let enabledTools = [];
let isLoading = false;
let turnCount = 0;

const API_BASE = getApiBase();

function getApiBase() {
  if (
    window.location.hostname === "agentic-ai-playground.vercel.app" ||
    window.location.hostname === "localhost"
  ) {
    return "";
  }
  return "https://agentic-ai-playground.vercel.app";
}

// ---------------------------------------------------------------------------
// URL Parameter Configuration
// ---------------------------------------------------------------------------

function applyUrlConfig() {
  const params = new URLSearchParams(window.location.search);

  const keyParam = params.get("key");
  if (keyParam) {
    workshopKey = keyParam;
    document.getElementById("key-modal").style.display = "none";
    document.getElementById("app").style.display = "block";
  }

  const toolsParam = params.get("tools");
  if (toolsParam) {
    const toolCheckboxes = document.querySelectorAll("[data-tool]");

    if (toolsParam === "none") {
      toolCheckboxes.forEach((cb) => {
        cb.checked = false;
        const card = document.getElementById("tool-card-" + cb.dataset.tool);
        if (card) card.style.display = "none";
      });
    } else if (toolsParam === "all") {
      toolCheckboxes.forEach((cb) => {
        cb.checked = true;
        const card = document.getElementById("tool-card-" + cb.dataset.tool);
        if (card) card.style.display = "";
      });
    } else {
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
  document.getElementById("chat-input").focus();
}

function showKeyError(msg) {
  const el = document.getElementById("key-error");
  el.textContent = msg;
  el.style.display = "block";
}

document.addEventListener("DOMContentLoaded", () => {
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
// Chat - Streaming
// ---------------------------------------------------------------------------

async function sendMessage() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();

  if (!text || isLoading) return;

  appendMessage("user", text);
  input.value = "";

  conversationHistory.push({ role: "user", content: text });

  setLoading(true);

  // Add turn divider to reasoning panel
  turnCount++;
  if (turnCount > 1) {
    addReasoningDivider();
  }
  addReasoningStep("thinking", "Thinking", "Processing your message...");

  // Create a placeholder for the streaming assistant response
  const assistantBubble = createAssistantBubble();
  let fullResponse = "";

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
      updateAssistantBubble(assistantBubble, "Invalid workshop key. Please refresh and try again.");
      setLoading(false);
      return;
    }

    if (response.status === 403) {
      updateAssistantBubble(assistantBubble, "Workshop is not currently active.");
      setLoading(false);
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Parse AI SDK data stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines from the AI SDK data protocol
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        processStreamLine(line, assistantBubble, (chunk) => {
          fullResponse += chunk;
          updateAssistantBubble(assistantBubble, fullResponse);
        });
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      processStreamLine(buffer, assistantBubble, (chunk) => {
        fullResponse += chunk;
        updateAssistantBubble(assistantBubble, fullResponse);
      });
    }

    if (!fullResponse) {
      fullResponse = "I'm not sure how to respond to that. Could you try rephrasing?";
      updateAssistantBubble(assistantBubble, fullResponse);
    }

    conversationHistory.push({ role: "assistant", content: fullResponse });
    addReasoningStep("response", "Response complete", "");

  } catch (error) {
    console.error("Chat error:", error);
    updateAssistantBubble(assistantBubble, `Something went wrong: ${error.message}. Please try again.`);
    addReasoningStep("response", "Error", error.message);
  }

  setLoading(false);
}

// ---------------------------------------------------------------------------
// AI SDK Data Protocol Parser
// ---------------------------------------------------------------------------

function processStreamLine(line, bubble, onTextChunk) {
  // AI SDK data protocol format:
  // 0:string - text delta
  // 9:{...} - tool call begin
  // a:{...} - tool call delta
  // b:{...} - tool result
  // e:{...} - finish step
  // d:{...} - finish message

  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return;

  const type = line.substring(0, colonIndex);
  const payload = line.substring(colonIndex + 1);

  try {
    switch (type) {
      case "0": {
        // Text delta - payload is a JSON string
        const text = JSON.parse(payload);
        onTextChunk(text);
        break;
      }
      case "9": {
        // Tool call begin
        const data = JSON.parse(payload);
        addReasoningStep("tool-call", `Calling: ${data.toolName}`, "");
        highlightTool(data.toolName);
        break;
      }
      case "a": {
        // Tool call delta (args streaming) - ignore for UI
        break;
      }
      case "b": {
        // Tool result
        const data = JSON.parse(payload);
        const preview = JSON.stringify(data.result, null, 1);
        addReasoningStep(
          "tool-result",
          `Result from ${data.toolName}`,
          preview.length > 200 ? preview.slice(0, 200) + "..." : preview
        );
        addReasoningStep("thinking", "Thinking", "Analyzing tool results...");
        break;
      }
      case "e": {
        // Finish step - multi-step boundary
        break;
      }
      case "d": {
        // Finish message
        break;
      }
    }
  } catch {
    // Ignore parse errors on partial data
  }
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
  avatar.textContent = role === "user" ? "You" : "\u{1F916}";

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  contentDiv.innerHTML = formatContent(content);

  div.appendChild(avatar);
  div.appendChild(contentDiv);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function createAssistantBubble() {
  const container = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = "message assistant";

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = "\u{1F916}";

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  contentDiv.innerHTML = '<span class="loading-dots">Thinking</span>';

  div.appendChild(avatar);
  div.appendChild(contentDiv);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  return contentDiv;
}

function updateAssistantBubble(bubble, content) {
  bubble.innerHTML = formatContent(content);
  const container = document.getElementById("chat-messages");
  container.scrollTop = container.scrollHeight;
}

function formatContent(text) {
  return text
    .split("\n")
    .map((line) => {
      line = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      line = line.replace(
        /`(.*?)`/g,
        '<code style="background:var(--bg-tertiary);padding:1px 4px;border-radius:3px;font-size:0.85em;">$1</code>'
      );
      if (line.startsWith("- ") || line.startsWith("\u2022 ")) {
        return `<div style="padding-left:12px;">\u2022 ${line.slice(2)}</div>`;
      }
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
// Reasoning Panel - Persistent across turns
// ---------------------------------------------------------------------------

function addReasoningDivider() {
  const panel = document.getElementById("reasoning-panel");
  const empty = panel.querySelector(".reasoning-empty");
  if (empty) empty.remove();

  const divider = document.createElement("hr");
  divider.className = "reasoning-divider";
  panel.appendChild(divider);
  panel.scrollTop = panel.scrollHeight;
}

function addReasoningStep(type, label, detail) {
  const panel = document.getElementById("reasoning-panel");
  const empty = panel.querySelector(".reasoning-empty");
  if (empty) empty.remove();

  const step = document.createElement("div");
  step.className = `reasoning-step ${type}`;

  const icons = {
    "thinking": "\u{1F914}",
    "tool-call": "\u{1F527}",
    "tool-result": "\u{1F4CB}",
    "response": "\u{1F4AC}",
  };

  step.innerHTML = `
    <span class="step-label">${icons[type] || ""} ${label}</span>
    ${detail ? `<span class="step-detail">${detail}</span>` : ""}
  `;

  panel.appendChild(step);
  panel.scrollTop = panel.scrollHeight;
}

function highlightTool(toolName) {
  document.querySelectorAll(".tool-card").forEach((card) => {
    card.classList.remove("highlighted");
  });

  const card = document.getElementById("tool-card-" + toolName);
  if (card) {
    card.classList.add("highlighted");
    setTimeout(() => card.classList.remove("highlighted"), 3000);
  }
}
