(function () {
  const config = window.RIKIVO_CONFIG || {};
  const puzzle = window.RIKIVO_PUZZLE;
  if (!puzzle) return;

  const gridEl = document.getElementById("puzzle-grid");
  const digitPadEl = document.getElementById("digit-pad");
  const backspaceBtn = document.getElementById("backspace-btn");
  const clearBtn = document.getElementById("clear-btn");
  const checkBtn = document.getElementById("check-btn");
  const resetBtn = document.getElementById("reset-btn");
  const patreonLinkInline = document.getElementById("patreon-link-inline");
  const bookLinkInline = document.getElementById("book-link-inline");
  const feedbackChip = document.getElementById("feedback-chip");
  const STATS_KEY = "rikivo_streak_stats_v1";
  const todayKey = getLondonDateKey();
  const startedAt = Date.now();

  if (patreonLinkInline) patreonLinkInline.href = config.patreonUrl || "#";
  if (bookLinkInline) bookLinkInline.href = config.bookUrl || "#";

  const current = puzzle.givens.map(r => r.slice());
  let selected = null, cells = [], inputBuffer = "";
  let solved = false;
  let autoCheckTimer = null;
  const stats = loadStats();
  const statsEl = createStatsDisplay();
  gridEl.style.gridTemplateColumns = `repeat(${puzzle.size}, 1fr)`;

  function getLondonDateKey() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (!raw) return { currentStreak: 0, bestStreak: 0, lastCompletedDate: null, bestTimesByDate: {} };
      const parsed = JSON.parse(raw);
      return {
        currentStreak: Number.isInteger(parsed.currentStreak) ? parsed.currentStreak : 0,
        bestStreak: Number.isInteger(parsed.bestStreak) ? parsed.bestStreak : 0,
        lastCompletedDate: typeof parsed.lastCompletedDate === "string" ? parsed.lastCompletedDate : null,
        bestTimesByDate: parsed.bestTimesByDate && typeof parsed.bestTimesByDate === "object" ? parsed.bestTimesByDate : {}
      };
    } catch (_) {
      return { currentStreak: 0, bestStreak: 0, lastCompletedDate: null, bestTimesByDate: {} };
    }
  }

  function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function createStatsDisplay() {
    const entryPanel = document.querySelector(".entry-panel");
    if (!entryPanel) return null;
    const el = document.createElement("p");
    el.className = "habit-line";
    el.id = "streak-stats";
    entryPanel.appendChild(el);
    return el;
  }

  function renderStats() {
    if (!statsEl) return;
    const todayBestSeconds = Number(stats.bestTimesByDate[todayKey]);
    const bestTimeText = Number.isFinite(todayBestSeconds) ? formatDuration(todayBestSeconds) : "—";
    statsEl.textContent = `Streak: ${stats.currentStreak} day${stats.currentStreak === 1 ? "" : "s"} · Best: ${stats.bestStreak} · Time: ${bestTimeText}`;
  }

  function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${String(sec).padStart(2, "0")}`;
  }

  function updateBestTimeOnCompletion() {
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    const existing = Number(stats.bestTimesByDate[todayKey]);
    if (!Number.isFinite(existing) || elapsedSeconds < existing) {
      stats.bestTimesByDate[todayKey] = elapsedSeconds;
      return true;
    }
    return false;
  }

  function updateStreakOnCompletion() {
    if (stats.lastCompletedDate === todayKey) return;
    if (!stats.lastCompletedDate) {
      stats.currentStreak = 1;
    } else {
      const prev = new Date(stats.lastCompletedDate + "T00:00:00Z");
      const today = new Date(todayKey + "T00:00:00Z");
      const dayDiff = Math.floor((today - prev) / 86400000);
      if (dayDiff === 1) stats.currentStreak += 1;
      else if (dayDiff > 1) stats.currentStreak = 1;
    }
    stats.lastCompletedDate = todayKey;
    if (stats.currentStreak > stats.bestStreak) stats.bestStreak = stats.currentStreak;
    saveStats();
    renderStats();
  }

  function showFeedback(msg){
    if(!feedbackChip) return;
    if(!msg){ feedbackChip.textContent=""; feedbackChip.classList.add("hidden"); return; }
    feedbackChip.textContent=msg; feedbackChip.classList.remove("hidden");
  }
  function cellAt(row,col){ return cells[row*puzzle.size+col]; }
  function clearHighlights(){ cells.forEach(c => c.classList.remove("selected","correct","wrong")); }
  function restoreSelected(){ if(selected) cellAt(selected.row, selected.col).classList.add("selected"); }

  function commitBufferToSelected(){
    if(!selected || !inputBuffer) return;
    const value = Number(inputBuffer);
    if(!Number.isInteger(value) || value < 1 || value > puzzle.maxNumber) return;
    current[selected.row][selected.col] = value;
    const cell = cellAt(selected.row, selected.col);
    cell.textContent = value;
    cell.style.fontWeight = value === puzzle.maxNumber ? "800" : "400";
    cells.forEach(c => c.classList.remove("correct","wrong"));
    restoreSelected(); showFeedback("");
    scheduleAutoCheckIfFilled();
  }
  function hasAnyEmptyCells() {
    for (let row = 0; row < puzzle.size; row++) {
      for (let col = 0; col < puzzle.size; col++) {
        if (puzzle.givens[row][col] !== null) continue;
        if (current[row][col] === null || current[row][col] === "") return true;
      }
    }
    return false;
  }
  function triggerAutoCheckIfFilled() {
    if (solved) return;
    if (!hasAnyEmptyCells()) checkPuzzle();
  }
  function scheduleAutoCheckIfFilled() {
    if (autoCheckTimer) clearTimeout(autoCheckTimer);
    autoCheckTimer = setTimeout(() => {
      autoCheckTimer = null;
      triggerAutoCheckIfFilled();
    }, 700);
  }
  function createGrid(){
    gridEl.innerHTML = ""; cells = [];
    for(let row=0; row<puzzle.size; row++){
      for(let col=0; col<puzzle.size; col++){
        const value = current[row][col], given = puzzle.givens[row][col] !== null, shade = puzzle.shading[row][col];
        const cell = document.createElement("button");
        cell.type = "button"; cell.className = "cell";
        if(shade===1) cell.classList.add("shade-1");
        if(shade===2) cell.classList.add("shade-2");
        if(shade===3) cell.classList.add("shade-3");
        if(shade===0) cell.classList.add("final-cell");
        if(given) cell.classList.add("given-cell");
        if(value === puzzle.maxNumber) cell.style.fontWeight = "800";
        cell.textContent = value ?? "";
        cell.addEventListener("click", () => {
          if(given) return;
          selected = {row, col}; inputBuffer = current[row][col] ? String(current[row][col]) : "";
          clearHighlights(); cell.classList.add("selected");
        });
        gridEl.appendChild(cell); cells.push(cell);
      }
    }
  }
  function createDigitPad(){
    digitPadEl.innerHTML = "";
    const layout = [1,2,3,4,5,6,7,8,9,null,0,null];
    layout.forEach(d => {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "digit-btn";
      if(d === null){ btn.classList.add("empty"); btn.textContent = ""; }
      else{
        btn.textContent = d;
        btn.addEventListener("click", () => {
          if(!selected || inputBuffer.length >= 2) return;
          const proposed = inputBuffer + String(d);
          if(proposed.startsWith("0") || Number(proposed) > puzzle.maxNumber) return;
          inputBuffer = proposed; commitBufferToSelected();
        });
      }
      digitPadEl.appendChild(btn);
    });
  }
  function backspace(){
    if(!selected) return;
    if (autoCheckTimer) { clearTimeout(autoCheckTimer); autoCheckTimer = null; }
    inputBuffer = inputBuffer.slice(0,-1);
    if(!inputBuffer){
      current[selected.row][selected.col] = null;
      const cell = cellAt(selected.row, selected.col);
      cell.textContent = ""; cell.style.fontWeight = "400";
      cells.forEach(c => c.classList.remove("correct","wrong")); restoreSelected();
    } else commitBufferToSelected();
    showFeedback("");
  }
  function clearSelectedCell(){
    if(!selected) return;
    if (autoCheckTimer) { clearTimeout(autoCheckTimer); autoCheckTimer = null; }
    current[selected.row][selected.col] = null;
    const cell = cellAt(selected.row, selected.col);
    cell.textContent = ""; cell.style.fontWeight = "400"; inputBuffer = "";
    cells.forEach(c => c.classList.remove("correct","wrong")); restoreSelected(); showFeedback("");
  }
  function resetPuzzle(){
    if (autoCheckTimer) { clearTimeout(autoCheckTimer); autoCheckTimer = null; }
    for(let row=0; row<puzzle.size; row++) for(let col=0; col<puzzle.size; col++) current[row][col] = puzzle.givens[row][col];
    solved = false;
    selected = null; inputBuffer = ""; createGrid(); showFeedback("Puzzle reset.");
  }
  function checkPuzzle(){
    let wrongCount = 0, emptyCount = 0;
    cells.forEach(c => c.classList.remove("correct","wrong","selected"));
    for(let row=0; row<puzzle.size; row++){
      for(let col=0; col<puzzle.size; col++){
        const value = current[row][col], solution = puzzle.solution[row][col], given = puzzle.givens[row][col] !== null;
        const cell = cellAt(row,col);
        if(given) continue;
        if(value === null || value === ""){ emptyCount += 1; continue; }
        if(Number(value) === Number(solution)) cell.classList.add("correct");
        else { cell.classList.add("wrong"); wrongCount += 1; }
      }
    }
    restoreSelected();
    if(wrongCount===0 && emptyCount===0) {
      if (!solved) {
        solved = true;
        updateStreakOnCompletion();
        updateBestTimeOnCompletion();
        saveStats();
        renderStats();
      }
      showFeedback("Correct.");
    }
    else if(wrongCount===0) showFeedback("Some squares are still empty.");
    else showFeedback("Some entries are wrong.");
  }
  backspaceBtn.addEventListener("click", backspace);
  clearBtn.addEventListener("click", clearSelectedCell);
  checkBtn.addEventListener("click", checkPuzzle);
  resetBtn.addEventListener("click", resetPuzzle);

  createGrid(); createDigitPad(); renderStats(); showFeedback("");
})();
