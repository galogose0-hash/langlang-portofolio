"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GameCanvas from "./GameCanvas";
import HUD from "./HUD";
import PreGameModal from "./PreGameModal";
import { useChessGame } from "@/lib/useChessGame";

export default function ChessApp() {
  const game = useChessGame();
  const [showModal, setShowModal] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const dragRef = useRef(false);

  /* Distinguish an orbit-drag from a click so dragging never selects. */
  useEffect(() => {
    let down = false;
    let sx = 0;
    let sy = 0;
    const onDown = (e) => {
      down = true;
      sx = e.clientX;
      sy = e.clientY;
      dragRef.current = false;
    };
    const onMove = (e) => {
      if (down && Math.hypot(e.clientX - sx, e.clientY - sy) > 7) dragRef.current = true;
    };
    const onUp = () => {
      down = false;
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  useEffect(() => {
    if (!game.status.gameOver) setDismissed(false);
  }, [game.status.gameOver]);

  const handleStart = useCallback(
    (config) => {
      game.resetGame(config);
      setShowModal(false);
      setResetSignal((s) => s + 1);
    },
    [game],
  );

  const handleOpenMenu = useCallback(() => setShowModal(true), []);

  const handleReset = useCallback(() => {
    game.resetGame();
    setShowModal(false);
    setResetSignal((s) => s + 1);
  }, [game]);

  const handleResetCamera = useCallback(() => setResetSignal((s) => s + 1), []);

  const over = game.started && game.status.gameOver && !showModal && !dismissed;
  const winnerLabel = game.status.winner === "w" ? "White" : "Black";

  return (
    <div className="app-root">
      <div className="canvas-layer">
        <GameCanvas
          pieces={game.pieces}
          selected={game.selected}
          legalMoves={game.legalMoves}
          lastMove={game.lastMove}
          orientation={game.orientation}
          onSquareClick={game.onSquareClick}
          onPieceDead={game.removePiece}
          resetSignal={resetSignal}
          dragRef={dragRef}
        />
      </div>

      {game.started && (
        <HUD
          game={game}
          onOpenMenu={handleOpenMenu}
          onReset={handleReset}
          onResetCamera={handleResetCamera}
        />
      )}

      {over && (
        <div className="toast panel">
          <h2>{game.status.winner ? `${winnerLabel} wins!` : "Draw"}</h2>
          <p>{game.status.checkmate ? "Checkmate" : game.status.stalemate ? "Stalemate" : "Game over"}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
            <button type="button" className="btn primary" onClick={handleReset}>
              Play again
            </button>
            <button type="button" className="btn" onClick={handleOpenMenu}>
              Menu
            </button>
            <button type="button" className="btn" onClick={() => setDismissed(true)}>
              Close
            </button>
          </div>
        </div>
      )}

      <PreGameModal
        open={showModal}
        canClose={game.started}
        initial={{ mode: game.mode, difficulty: game.difficulty, color: game.playerColor }}
        onStart={handleStart}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}
