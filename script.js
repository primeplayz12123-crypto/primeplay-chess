import("https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm").then(({ Chess }) => startApp(Chess));

function startApp(Chess) {

const game = new Chess();
const $ = (id) => document.getElementById(id);

const boardElement = $("chessboard");
const rankCoordinates = $("rank-coordinates");
const fileCoordinates = $("file-coordinates");
const moveList = $("move-list");
const emptyHistory = $("empty-history");
const promotionOverlay = $("promotion-overlay");
const promotionOptions = $("promotion-options");
const confirmOverlay = $("confirm-overlay");
const toastElement = $("toast");

const PIECES = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
};
const PIECE_NAMES = { q: "Queen", r: "Rook", b: "Bishop", n: "Knight" };
const FILES = "abcdefgh";
const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

let selectedSquare = null;
let legalTargets = [];
let flipped = false;
let pendingPromotion = null;
let toastTimer = null;

function squareName(row, col) {
  const file = flipped ? FILES[7 - col] : FILES[col];
  const rank = flipped ? String(row + 1) : String(8 - row);
  return file + rank;
}

function boardOrder() {
  const squares = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) squares.push(squareName(row, col));
  }
  return squares;
}

function getLastMove() {
  const history = game.history({ verbose: true });
  return history.length ? history[history.length - 1] : null;
}

function checkedKingSquare() {
  if (!game.isCheck()) return null;
  const sideToMove = game.turn();
  for (const rank of game.board()) {
    for (const piece of rank) {
      if (piece && piece.type === "k" && piece.color === sideToMove) return piece.square;
    }
  }
  return null;
}

function renderCoordinates() {
  const ranks = flipped ? ["1", "2", "3", "4", "5", "6", "7", "8"] : ["8", "7", "6", "5", "4", "3", "2", "1"];
  const files = flipped ? [...FILES].reverse() : [...FILES];
  rankCoordinates.innerHTML = ranks.map((rank) => `<span>${rank}</span>`).join("");
  fileCoordinates.innerHTML = files.map((file) => `<span>${file}</span>`).join("");
}

function renderBoard() {
  const lastMove = getLastMove();
  const checkedSquare = checkedKingSquare();
  const squares = boardOrder();

  boardElement.innerHTML = squares.map((square, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    const piece = game.get(square);
    const isLight = (row + col) % 2 === 0;
    const classes = ["square", isLight ? "light" : "dark"];
    if (selectedSquare === square) classes.push("selected");
    if (lastMove && (lastMove.from === square || lastMove.to === square)) classes.push("last-move");
    if (checkedSquare === square) classes.push("in-check");
    const targetMove = legalTargets.find((move) => move.to === square);
    if (targetMove) classes.push(piece ? "capture-target" : "quiet-target");
    const pieceHTML = piece
      ? `<span class="piece ${piece.color === "w" ? "piece-white" : "piece-black"}" aria-hidden="true">${PIECES[piece.color][piece.type]}</span>`
      : "";
    const dotHTML = targetMove ? `<span class="move-dot" aria-hidden="true"></span>` : "";
    const label = piece
      ? `${piece.color === "w" ? "White" : "Black"} ${piece.type === "n" ? "knight" : ({ k: "king", q: "queen", r: "rook", b: "bishop", p: "pawn" })[piece.type]} on ${square}`
      : `Empty ${square}`;
    return `<button class="${classes.join(" ")}" type="button" data-square="${square}" aria-label="${label}" aria-pressed="${selectedSquare === square}">${pieceHTML}${dotHTML}</button>`;
  }).join("");

  renderCoordinates();
}

function describeGame() {
  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "Black" : "White";
    return { title: `${winner} wins`, description: "Checkmate. A brilliant finish.", piece: winner === "White" ? "♔" : "♚", finished: true };
  }
  if (game.isStalemate()) return { title: "Draw by stalemate", description: "The player to move has no legal move, but their king is not in check.", piece: "½", finished: true };
  if (game.isThreefoldRepetition()) return { title: "Draw by repetition", description: "The same position has occurred three times.", piece: "½", finished: true };
  if (game.isInsufficientMaterial()) return { title: "Draw — insufficient material", description: "Neither side has enough material to force checkmate.", piece: "½", finished: true };
  if (game.isDraw()) return { title: "Game drawn", description: "The game has ended under a draw rule.", piece: "½", finished: true };
  if (game.isCheck()) {
    const player = game.turn() === "w" ? "White" : "Black";
    return { title: `${player} is in check`, description: "The king is under attack. Find a safe response.", piece: "!", finished: false };
  }
  const player = game.turn() === "w" ? "White" : "Black";
  return { title: `${player} to move`, description: player === "White" ? "White has the move. Choose a piece to begin." : "Black has the move. Choose a piece to continue.", piece: game.turn() === "w" ? "♙" : "♟", finished: false };
}

