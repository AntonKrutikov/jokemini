let popover = null;
let currentTrigger = null;

function ensurePopover() {
  if (popover) return popover;
  popover = document.createElement("div");
  popover.className = "stats-popover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-label", "Response stats");
  popover.hidden = true;
  document.body.appendChild(popover);

  document.addEventListener("click", (e) => {
    if (popover.hidden) return;
    if (popover.contains(e.target)) return;
    if (currentTrigger && currentTrigger.contains(e.target)) return;
    closePopover();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !popover.hidden) closePopover();
  });

  window.addEventListener("resize", () => {
    if (!popover.hidden && currentTrigger) positionPopover(currentTrigger);
  });

  return popover;
}

function formatTime(ms) {
  if (ms == null) return null;
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatBool(v) {
  return v ? "On" : "Off";
}

function renderBody(stats) {
  const usage = stats.usage || {};
  const rows = [];
  if (stats.totalMs != null) rows.push(["Total time", formatTime(stats.totalMs)]);
  if (stats.guardEnabled != null) rows.push(["Guard prompt", formatBool(stats.guardEnabled)]);
  if (stats.classifierEnabled != null) rows.push(["Classifier", formatBool(stats.classifierEnabled)]);
  if (stats.classifierRan) {
    rows.push(["Classifier time", stats.classifierMs != null ? formatTime(stats.classifierMs) : "—"]);
  }
  if (usage.promptTokenCount != null) rows.push(["Prompt tokens", usage.promptTokenCount]);
  if (usage.cachedContentTokenCount != null) rows.push(["Cached tokens", usage.cachedContentTokenCount]);
  if (usage.candidatesTokenCount != null) rows.push(["Output tokens", usage.candidatesTokenCount]);
  if (usage.thoughtsTokenCount != null) rows.push(["Thinking tokens", usage.thoughtsTokenCount]);
  if (usage.totalTokenCount != null) rows.push(["Total tokens", usage.totalTokenCount]);

  const wrap = document.createElement("div");
  const heading = document.createElement("h2");
  heading.textContent = "Response stats";
  wrap.appendChild(heading);

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "stats-empty";
    empty.textContent = "No stats available for this response.";
    wrap.appendChild(empty);
    return wrap;
  }

  const table = document.createElement("table");
  table.className = "stats-table";
  for (const [label, value] of rows) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = label;
    const td = document.createElement("td");
    td.textContent = String(value);
    tr.appendChild(th);
    tr.appendChild(td);
    table.appendChild(tr);
  }
  wrap.appendChild(table);

  if (usage.promptTokenCount != null) {
    const note = document.createElement("p");
    note.className = "stats-note";
    note.textContent = "Prompt tokens include the system instruction and full conversation history sent on this turn.";
    wrap.appendChild(note);
  }
  return wrap;
}

function positionPopover(trigger) {
  const rect = trigger.getBoundingClientRect();
  const popRect = popover.getBoundingClientRect();
  const margin = 8;
  let top = rect.bottom + margin;
  let left = rect.right - popRect.width;
  if (left < margin) left = margin;
  if (top + popRect.height > window.innerHeight - margin) {
    top = Math.max(margin, rect.top - popRect.height - margin);
  }
  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;
}

export function openStatsPopover(trigger, stats) {
  ensurePopover();
  if (currentTrigger === trigger && !popover.hidden) {
    closePopover();
    return;
  }
  popover.innerHTML = "";
  popover.appendChild(renderBody(stats));
  popover.hidden = false;
  currentTrigger = trigger;
  trigger.setAttribute("aria-expanded", "true");
  positionPopover(trigger);
}

export function closePopover() {
  if (!popover || popover.hidden) return;
  popover.hidden = true;
  if (currentTrigger) {
    currentTrigger.setAttribute("aria-expanded", "false");
    currentTrigger = null;
  }
}
