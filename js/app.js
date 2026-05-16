(function () {
  const config = window.RIKIVO_CONFIG || {};
  const puzzle = window.RIKIVO_PUZZLE;
  if (!puzzle) return;

  const gridEl = document.getElementById("puzzle-grid");
  const digitPadEl = document.getElementById("digit-pad");
  const backspaceBtn = document.getElementById("backspace-btn");
  const zeroBtn = document.getElementById("zero-btn");
  const resetBtn = document.getElementById("reset-btn");
  const patreonLinkInline = document.getElementById("patreon-link-inline");
  const bookLinkInline = document.getElementById("book-link-inline");
  const feedbackChip = document.getElementById("feedback-chip");
  const statusBarEl = document.getElementById("status-bar");
  const rulesBtn = document.getElementById("rules-btn");
  const rulesModal = document.getElementById("rules-modal");
  const rulesCloseBtn = document.getElementById("rules-close-btn");
  const menuBtn = document.getElementById("menu-btn");
  const menuModal = document.getElementById("menu-modal");
  const menuCloseBtn = document.getElementById("menu-close-btn");
  const menuRulesBtn = document.getElementById("menu-rules-btn") || rulesBtn;
  const menuPatreonLink = document.getElementById("menu-patreon-link");
  const menuBookLink = document.getElementById("menu-book-link");
  const STATS_KEY = "rikivo_streak_stats_v1";
  const todayKey = getLondonDateKey();
  const startedAt = Date.now();

  if (patreonLinkInline) patreonLinkInline.href = config.patreonUrl || "#";
  if (bookLinkInline) bookLinkInline.href = config.bookUrl || "#";
  if (menuPatreonLink) menuPatreonLink.href = config.patreonUrl || "#";
  if (menuBookLink) menuBookLink.href = config.bookUrl || "#";

  document.addEventListener("click", (event) => {
    const rulesTrigger = event.target.closest("#menu-rules-btn, #rules-btn");
    if (!rulesTrigger) return;

    event.preventDefault();
    event.stopPropagation();

    if (menuModal) menuModal.classList.add("hidden");
    if (rulesModal) rulesModal.classList.remove("hidden");
  }, true);

  const current = puzzle.givens.map(r => r.slice());
  let selected = null, cells = [], inputBuffer = "";
  let replaceOnInput = false;
  let solved = false;
  let autoCheckTimer = null;
  const stats = loadStats();
  const statsEl = createStatsDisplay();
  const shareBtn = createShareButton();
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
      if (!raw) return { currentStreak: 0, bestStreak: 0, lastCompletedDate: null, bestTimesByDate: {}, solvedDates: {} };
      const parsed = JSON.parse(raw);
      return {
        currentStreak: Number.isInteger(parsed.currentStreak) ? parsed.currentStreak : 0,
        bestStreak: Number.isInteger(parsed.bestStreak) ? parsed.bestStreak : 0,
        lastCompletedDate: typeof parsed.lastCompletedDate === "string" ? parsed.lastCompletedDate : null,
        bestTimesByDate: parsed.bestTimesByDate && typeof parsed.bestTimesByDate === "object" ? parsed.bestTimesByDate : {},
        solvedDates: parsed.solvedDates && typeof parsed.solvedDates === "object" ? parsed.solvedDates : {}
      };
    } catch (_) {
      return { currentStreak: 0, bestStreak: 0, lastCompletedDate: null, bestTimesByDate: {}, solvedDates: {} };
    }
  }

  function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function createStatsDisplay() {
    if (!statusBarEl) return null;
    const el = document.createElement("div");
    el.className = "status-pill";
    el.id = "streak-stats";
    statusBarEl.appendChild(el);
    const bestEl = document.createElement("div");
    bestEl.className = "status-pill";
    bestEl.id = "best-stats";
    statusBarEl.appendChild(bestEl);
    const timeEl = document.createElement("div");
    timeEl.className = "status-pill";
    timeEl.id = "time-stats";
    statusBarEl.appendChild(timeEl);
    return el;
  }
  function createShareButton() {
    const entryPanel = document.querySelector(".entry-panel");
    if (!entryPanel) return null;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "share-result-btn";
    btn.className = "secondary-pill compact-pill";
    btn.textContent = "Share Result";
    btn.style.display = "none";
    btn.style.margin = "8px auto 0";
    btn.style.minWidth = "140px";
    btn.addEventListener("click", shareResult);
    entryPanel.appendChild(btn);
    return btn;
  }

  function getShareText() {
    const todayBestSeconds = Number(stats.bestTimesByDate[todayKey]);
    const bestTimeText = Number.isFinite(todayBestSeconds) ? formatDuration(todayBestSeconds) : "—";
    return `Rikivo — ${todayKey}\n⏱ ${bestTimeText}\n🔥 Streak: ${stats.currentStreak}`;
  }

  async function shareResult() {
    const text = getShareText();
    try {
      if (navigator.share) {
        await navigator.share({ text });
        showTemporaryFeedback("Shared");
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showTemporaryFeedback("Copied to clipboard");
        return;
      }
    } catch (_) {
      // User cancellation or share errors should quietly fall back below.
    }
    // Silent failure when sharing/copy is unsupported.
  }

  function closeMenu() {
    if (menuModal) menuModal.classList.add("hidden");
  }
  function closeRules() {
    if (rulesModal) rulesModal.classList.add("hidden");
  }
  function openMenu() {
    closeRules();
    if (menuModal) menuModal.classList.remove("hidden");
  }
  function openRules() {
    closeMenu();
    if (rulesModal) rulesModal.classList.remove("hidden");
  }
  function showTemporaryFeedback(message) {
    showFeedback(message);
    setTimeout(() => {
      if (message === feedbackChip.textContent) showFeedback("");
    }, 1400);
  }

  function renderStats() {
    if (!statsEl) return;
    const todayBestSeconds = Number(stats.bestTimesByDate[todayKey]);
    const bestTimeText = Number.isFinite(todayBestSeconds) ? formatDuration(todayBestSeconds) : "—";
    statsEl.textContent = `Streak: ${stats.currentStreak}`;
    const bestEl = document.getElementById("best-stats");
    const timeEl = document.getElementById("time-stats");
    if (bestEl) bestEl.textContent = `Best: ${stats.bestStreak}`;
    if (timeEl) timeEl.textContent = `Time: ${bestTimeText}`;
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
    if (!Number.isFinite(existing)) {
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
    if(solved || !selected || !inputBuffer) return;
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
  function setLockedUIState() {
    digitPadEl.querySelectorAll("button").forEach(btn => { btn.disabled = true; });
    if (backspaceBtn) {
      backspaceBtn.disabled = true;
      backspaceBtn.style.opacity = "0.6";
      backspaceBtn.style.pointerEvents = "none";
    }
    if (resetBtn) {
      resetBtn.disabled = true;
      resetBtn.style.opacity = "0.6";
      resetBtn.style.pointerEvents = "none";
    }
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
          if(given || solved) return;
          selected = {row, col};
          inputBuffer = current[row][col] ? String(current[row][col]) : "";
          replaceOnInput = current[row][col] !== null && current[row][col] !== "";
          clearHighlights(); cell.classList.add("selected");
        });
        gridEl.appendChild(cell); cells.push(cell);
      }
    }
  }
  function createDigitPad(){
    digitPadEl.innerHTML = "";
    const layout = [1,2,3,4,5,6,7,8,9];
    layout.forEach(d => {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "digit-btn";
      if(d === null){ btn.classList.add("empty"); btn.textContent = ""; }
      else{
        btn.textContent = d;
        btn.addEventListener("click", () => {
          if(!selected) return;
          if(!replaceOnInput && inputBuffer.length >= 2) return;
          const proposed = replaceOnInput ? String(d) : inputBuffer + String(d);
          if(proposed.startsWith("0") || Number(proposed) > puzzle.maxNumber) return;
          replaceOnInput = false;
          inputBuffer = proposed; commitBufferToSelected();
        });
      }
      digitPadEl.appendChild(btn);
    });
  }
  function backspace(){
    if(solved || !selected) return;
    if (autoCheckTimer) { clearTimeout(autoCheckTimer); autoCheckTimer = null; }
    inputBuffer = inputBuffer.slice(0,-1);
    if(!inputBuffer){
      current[selected.row][selected.col] = null;
      const cell = cellAt(selected.row, selected.col);
      cell.textContent = ""; cell.style.fontWeight = "400";
      cells.forEach(c => c.classList.remove("correct","wrong")); restoreSelected();
      replaceOnInput = false;
    } else commitBufferToSelected();
    showFeedback("");
  }
  function resetPuzzle(){
    if (solved || stats.solvedDates[todayKey]) return;
    if (autoCheckTimer) { clearTimeout(autoCheckTimer); autoCheckTimer = null; }
    for(let row=0; row<puzzle.size; row++) for(let col=0; col<puzzle.size; col++) current[row][col] = puzzle.givens[row][col];
    solved = false;
    if (shareBtn) shareBtn.style.display = "none";
    selected = null; inputBuffer = ""; replaceOnInput = false; createGrid(); showFeedback("Puzzle reset.");
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
        stats.solvedDates[todayKey] = true;
        updateStreakOnCompletion();
        updateBestTimeOnCompletion();
        saveStats();
        renderStats();
        if (shareBtn) shareBtn.style.display = "block";
        setLockedUIState();
      }
      showFeedback("");
    }
    else showFeedback("");
  }
  backspaceBtn.addEventListener("click", backspace);
  if (zeroBtn) {
    zeroBtn.addEventListener("click", () => {
      if(!selected) return;
      if(!replaceOnInput && inputBuffer.length >= 2) return;
      const proposed = replaceOnInput ? "0" : inputBuffer + "0";
      if(proposed.startsWith("0") || Number(proposed) > puzzle.maxNumber) return;
      replaceOnInput = false;
      inputBuffer = proposed; commitBufferToSelected();
    });
  }
  resetBtn.addEventListener("click", resetPuzzle);
  if (rulesModal && rulesCloseBtn) {
    rulesCloseBtn.addEventListener("click", closeRules);
    rulesModal.addEventListener("click", (e) => { if (e.target === rulesModal) closeRules(); });
  }
  if (menuBtn && menuModal && menuCloseBtn) {
    menuBtn.addEventListener("click", openMenu);
    menuCloseBtn.addEventListener("click", closeMenu);
    menuModal.addEventListener("click", (e) => { if (e.target === menuModal) closeMenu(); });
  }
  createGrid(); createDigitPad(); renderStats();
  if (stats.solvedDates[todayKey]) {
    solved = true;
    if (shareBtn) shareBtn.style.display = "block";
    setLockedUIState();
  }
  showFeedback("");
})();
