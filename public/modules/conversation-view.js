import {
  getDialogs,
  getCurrentId,
  getCurrentDialog,
  setCurrentId,
  createDialog,
  addDialogToFront,
  removeDialog,
} from "./dialogs-store.js";
import { isMobile, closeSidebar } from "./sidebar.js";
import { openStatsPopover, closePopover as closeStatsPopover } from "./message-stats-popover.js";

const conversation = document.getElementById("conversation");
const dialogList = document.getElementById("dialog-list");
const newDialogBtn = document.getElementById("new-dialog");
const messageInput = document.getElementById("message");

export function scrollToBottom() {
  requestAnimationFrame(() => {
    conversation.scrollTop = conversation.scrollHeight;
  });
}

export function appendMessage(role, text) {
  const msg = document.createElement("div");
  msg.className = `msg ${role}`;
  msg.textContent = text;
  conversation.appendChild(msg);
  scrollToBottom();
  return msg;
}

export function attachStats(msg, stats) {
  if (!stats) return;
  const existing = msg.querySelector(":scope > .stats-toggle");
  if (existing) existing.remove();
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "stats-toggle";
  btn.setAttribute("aria-label", "Show response stats");
  btn.setAttribute("aria-expanded", "false");
  btn.title = "Response stats";
  btn.textContent = "i";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    openStatsPopover(btn, stats);
  });
  msg.appendChild(btn);
  msg.classList.add("has-stats");
}

export function clearEmptyState() {
  if (conversation.classList.contains("empty")) {
    conversation.classList.remove("empty");
    conversation.innerHTML = "";
  }
}

export function renderSidebar() {
  dialogList.innerHTML = "";
  const currentId = getCurrentId();
  for (const d of getDialogs()) {
    const li = document.createElement("li");
    li.className = "dialog-item" + (d.id === currentId ? " active" : "");
    li.dataset.id = d.id;

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = d.title || "Untitled";
    li.appendChild(title);

    const del = document.createElement("button");
    del.className = "delete";
    del.type = "button";
    del.title = "Delete dialog";
    del.textContent = "×";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      handleDelete(d.id);
    });
    li.appendChild(del);

    li.addEventListener("click", () => selectDialog(d.id));
    dialogList.appendChild(li);
  }
}

export function renderConversation() {
  const d = getCurrentDialog();
  conversation.innerHTML = "";
  if (!d || !d.messages.length) {
    conversation.classList.add("empty");
    const empty = document.createElement("div");
    empty.id = "empty-state";
    empty.innerHTML =
      '<h1>Jokemini</h1>' +
      '<p class="tagline">Your inquiry is sent to a secure backend that injects a private system prompt before calling Gemini.</p>' +
      '<p class="hint">Ask something to get started…</p>';
    conversation.appendChild(empty);
    return;
  }
  conversation.classList.remove("empty");
  for (const m of d.messages) {
    const el = appendMessage(m.role === "model" ? "assistant" : m.role, m.text);
    if (m.role === "model" && m.stats) attachStats(el, m.stats);
  }
}

function selectDialog(id) {
  if (id === getCurrentId()) {
    if (isMobile()) closeSidebar();
    return;
  }
  setCurrentId(id);
  renderSidebar();
  renderConversation();
  closeStatsPopover();
  if (isMobile()) closeSidebar();
  else messageInput.focus();
}

function handleDelete(id) {
  const target = getDialogs().find((d) => d.id === id);
  if (!target) return;
  const title = target.title || "Untitled";
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
  removeDialog(id);
  renderSidebar();
  renderConversation();
  closeStatsPopover();
}

export function initDialogControls() {
  newDialogBtn.addEventListener("click", () => {
    const d = createDialog();
    addDialogToFront(d);
    renderSidebar();
    renderConversation();
    closeStatsPopover();
    if (isMobile()) closeSidebar();
  });
}