function renderStatus() {
  const state = describeGame();
  $("status-title").textContent = state.title;
  $("status-description").textContent = state.description;
  $("status-piece").textContent = state.piece;
  const currentPlayer = game.turn();
  $("white-player-card").classList.toggle("active-player", !state.finished && currentPlayer === "w");
  $("black-player-card").classList.toggle("active-player", !state.finished && currentPlayer === "b");
  $("white-caption").textContent = state.finished ? "Game finished" : currentPlayer === "w" ? (game.isCheck() ? "In check" : "Your turn") : "Waiting to play";
  $("black-caption").textContent = state.finished ? "Game finished" : currentPlayer === "b" ? (game.isCheck() ? "In check" : "Your turn") : "Waiting to play";
  $("white-turn-indicator").setAttribute("aria-label", !state.finished && currentPlayer === "w" ? "White to move" : "");
  $("black-turn-indicator").setAttribute("aria-label", !state.finished && currentPlayer === "b" ? "Black to move" : "");
  const fullMove = Number(game.fen().split(" ")[5] || 1);
  $("move-number").textContent = String(fullMove).padStart(2, "0");
  $("board-hint").textContent = state.finished
    ? "Game over. Start a new game to play again."
    : selectedSquare
      ? "Choose a highlighted square, or select another piece."
      : "Select a piece, then choose a highlighted square.";
  $("undo-button").disabled = game.history().length === 0;
}

function renderMoveHistory() {
  const history = game.history({ verbose: true });
  $("move-count").textContent = `${history.length} ${history.length === 1 ? "ply" : "plies"}`;
  emptyHistory.style.display = history.length ? "none" : "flex";
  moveList.classList.toggle("has-moves", history.length > 0);

  const rows = [];
  for (let i = 0; i < history.length; i += 2) {
    const whiteMove = history[i];
    const blackMove = history[i + 1];
    const number = Math.floor(i / 2) + 1;
    rows.push(`<li class="move-row">
      <span class="move-index">${number}.</span>
      <span class="move-san ${i === history.length - 1 ? "latest" : ""}">${whiteMove.san}</span>
      <span class="move-san ${i + 1 === history.length - 1 ? "latest" : ""}">${blackMove ? blackMove.san : ""}</span>
    </li>`);
  }
  moveList.innerHTML = rows.join("");
  if (history.length) {
    const wrap = $("move-list-wrap");
    wrap.scrollTop = wrap.scrollHeight;
  }
}

function renderCapturedPieces() {
  const history = game.history({ verbose: true });
  const capturedByWhite = history.filter((move) => move.color === "w" && move.captured).map((move) => PIECES.b[move.captured]);
  const capturedByBlack = history.filter((move) => move.color === "b" && move.captured).map((move) => PIECES.w[move.captured]);
  $("white-captured").textContent = capturedByWhite.join(" ");
  $("black-captured").textContent = capturedByBlack.join(" ");
}

function render() {
  renderBoard();
  renderStatus();
  renderMoveHistory();
  renderCapturedPieces();
}

function clearSelection() {
  selectedSquare = null;
  legalTargets = [];
}

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastElement.classList.remove("show"), 2200);
}

function selectSquare(square) {
  selectedSquare = square;
  legalTargets = game.moves({ square, verbose: true });
  renderBoard();
  renderStatus();
}

function makeMove(from, to, promotion = "q") {
  try {
    const move = game.move({ from, to, promotion });
    if (!move) return false;
    clearSelection();
    closePromotion();
    render();
    return true;
  } catch (error) {
    console.error("Move could not be made:", error);
    showToast("That move is not legal.");
    return false;
  }
}

