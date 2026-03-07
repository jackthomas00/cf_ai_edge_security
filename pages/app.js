const API_BASE = ""; // Relative when served with Worker; override for local dev
const SESSION_STORAGE_KEY = "edge-security-session-id";

let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);

function setSessionId(nextSessionId) {
  sessionId = nextSessionId;
  if (sessionId) {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
  document.getElementById("session-id").textContent = sessionId?.slice(0, 8) + "…" ?? "—";
}

function renderConversation(messages) {
  const pane = document.getElementById("conversation");
  pane.innerHTML = "";
  for (const message of messages) {
    if (message.role === "user" || message.role === "assistant") {
      appendMessage(message.role, message.content);
    }
  }
}

async function rehydrateSession() {
  if (!sessionId) return false;

  const res = await fetch(`${API_BASE}/api/session/${sessionId}`);
  if (!res.ok) {
    setSessionId(null);
    renderConversation([]);
    return false;
  }

  const data = await res.json();
  setSessionId(sessionId);
  renderConversation(Array.isArray(data.messages) ? data.messages : []);
  return true;
}

async function ensureSession() {
  if (sessionId) return sessionId;
  const res = await fetch(`${API_BASE}/api/session`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to create session");
  const data = await res.json();
  setSessionId(data.sessionId);
  return sessionId;
}

async function sendMessage(message) {
  await ensureSession();
  const res = await fetch(`${API_BASE}/api/chat?sessionId=${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }
  const data = await res.json();
  return data.message;
}

function appendMessage(role, content) {
  const pane = document.getElementById("conversation");
  const div = document.createElement("div");
  div.className = `message message-${role}`;
  div.innerHTML = `<strong>${role === "user" ? "You" : "Copilot"}</strong><pre>${escapeHtml(content)}</pre>`;
  pane.appendChild(div);
  pane.scrollTop = pane.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function handleAnalyze() {
  const input = document.getElementById("log-input");
  const text = input.value.trim();
  if (!text) return;

  appendMessage("user", text);
  input.value = "";

  const btn = document.getElementById("send-btn");
  btn.disabled = true;

  try {
    const response = await sendMessage(text);
    appendMessage("assistant", response);
  } catch (e) {
    appendMessage("assistant", `Error: ${e.message}`);
  } finally {
    btn.disabled = false;
  }
}

async function handleNewSession() {
  setSessionId(null);
  renderConversation([]);
  await ensureSession();
}

async function init() {
  await rehydrateSession().catch(() => {
    setSessionId(null);
    renderConversation([]);
  });
}

document.getElementById("send-btn").addEventListener("click", handleAnalyze);
document.getElementById("new-session-btn").addEventListener("click", handleNewSession);
init();
