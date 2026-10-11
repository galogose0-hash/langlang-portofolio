"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { findBestMove } from "./chessEngine";
import { Sound } from "./sound";
import { PIECE_VALUES } from "./board";

/* ------------------------------------------------------------------ *
 * Piece reconciliation                                                *
 * ------------------------------------------------------------------ *
 * chess.js only exposes squares, but for smooth 3D animation we keep  *
 * persistent piece objects with stable ids. Every time the position   *
 * changes we match the new board against the previous one so that     *
 * moving pieces keep their identity (and therefore lerp smoothly),    *
 * captured pieces are flagged for a fade-out, and promotions reuse    *
 * the promoting pawn.
 * ------------------------------------------------------------------ */

function squareDistance(a, b) {
  const df = a.charCodeAt(0) - b.charCodeAt(0);
  const dr = parseInt(a[1], 10) - parseInt(b[1], 10);
  return Math.hypot(df, dr);
}

function targetSquares(chess) {
  const out = [];
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell) out.push({ square: cell.square, type: cell.type, color: cell.color });
    }
  }
  return out;
}

function reconcile(prev, chess, nextId) {
  const targets = targetSquares(chess);
  const alive = prev.filter((p) => !p.dead);
  const takenIds = new Set();
  const takenSquares = new Set();
  const result = [];

  // Pass 1: pieces that did not move keep their identity.
  for (const t of targets) {
    const match = alive.find(
      (p) =>
        !takenIds.has(p.id) &&
        p.square === t.square &&
        p.type === t.type &&
        p.color === t.color,
    );
    if (match) {
      takenIds.add(match.id);
      takenSquares.add(t.square);
      result.push({ ...match, dead: false, spawn: false });
    }
  }

  // Pass 2: reuse the closest same-colour piece (handles moves, castling,
  // promotions, undos). Falls back to spawning a brand new piece.
  for (const t of targets) {
    if (takenSquares.has(t.square)) continue;
    const candidates = alive
      .filter((p) => !takenIds.has(p.id) && p.color === t.color)
      .sort((a, b) => {
        const sa = a.type === t.type ? 0 : 1;
        const sb = b.type === t.type ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return squareDistance(a.square, t.square) - squareDistance(b.square, t.square);
      });
    if (candidates.length) {
      const chosen = candidates[0];
      takenIds.add(chosen.id);
      takenSquares.add(t.square);
      result.push({
        ...chosen,
        square: t.square,
        type: t.type,
        dead: false,
        spawn: false,
      });
    } else {
      takenSquares.add(t.square);
      result.push({
        id: nextId(),
        square: t.square,
        type: t.type,
        color: t.color,
        dead: false,
        spawn: true,
      });
    }
  }

  // Anything alive but not found on the new board was captured.
  for (const p of alive) {
    if (!takenIds.has(p.id)) result.push({ ...p, dead: true, spawn: false });
  }

  return result;
}

function freshPieces(chess, nextId) {
  return targetSquares(chess).map((t) => ({
    id: nextId(),
    square: t.square,
    type: t.type,
    color: t.color,
    dead: false,
    spawn: true,
  }));
}

function computeStatus(chess) {
  const gameOver = chess.isGameOver();
  const checkmate = chess.isCheckmate();
  const stalemate = chess.isStalemate();
  const draw = chess.isDraw() && !checkmate;
  let winner = null;
  if (checkmate) winner = chess.turn() === "w" ? "b" : "w";
  return {
    turn: chess.turn(),
    check: chess.isCheck() && !checkmate,
    checkmate,
    stalemate,
    draw,
    gameOver,
    winner,
  };
}

function computeCaptured(chess) {
  const captured = [];
  for (const mv of chess.history({ verbose: true })) {
    if (mv.captured) captured.push({ type: mv.captured, color: mv.color === "w" ? "b" : "w" });
  }
  let white = 0;
  let black = 0;
  for (const c of captured) {
    if (c.color === "w") white += PIECE_VALUES[c.type] || 0;
    else black += PIECE_VALUES[c.type] || 0;
  }
  return { list: captured, advantage: white - black };
}

