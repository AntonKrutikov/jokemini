const STORAGE_KEY = "gemini-vault.dialogs";
const CURRENT_KEY = "gemini-vault.current";

let dialogs = load();
let currentId = localStorage.getItem(CURRENT_KEY);

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dialogs));
  if (currentId) localStorage.setItem(CURRENT_KEY, currentId);
}

export function createDialog() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "New dialog",
    messages: [],
    createdAt: Date.now(),
  };
}

export function getDialogs() {
  return dialogs;
}

export function getCurrentId() {
  return currentId;
}

export function getCurrentDialog() {
  return dialogs.find((d) => d.id === currentId);
}

export function setCurrentId(id) {
  currentId = id;
  persist();
}

export function deriveTitle(text) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 40 ? t.slice(0, 40) + "…" : t;
}

export function ensureInitialDialog() {
  if (!dialogs.length) {
    const d = createDialog();
    dialogs.push(d);
    currentId = d.id;
    persist();
  } else if (!currentId || !dialogs.find((d) => d.id === currentId)) {
    currentId = dialogs[0].id;
    localStorage.setItem(CURRENT_KEY, currentId);
  }
}

export function addDialogToFront(d) {
  dialogs.unshift(d);
  currentId = d.id;
  persist();
}

export function removeDialog(id) {
  const idx = dialogs.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  dialogs.splice(idx, 1);
  if (currentId === id) {
    if (!dialogs.length) {
      const d = createDialog();
      dialogs.push(d);
      currentId = d.id;
    } else {
      currentId = dialogs[Math.max(0, idx - 1)].id;
    }
  }
  persist();
  return true;
}
