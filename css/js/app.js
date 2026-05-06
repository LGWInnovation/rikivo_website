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

  if (patreonLinkInline) patreonLinkInline.href = config.patreonUrl || "#";
  if (bookLinkInline) bookLinkInline.href = config.bookUrl || "#";

  const current = puzzle.givens.map(r => r.slice());
  let selected = null, cells = [], inputBuffer = "";
  gridEl.style.gridTemplateColumns = `repeat(${puzzle.size}, 1fr)`;

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
    current[selected.row][selected.col] = null;
    const cell = cellAt(selected.row, selected.col);
    cell.textContent = ""; cell.style.fontWeight = "400"; inputBuffer = "";
    cells.forEach(c => c.classList.remove("correct","wrong")); restoreSelected(); showFeedback("");
  }
  function resetPuzzle(){
    for(let row=0; row<puzzle.size; row++) for(let col=0; col<puzzle.size; col++) current[row][col] = puzzle.givens[row][col];
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
    if(wrongCount===0 && emptyCount===0) showFeedback("Correct.");
    else if(wrongCount===0) showFeedback("Some squares are still empty.");
    else showFeedback("Some entries are wrong.");
  }
  backspaceBtn.addEventListener("click", backspace);
  clearBtn.addEventListener("click", clearSelectedCell);
  checkBtn.addEventListener("click", checkPuzzle);
  resetBtn.addEventListener("click", resetPuzzle);

  createGrid(); createDigitPad(); showFeedback("");
})();
