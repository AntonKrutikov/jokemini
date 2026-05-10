const GUARD_KEY = "gemini-vault.debug.guardPrompt";
const CLASSIFIER_KEY = "gemini-vault.debug.classifier";

const guardInput = document.getElementById("flag-guard");
const classifierInput = document.getElementById("flag-classifier");

const state = {
  guardPrompt: load(GUARD_KEY, true),
  classifier: load(CLASSIFIER_KEY, false),
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {}
  return fallback;
}

function save(key, value) {
  try { localStorage.setItem(key, String(value)); } catch {}
}

export function initDebugFlags() {
  guardInput.checked = state.guardPrompt;
  classifierInput.checked = state.classifier;

  guardInput.addEventListener("change", () => {
    state.guardPrompt = guardInput.checked;
    save(GUARD_KEY, state.guardPrompt);
  });
  classifierInput.addEventListener("change", () => {
    state.classifier = classifierInput.checked;
    save(CLASSIFIER_KEY, state.classifier);
  });
}

export function getDebugFlags() {
  return { guardPrompt: state.guardPrompt, classifier: state.classifier };
}
