import { Chess } from "chess.js";

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/* Piece-square tables, a8 -> h1 (rank 8 first), from White's point of view. */
const PST = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

/** Material + piece-square score from White's perspective. */
function evaluateWhite(chess) {
  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const table = PST[sq.type];
      const idx = sq.color === "w" ? r * 8 + c : (7 - r) * 8 + c;
      const v = VALUE[sq.type] + table[idx];
      score += sq.color === "w" ? v : -v;
    }
  }
  return score;
}

function evalSide(chess) {
  const s = evaluateWhite(chess);
  return chess.turn() === "w" ? s : -s;
}

function gain(move) {
  let g = 0;
  if (move.captured) g += VALUE[move.captured] + 100 - VALUE[move.piece] / 10;
  if (move.promotion) g += VALUE[move.promotion];
  return g;
}

function orderMoves(moves) {
  return moves.sort((a, b) => gain(b) - gain(a));
}

const MAX_Q = 3;

function quiesce(chess, alpha, beta, ply) {
  const stand = evalSide(chess);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (ply >= MAX_Q) return alpha;

  const caps = orderMoves(
    chess.moves({ verbose: true }).filter((m) => m.captured || m.promotion),
  );
  for (const m of caps) {
    chess.move(m);
    const score = -quiesce(chess, -beta, -alpha, ply + 1);
    chess.undo();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(chess, depth, alpha, beta, ply) {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return chess.isCheck() ? -100000 + ply : 0;
  if (chess.isDraw()) return 0;
  if (depth === 0) return quiesce(chess, alpha, beta, 0);

  orderMoves(moves);
  let best = -Infinity;
  for (const m of moves) {
    chess.move(m);
    const score = -negamax(chess, depth - 1, -beta, -alpha, ply + 1);
    chess.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

const DIFFICULTY = {
  easy: { depth: 1, noise: 70, randomness: 130, blunder: 0.22 },
  medium: { depth: 2, noise: 12, randomness: 0 },
  hard: { depth: 3, noise: 0, randomness: 0, blunder: 0 },
};

function toMove(m) {
  return { from: m.from, to: m.to, promotion: m.promotion || null };
}

/** Pure synchronous search. Returns { from, to, promotion } or null. */
export function findBestMove(fen, difficulty = "medium") {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  const cfg = DIFFICULTY[difficulty] || DIFFICULTY.medium;

  if (cfg.blunder && Math.random() < cfg.blunder) {
    const quiet = moves.filter((m) => !m.captured);
    const pool = quiet.length ? quiet : moves;
    return toMove(pool[Math.floor(Math.random() * pool.length)]);
  }

  orderMoves(moves);
  const scored = [];
  let bestScore = -Infinity;

  for (const m of moves) {
    chess.move(m);
    let score = -negamax(chess, cfg.depth - 1, -Infinity, Infinity, 1);
    chess.undo();
    if (cfg.noise) score += (Math.random() - 0.5) * cfg.noise;
    scored.push({ move: m, score });
    if (score > bestScore) bestScore = score;
  }

  if (cfg.randomness) {
    const pool = scored.filter((s) => s.score >= bestScore - cfg.randomness);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return toMove(pick.move);
  }

  scored.sort((a, b) => b.score - a.score);
  return toMove(scored[0].move);
}
