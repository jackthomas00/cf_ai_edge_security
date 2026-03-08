const SESSION_STORAGE_KEY = "edge-security-session-id";

let API_BASE = null;

async function getApiBase() {
  if (API_BASE) return API_BASE;
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const data = await res.json();
      if (data.API_BASE) {
        API_BASE = data.API_BASE;
        return API_BASE;
      }
    }
  } catch (_) {}
  API_BASE = (typeof window !== "undefined" && window.EDGE_SECURITY_API_BASE) || window.location.origin;
  return API_BASE;
}

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

function getErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function handleAnalyze() {
  await getApiBase();
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
  await getApiBase();
  setSessionId(null);
  renderConversation([]);
  try {
    await ensureSession();
  } catch (error) {
    appendMessage("assistant", `Couldn't start a new session right now. ${getErrorMessage(error, "Please try again.")}`);
  }
}

async function init() {
  await getApiBase();
  try {
    const rehydrated = await rehydrateSession();
    if (rehydrated) return;

    await ensureSession();
  } catch (error) {
    setSessionId(null);
    renderConversation([]);
    try {
      await ensureSession();
      appendMessage("assistant", "Your previous session could not be restored, so a new session was started.");
    } catch (createError) {
      appendMessage(
        "assistant",
        `Couldn't restore your session or start a new one. ${getErrorMessage(createError, getErrorMessage(error, "Please refresh and try again."))}`
      );
    }
  }
}

document.getElementById("send-btn").addEventListener("click", handleAnalyze);
document.getElementById("new-session-btn").addEventListener("click", handleNewSession);
init();