function openPromotion(moves) {
  pendingPromotion = moves;
  const color = game.turn();
  promotionOptions.innerHTML = moves.map((move) => {
    const name = PIECE_NAMES[move.promotion];
    return `<button class="promotion-choice" type="button" data-promotion="${move.promotion}">
      <span>${PIECES[color][move.promotion]}</span><small>${name}</small>
    </button>`;
  }).join("");
  promotionOverlay.classList.add("open");
  promotionOverlay.setAttribute("aria-hidden", "false");
  promotionOptions.querySelector("button")?.focus();
}

function closePromotion() {
  pendingPromotion = null;
  promotionOverlay.classList.remove("open");
  promotionOverlay.setAttribute("aria-hidden", "true");
}

function onSquareClick(square) {
  if (game.isGameOver() || pendingPromotion) return;
  const piece = game.get(square);

  if (!selectedSquare) {
    if (piece && piece.color === game.turn()) selectSquare(square);
    return;
  }

  if (square === selectedSquare) {
    clearSelection();
    renderBoard();
    renderStatus();
    return;
  }

  const matchingMoves = legalTargets.filter((move) => move.to === square);
  if (matchingMoves.length) {
    if (matchingMoves.some((move) => move.promotion)) {
      openPromotion(matchingMoves);
      return;
    }
    makeMove(selectedSquare, square);
    return;
  }

  if (piece && piece.color === game.turn()) {
    selectSquare(square);
    return;
  }

  clearSelection();
  renderBoard();
  renderStatus();
}

function resetGame() {
  game.reset();
  clearSelection();
  closePromotion();
  flipped = false;
  render();
  showToast("New game started.");
}

function undoMove() {
  if (!game.history().length || pendingPromotion) return;
  game.undo();
  clearSelection();
  render();
  showToast("Last move undone.");
}

function buildPGN() {
  game.setHeader("Event", "Checkmate — Local Chess");
  game.setHeader("Site", "Local Browser Game");
  game.setHeader("White", "White");
  game.setHeader("Black", "Black");
  return game.pgn();
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch (error) {
    console.error("Clipboard access failed:", error);
    showToast("Clipboard access was blocked by your browser.");
  }
}

function downloadPGN() {
  const pgn = buildPGN();
  const blob = new Blob([pgn || "*"], { type: "application/x-chess-pgn;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "my-chess-game.pgn";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("PGN downloaded.");
}

boardElement.addEventListener("click", (event) => {
  const squareButton = event.target.closest("button[data-square]");
  if (squareButton) onSquareClick(squareButton.dataset.square);
});

promotionOptions.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-promotion]");
  if (!button || !pendingPromotion) return;
  const move = pendingPromotion.find((candidate) => candidate.promotion === button.dataset.promotion);
  if (move) makeMove(move.from, move.to, move.promotion);
});

$("cancel-promotion").addEventListener("click", closePromotion);
$("undo-button").addEventListener("click", undoMove);
$("flip-button").addEventListener("click", () => {
  flipped = !flipped;
  renderBoard();
});
$("new-game-button").addEventListener("click", () => {
  confirmOverlay.classList.add("open");
  confirmOverlay.setAttribute("aria-hidden", "false");
});
$("cancel-new-game").addEventListener("click", () => {
  confirmOverlay.classList.remove("open");
  confirmOverlay.setAttribute("aria-hidden", "true");
});
$("confirm-new-game").addEventListener("click", () => {
  confirmOverlay.classList.remove("open");
  confirmOverlay.setAttribute("aria-hidden", "true");
  resetGame();
});
$("copy-pgn-button").addEventListener("click", () => copyText(buildPGN() || "*", "PGN copied to clipboard."));
$("download-pgn-button").addEventListener("click", downloadPGN);
$("copy-fen-button").addEventListener("click", () => copyText(game.fen(), "FEN position copied."));

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (pendingPromotion) closePromotion();
    if (confirmOverlay.classList.contains("open")) {
      confirmOverlay.classList.remove("open");
      confirmOverlay.setAttribute("aria-hidden", "true");
    }
    if (selectedSquare) {
      clearSelection();
      renderBoard();
      renderStatus();
    }
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoMove();
  }
});

render();
}
