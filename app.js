/* Flip 7 Scorekeeper (vanilla, offline, localStorage)
   - 2–8 players
   - Enter per-player round totals (integer; allow negative)
   - Keeps running totals
   - Sorted by total desc
   - Undo last round
   - Edit any previous round, recalculates later totals
   - End game when any player reaches 200+ at end of a round; highlight winner(s), handle ties
*/

const STORAGE_KEY = "flip7_scorekeeper_v1";

const $ = (id) => document.getElementById(id);

const el = {
  subtitle: $("subtitle"),

  viewSetup: $("viewSetup"),
  viewScore: $("viewScore"),
  viewHistory: $("viewHistory"),
  viewEdit: $("viewEdit"),

  playerList: $("playerList"),
  btnAddPlayer: $("btnAddPlayer"),
  btnStartGame: $("btnStartGame"),

  endBanner: $("endBanner"),
  roundNumber: $("roundNumber"),
  scoreList: $("scoreList"),
  btnSubmitRound: $("btnSubmitRound"),
  btnUndo: $("btnUndo"),
  btnHistory: $("btnHistory"),
  btnBackToScore: $("btnBackToScore"),

  btnNewGame: $("btnNewGame"),
  btnResetScores: $("btnResetScores"),
  btnClearHistory: $("btnClearHistory"),

  historyList: $("historyList"),

  editRoundNumber: $("editRoundNumber"),
  editList: $("editList"),
  btnCancelEdit: $("btnCancelEdit"),
  btnSaveEdit: $("btnSaveEdit"),

  saveStatus: $("saveStatus"),
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function nowISO() {
  return new Date().toISOString();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** App state
 * players: [{id, name}]
 * rounds: [{ts, scores: {playerId: int}}]
 * currentInputs: {playerId: string} // raw text, so user can type '-' etc.
 * view: 'setup' | 'score' | 'history' | 'edit'
 * editIndex: number | null
 */
let state = defaultState();

function defaultState() {
  return {
    players: [],
    rounds: [],
    currentInputs: {},
    view: "setup",
    editIndex: null,
  };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    el.saveStatus.textContent = "Saved locally on this device.";
  } catch (e) {
    el.saveStatus.textContent = "Could not save (storage blocked).";
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // minimal shape validation
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.players) || !Array.isArray(parsed.rounds)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function resetToNewGame() {
  state = defaultState();
  // start with 2 players by default
  addPlayer();
  addPlayer();
  state.view = "setup";
  saveState();
  render();
}

function addPlayer() {
  if (state.players.length >= 8) return;
  const index = state.players.length + 1;
  const p = { id: uid(), name: `Player ${index}` };
  state.players.push(p);
  // default input 0 for this player
  state.currentInputs[p.id] = "0";
  saveState();
}

function removePlayer(playerId) {
  state.players = state.players.filter(p => p.id !== playerId);
  delete state.currentInputs[playerId];
  // remove scores from rounds
  for (const r of state.rounds) {
    if (r.scores && r.scores[playerId] !== undefined) {
      delete r.scores[playerId];
    }
  }
  saveState();
}

function renamePlayer(playerId, newName) {
  const p = state.players.find(x => x.id === playerId);
  if (!p) return;
  p.name = newName.trim() || p.name;
  saveState();
}

function setView(view) {
  state.view = view;
  saveState();
  render();
}

function computeTotalsByRound(players, rounds) {
  // returns { totalsNow: {id: total}, totalsAfterRound: Array<{id: total}>, end: {ended, endIndex, winners: [id], maxTotal} }
  const totals = {};
  for (const p of players) totals[p.id] = 0;

  const totalsAfterRound = [];

  let endIndex = null;

  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    for (const p of players) {
      const v = (r.scores && r.scores[p.id] !== undefined) ? r.scores[p.id] : 0;
      totals[p.id] += v;
    }
    totalsAfterRound.push({ ...totals });

    const maxTotal = Math.max(...players.map(p => totals[p.id]));
    if (endIndex === null && maxTotal >= 200) {
      endIndex = i; // first round where someone reaches 200+
    }
  }

  // if ended, compute winners at that endIndex totals
  let winners = [];
  let maxAtEnd = null;

  if (endIndex !== null) {
    const tEnd = totalsAfterRound[endIndex];
    maxAtEnd = Math.max(...players.map(p => tEnd[p.id]));
    winners = players.filter(p => tEnd[p.id] === maxAtEnd).map(p => p.id);
  }

  return {
    totalsNow: { ...totals },
    totalsAfterRound,
    end: {
      ended: endIndex !== null,
      endIndex,
      winners,
      maxTotal: maxAtEnd,
    },
  };
}

function sortedPlayersByTotal(players, totalsNow) {
  return [...players].sort((a, b) => {
    const da = totalsNow[a.id] ?? 0;
    const db = totalsNow[b.id] ?? 0;
    if (db !== da) return db - da;
    return a.name.localeCompare(b.name);
  });
}

function currentRoundIndex() {
  return state.rounds.length + 1;
}

function parseIntStrict(s) {
  // allow leading/trailing spaces; allow negative; require integer
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (t === "") return null;
  if (!/^-?\d+$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

function ensureAllInputsPresent() {
  // require every player has some input text (default 0 is okay)
  for (const p of state.players) {
    if (state.currentInputs[p.id] === undefined) state.currentInputs[p.id] = "0";
    if (String(state.currentInputs[p.id]).trim() === "") return false;
  }
  return true;
}

function setInput(playerId, value) {
  state.currentInputs[playerId] = value;
  saveState();
}

/* ---------- Actions ---------- */

function startGame() {
  if (state.players.length < 2) {
    alert("Please add at least 2 players.");
    return;
  }
  if (state.players.length > 8) {
    alert("Max 8 players.");
    return;
  }
  // Initialize inputs to 0 if missing
  for (const p of state.players) {
    if (state.currentInputs[p.id] === undefined) state.currentInputs[p.id] = "0";
  }
  state.view = "score";
  saveState();
  render();
}

function submitRound() {
  const { end } = computeTotalsByRound(state.players, state.rounds);
  if (end.ended) {
    alert("Game has ended. Start a New Game to play again.");
    return;
  }

  if (!ensureAllInputsPresent()) {
    alert("Please enter a score for every player (0 is allowed).");
    return;
  }

  // Validate all are integers
  const scores = {};
  for (const p of state.players) {
    const v = parseIntStrict(state.currentInputs[p.id]);
    if (v === null) {
      alert(`Please enter an integer score for ${p.name}.`);
      return;
    }
    scores[p.id] = v;
  }

  // Prevent accidental double-submit
  el.btnSubmitRound.disabled = true;

  state.rounds.push({ ts: nowISO(), scores });
  // reset inputs to 0 for next round (fast entry)
  for (const p of state.players) state.currentInputs[p.id] = "0";

  saveState();
  render();

  // brief delay before allowing next submit
  setTimeout(() => {
    el.btnSubmitRound.disabled = false;
  }, 650);
}

function undoLastRound() {
  if (state.rounds.length === 0) {
    alert("No rounds to undo.");
    return;
  }
  const ok = confirm("Undo the last round? This will remove it from history.");
  if (!ok) return;

  state.rounds.pop();
  saveState();
  render();
}

function clearHistory() {
  if (state.rounds.length === 0) {
    alert("History is already empty.");
    return;
  }
  const ok = confirm("Clear all round history? (Players will remain.)");
  if (!ok) return;

  state.rounds = [];
  // reset inputs to 0
  for (const p of state.players) state.currentInputs[p.id] = "0";

  saveState();
  render();
}

function resetScoresKeepPlayers() {
  const ok = confirm("Reset scores and history, but keep the player list?");
  if (!ok) return;

  state.rounds = [];
  for (const p of state.players) state.currentInputs[p.id] = "0";
  saveState();
  render();
}

function newGame() {
  const ok = confirm("Start a New Game? This will clear players and history.");
  if (!ok) return;

  resetToNewGame();
}

function openHistory() {
  state.view = "history";
  saveState();
  render();
}

function backToScore() {
  state.view = "score";
  saveState();
  render();
}

function openEditRound(index) {
  state.editIndex = index;
  state.view = "edit";
  saveState();
  render();
}

function cancelEdit() {
  state.editIndex = null;
  state.view = "history";
  saveState();
  render();
}

function saveEdit() {
  const idx = state.editIndex;
  if (idx === null || idx < 0 || idx >= state.rounds.length) {
    alert("Could not edit that round.");
    return;
  }

  const round = state.rounds[idx];
  const newScores = { ...round.scores };

  for (const p of state.players) {
    const input = document.querySelector(`[data-edit-input="${p.id}"]`);
    const v = parseIntStrict(input ? input.value : "");
    if (v === null) {
      alert(`Please enter an integer score for ${p.name}.`);
      return;
    }
    newScores[p.id] = v;
  }

  // Save and totals are recalculated from scratch on render
  round.scores = newScores;
  round.ts = round.ts || nowISO();

  saveState();
  state.view = "history";
  state.editIndex = null;
  saveState();
  render();
}

/* ---------- Rendering ---------- */

function render() {
  // view visibility
  el.viewSetup.classList.toggle("hidden", state.view !== "setup");
  el.viewScore.classList.toggle("hidden", state.view !== "score");
  el.viewHistory.classList.toggle("hidden", state.view !== "history");
  el.viewEdit.classList.toggle("hidden", state.view !== "edit");

  // subtitle
  const subtitles = {
    setup: "Setup",
    score: "Scoring",
    history: "History",
    edit: "Edit Round",
  };
  el.subtitle.textContent = subtitles[state.view] || "";

  if (state.view === "setup") renderSetup();
  if (state.view === "score") renderScore();
  if (state.view === "history") renderHistory();
  if (state.view === "edit") renderEdit();

  // service worker register
  registerServiceWorkerOnce();
}

function renderSetup() {
  // ensure at least 2 players exist on first load
  if (state.players.length === 0) {
    addPlayer();
    addPlayer();
  }

  el.playerList.innerHTML = "";

  state.players.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "player-row";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="player-name">${escapeHtml(p.name)}</div>
      <div class="player-meta">Tap name to edit • Player ${i + 1}</div>
    `;

    left.addEventListener("click", () => {
      const newName = prompt("Player name:", p.name);
      if (newName === null) return;
      renamePlayer(p.id, newName);
      render();
    });

    const right = document.createElement("div");
    // show remove only if >2
    if (state.players.length > 2) {
      const btn = document.createElement("button");
      btn.className = "btn btn-ghost danger";
      btn.type = "button";
      btn.textContent = "Remove";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const ok = confirm(`Remove ${p.name}?`);
        if (!ok) return;
        removePlayer(p.id);
        // re-label default names if they were untouched? (We won't auto-rename; simple.)
        render();
      });
      right.appendChild(btn);
    } else {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "Min 2";
      right.appendChild(badge);
    }

    row.appendChild(left);
    row.appendChild(right);

    el.playerList.appendChild(row);
  });

  el.btnAddPlayer.disabled = state.players.length >= 8;
  el.btnStartGame.disabled = !(state.players.length >= 2 && state.players.length <= 8);
}

function renderScore() {
  const computed = computeTotalsByRound(state.players, state.rounds);

  // round number (next round to enter)
  el.roundNumber.textContent = String(currentRoundIndex());

  // End game banner + highlight winners on the ending round totals
  const ended = computed.end.ended;
  const endIndex = computed.end.endIndex;

  let totalsForDisplay = computed.totalsNow;
  // If ended, totalsNow already equals last round totals.
  // If user has extra rounds after ended (shouldn't happen), we'd still pick endIndex,
  // but our UI prevents adding more after end.

  const winners = computed.end.winners;

  if (ended) {
    el.endBanner.classList.remove("hidden");
    const winNames = winners
      .map(id => state.players.find(p => p.id === id)?.name || "Unknown")
      .join(", ");
    const endRoundNum = (endIndex ?? 0) + 1;
    el.endBanner.textContent = `End of Game (Round ${endRoundNum}) • Winner: ${winNames}`;
  } else {
    el.endBanner.classList.add("hidden");
    el.endBanner.textContent = "";
  }

  const sorted = sortedPlayersByTotal(state.players, totalsForDisplay);

  // Ensure inputs exist
  for (const p of state.players) {
    if (state.currentInputs[p.id] === undefined) state.currentInputs[p.id] = "0";
  }

  el.scoreList.innerHTML = "";

  sorted.forEach((p, idx) => {
    const total = totalsForDisplay[p.id] ?? 0;

    const row = document.createElement("div");
    row.className = "score-row";
    if (ended && winners.includes(p.id)) row.classList.add("winner");

    const left = document.createElement("div");
    left.className = "score-left";
    left.innerHTML = `
      <div class="score-title">
        <div class="score-name">${escapeHtml(p.name)}</div>
        <div class="badge">Total: ${total}</div>
      </div>
      <div class="score-total">Sorted by score • Enter round score on the right</div>
    `;

    const right = document.createElement("div");
    right.className = "score-right";

    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.pattern = "-?[0-9]*";
    input.enterKeyHint = (idx === sorted.length - 1) ? "done" : "next";
    input.className = "input-mini";
    input.value = state.currentInputs[p.id] ?? "0";
    input.setAttribute("data-player-input", p.id);
    input.setAttribute("aria-label", `${p.name} round score`);
    input.addEventListener("input", () => {
      setInput(p.id, input.value);
    });

    // On iPhone, "Next" works better with enterKeyHint + keydown
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        focusNextInputBySortedIndex(sorted, idx);
      }
    });

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn btn-ghost";
    nextBtn.type = "button";
    nextBtn.textContent = (idx === sorted.length - 1) ? "Done" : "Next";
    nextBtn.addEventListener("click", () => {
      focusNextInputBySortedIndex(sorted, idx);
    });

    right.appendChild(input);
    right.appendChild(nextBtn);

    row.appendChild(left);
    row.appendChild(right);
    el.scoreList.appendChild(row);
  });

  // Disable submit if ended
  el.btnSubmitRound.disabled = ended;

  // Undo enabled only if there is history
  el.btnUndo.disabled = state.rounds.length === 0;

  // If just switched to score, focus first input
  queueMicrotask(() => {
    const first = document.querySelector('[data-player-input]');
    if (first && document.activeElement === document.body) first.focus();
  });
}

function focusNextInputBySortedIndex(sortedPlayers, idx) {
  const nextIdx = idx + 1;
  if (nextIdx >= sortedPlayers.length) {
    // end: blur keyboard
    const input = document.querySelector(`[data-player-input="${sortedPlayers[idx].id}"]`);
    if (input) input.blur();
    return;
  }
  const nextId = sortedPlayers[nextIdx].id;
  const next = document.querySelector(`[data-player-input="${nextId}"]`);
  if (next) next.focus();
}

function renderHistory() {
  const computed = computeTotalsByRound(state.players, state.rounds);
  el.historyList.innerHTML = "";

  if (state.rounds.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No rounds yet.";
    el.historyList.appendChild(empty);
    return;
  }

  // Build each round card: per-player scores and (optional) cumulative totals after that round
  state.rounds.forEach((r, i) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost";
    const when = r.ts ? new Date(r.ts) : null;
    const whenStr = when ? when.toLocaleString() : "—";
    btn.innerHTML = `<strong>Round ${i + 1}</strong><div class="muted small">Tap to edit • ${escapeHtml(whenStr)}</div>`;
    btn.addEventListener("click", () => openEditRound(i));

    const mini = document.createElement("div");
    mini.className = "table-mini";

    const totalsAfter = computed.totalsAfterRound[i] || {};

    // show players in the original player list order (stable)
    for (const p of state.players) {
      const s = (r.scores && r.scores[p.id] !== undefined) ? r.scores[p.id] : 0;
      const t = totalsAfter[p.id] ?? 0;
      const line = document.createElement("div");
      line.className = "row-mini";
      line.innerHTML = `<div>${escapeHtml(p.name)}: <strong>${s}</strong></div><div class="muted">Total: ${t}</div>`;
      mini.appendChild(line);
    }

    item.appendChild(btn);
    item.appendChild(mini);
    el.historyList.appendChild(item);
  });
}

function renderEdit() {
  const idx = state.editIndex;
  if (idx === null || idx < 0 || idx >= state.rounds.length) {
    // fallback
    state.view = "history";
    state.editIndex = null;
    saveState();
    render();
    return;
  }

  const round = state.rounds[idx];
  el.editRoundNumber.textContent = String(idx + 1);
  el.editList.innerHTML = "";

  for (const p of state.players) {
    const row = document.createElement("div");
    row.className = "score-row";

    const left = document.createElement("div");
    left.className = "score-left";
    left.innerHTML = `<div class="score-name">${escapeHtml(p.name)}</div>
      <div class="muted small">Edit this player’s score for Round ${idx + 1}</div>`;

    const right = document.createElement("div");
    right.className = "score-right";

    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.pattern = "-?[0-9]*";
    input.enterKeyHint = "next";
    input.className = "input-mini";
    input.value = (round.scores && round.scores[p.id] !== undefined) ? String(round.scores[p.id]) : "0";
    input.setAttribute("data-edit-input", p.id);

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn btn-ghost";
    nextBtn.type = "button";
    nextBtn.textContent = "Next";
    nextBtn.addEventListener("click", () => {
      // focus next edit input
      const inputs = Array.from(document.querySelectorAll("[data-edit-input]"));
      const pos = inputs.indexOf(input);
      if (pos >= 0 && pos + 1 < inputs.length) inputs[pos + 1].focus();
      else input.blur();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        nextBtn.click();
      }
    });

    right.appendChild(input);
    right.appendChild(nextBtn);

    row.appendChild(left);
    row.appendChild(right);
    el.editList.appendChild(row);
  }

  queueMicrotask(() => {
    const first = document.querySelector("[data-edit-input]");
    if (first) first.focus();
  });
}

/* ---------- Utilities ---------- */

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------- Events ---------- */

el.btnAddPlayer.addEventListener("click", () => {
  addPlayer();
  render();
});

el.btnStartGame.addEventListener("click", startGame);

el.btnSubmitRound.addEventListener("click", submitRound);
el.btnUndo.addEventListener("click", undoLastRound);
el.btnHistory.addEventListener("click", openHistory);
el.btnBackToScore.addEventListener("click", backToScore);

el.btnNewGame.addEventListener("click", newGame);
el.btnResetScores.addEventListener("click", resetScoresKeepPlayers);
el.btnClearHistory.addEventListener("click", clearHistory);

el.btnCancelEdit.addEventListener("click", cancelEdit);
el.btnSaveEdit.addEventListener("click", saveEdit);

/* ---------- PWA: Service Worker ---------- */
let swRegistered = false;
function registerServiceWorkerOnce() {
  if (swRegistered) return;
  swRegistered = true;

  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js", { scope: "./" });
    } catch {
      // ignore
    }
  });
}

/* ---------- Init ---------- */

(function init() {
  const loaded = loadState();
  if (loaded) state = loaded;

  // Ensure currentInputs has all players
  for (const p of state.players) {
    if (state.currentInputs[p.id] === undefined) state.currentInputs[p.id] = "0";
  }

  // If state says score/history/edit but there are no players, reset
  if (state.players.length === 0 && state.view !== "setup") {
    state.view = "setup";
  }

  // Clamp players to 8 (just in case)
  if (state.players.length > 8) state.players = state.players.slice(0, 8);

  // If view is edit but invalid index, fix
  if (state.view === "edit") {
    const idx = state.editIndex;
    if (idx === null || idx < 0 || idx >= state.rounds.length) {
      state.view = "history";
      state.editIndex = null;
    }
  }

  saveState();
  render();
})();