export function useChessGame() {
  const gameRef = useRef(null);
  const idRef = useRef(0);
  const workerRef = useRef(null);
  const reqIdRef = useRef(0);
  const epochRef = useRef(0);
  const aiLockRef = useRef(false);

  if (!gameRef.current) gameRef.current = new Chess();

  const [pieces, setPieces] = useState(() => freshPieces(gameRef.current, () => ++idRef.current));
  const [historyItems, setHistoryItems] = useState([]);
  const [status, setStatus] = useState(() => computeStatus(gameRef.current));
  const [captured, setCaptured] = useState(() => computeCaptured(gameRef.current));
  const [lastMove, setLastMove] = useState(null);
  const [fen, setFen] = useState(() => gameRef.current.fen());

  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [pendingPromotion, setPendingPromotion] = useState(null);

  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState("pvc");
  const [difficulty, setDifficulty] = useState("medium");
  const [playerColor, setPlayerColor] = useState("w");
  const [thinking, setThinking] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const nextId = useCallback(() => ++idRef.current, []);

  const refresh = useCallback((mv) => {
    const chess = gameRef.current;
    setHistoryItems(
      chess.history({ verbose: true }).map((m) => ({
        san: m.san,
        color: m.color,
        from: m.from,
        to: m.to,
      })),
    );
    setStatus(computeStatus(chess));
    setCaptured(computeCaptured(chess));
    setFen(chess.fen());
    if (mv) setLastMove({ from: mv.from, to: mv.to });
  }, []);

  /* ---- worker lifecycle (clean disposal on unmount) ---- */
  useEffect(() => {
    let worker = null;
    try {
      worker = new Worker(new URL("./ai.worker.js", import.meta.url));
      worker.onerror = () => {};
    } catch (err) {
      worker = null;
    }
    workerRef.current = worker;
    return () => {
      if (worker) worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const requestAIMove = useCallback((positionFen, level) => {
    return new Promise((resolve) => {
      const worker = workerRef.current;
      if (!worker) {
        setTimeout(() => resolve(findBestMove(positionFen, level)), 0);
        return;
      }
      const requestId = ++reqIdRef.current;
      let settled = false;
      const finish = (move) => {
        if (settled) return;
        settled = true;
        worker.removeEventListener("message", onMessage);
        clearTimeout(fallbackTimer);
        resolve(move);
      };
      const onMessage = (event) => {
        if (event.data?.requestId !== requestId) return;
        finish(event.data.move || null);
      };
      // Safety net: if the worker dies/never answers, fall back to the
      // synchronous engine so the game never gets stuck.
      const fallbackTimer = setTimeout(() => finish(findBestMove(positionFen, level)), 6000);
      worker.addEventListener("message", onMessage);
      worker.postMessage({ type: "search", fen: positionFen, difficulty: level, requestId });
    });
  }, []);

  /* ---- applying a move ---- */
  const applyMove = useCallback(
    (moveInput) => {
      const chess = gameRef.current;
      if (chess.isGameOver()) return false;
      let mv = null;
      try {
        mv = chess.move(moveInput);
      } catch (err) {
        mv = null;
      }
      if (!mv) return false;

      setPieces((prev) => reconcile(prev, chess, nextId));
      refresh(mv);
      setSelected(null);
      setLegalMoves([]);

      const flags = mv.flags || "";
      if (mv.promotion) Sound.promote(soundOn);
      else if (flags.includes("c") || flags.includes("e")) Sound.capture(soundOn);
      else if (flags.includes("k") || flags.includes("q")) Sound.castle(soundOn);
      else Sound.move(soundOn);

      const nowStatus = computeStatus(chess);
      if (nowStatus.checkmate || nowStatus.draw) Sound.gameOver(soundOn);
      else if (nowStatus.check) setTimeout(() => Sound.check(soundOn), 120);

      return true;
    },
    [nextId, refresh, soundOn],
  );

  /* ---- selection / interaction ---- */
  const canControl = useCallback(
    (color) => {
      if (status.gameOver || thinking) return false;
      if (mode === "pvp") return color === gameRef.current.turn();
      return color === playerColor && gameRef.current.turn() === playerColor;
    },
    [status.gameOver, thinking, mode, playerColor],
  );

  const onSquareClick = useCallback(
    (square) => {
      if (status.gameOver) return;
      const chess = gameRef.current;
      const turn = chess.turn();
      const myColor = mode === "pvp" ? turn : playerColor;

      // moving onto a highlighted legal square
      if (selected) {
        const target = legalMoves.find((m) => m.to === square);
        if (target) {
          if (target.promotion) {
            setPendingPromotion({ from: selected, to: square, color: myColor });
          } else {
            applyMove({ from: selected, to: square });
          }
          return;
        }
      }

      const piece = chess.get(square);
      if (piece && piece.color === myColor && canControl(piece.color)) {
        if (selected === square) {
          setSelected(null);
          setLegalMoves([]);
          return;
        }
        setSelected(square);
        const moves = chess.moves({ square, verbose: true }).map((m) => ({
          to: m.to,
          capture: !!m.captured,
          promotion: !!m.promotion,
        }));
        setLegalMoves(moves);
        Sound.select(soundOn);
        return;
      }

      setSelected(null);
      setLegalMoves([]);
    },
    [status.gameOver, selected, legalMoves, mode, playerColor, canControl, applyMove, soundOn],
  );

  const choosePromotion = useCallback(
    (piece) => {
      if (!pendingPromotion) return;
      applyMove({
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion: piece,
      });
      setPendingPromotion(null);
    },
    [pendingPromotion, applyMove],
  );

  /* ---- AI turn scheduling ---- */
  useEffect(() => {
    if (!started || mode !== "pvc" || status.gameOver) return;
    const chess = gameRef.current;
    if (chess.turn() === playerColor) {
      aiLockRef.current = false;
      return;
    }
    if (aiLockRef.current) return;
    aiLockRef.current = true;
    setThinking(true);
    const epoch = epochRef.current;
    const delay = 500 + Math.random() * 500;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const positionFen = gameRef.current.fen();
      const move = await requestAIMove(positionFen, difficulty);
      if (cancelled || epoch !== epochRef.current) return;
      setThinking(false);
      if (move) applyMove(move);
      else aiLockRef.current = false;
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      aiLockRef.current = false;
      setThinking(false);
    };
  }, [started, mode, playerColor, difficulty, status.gameOver, fen, requestAIMove, applyMove]);

  /* ---- controls ---- */
  const undo = useCallback(() => {
    const chess = gameRef.current;
    if (chess.history().length === 0 || thinking) return;
    epochRef.current += 1;
    aiLockRef.current = false;
    let times = 1;
    if (mode === "pvc") {
      times = chess.turn() === playerColor ? 2 : 1;
    }
    while (times > 0 && chess.history().length > 0) {
      chess.undo();
      times -= 1;
    }
    setPieces((prev) => reconcile(prev, chess, () => ++idRef.current));
    setSelected(null);
    setLegalMoves([]);
    setPendingPromotion(null);
    const last = chess.history({ verbose: true });
    setLastMove(last.length ? { from: last[last.length - 1].from, to: last[last.length - 1].to } : null);
    refresh(null);
  }, [thinking, mode, playerColor, refresh]);

  const resetGame = useCallback(
    (config) => {
      epochRef.current += 1;
      aiLockRef.current = false;
      const chess = new Chess();
      gameRef.current = chess;
      idRef.current = 0;
      if (config) {
        setMode(config.mode);
        setDifficulty(config.difficulty);
        setPlayerColor(config.color);
      }
      setPieces(freshPieces(chess, () => ++idRef.current));
      setHistoryItems([]);
      setStatus(computeStatus(chess));
      setCaptured(computeCaptured(chess));
      setLastMove(null);
      setFen(chess.fen());
      setSelected(null);
      setLegalMoves([]);
      setPendingPromotion(null);
      setThinking(false);
      setStarted(true);
    },
    [],
  );

  const removePiece = useCallback((id) => {
    setPieces((prev) => prev.filter((p) => !(p.id === id && p.dead)));
  }, []);

  const orientation = mode === "pvc" ? playerColor : "w";

  const turnLabel = useMemo(() => (status.turn === "w" ? "White" : "Black"), [status.turn]);

  return {
    // state
    pieces,
    historyItems,
    status,
    captured,
    lastMove,
    fen,
    selected,
    legalMoves,
    pendingPromotion,
    started,
    mode,
    difficulty,
    playerColor,
    thinking,
    soundOn,
    orientation,
    turnLabel,
    // actions
    onSquareClick,
    choosePromotion,
    undo,
    resetGame,
    removePiece,
    setSoundOn,
    setStarted,
    applyMove,
  };
}
