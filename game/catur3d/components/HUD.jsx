"use client";

import { pieceGlyph } from "@/lib/board";

function StatusPill({ status, thinking }) {
  if (status.checkmate) {
    const winner = status.winner === "w" ? "White" : "Black";
    return <span className="status-pill checkmate">Checkmate · {winner} wins</span>;
  }
  if (status.draw) {
    const reason = status.stalemate ? "Stalemate" : "Draw";
    return <span className="status-pill draw">{reason}</span>;
  }
  if (status.check) return <span className="status-pill check">Check!</span>;
  if (thinking) return <span className="status-pill thinking">Thinking…</span>;
  return null;
}

function CapturedRow({ label, glyphs, colorClass, bonus }) {
  return (
    <div className="captured-row">
      <span className="who">{label}</span>
      <span className="captured-glyphs">
        {glyphs.length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>—</span>
        ) : (
          glyphs.map((g, i) => (
            <span key={i} className={colorClass}>
              {g}
            </span>
          ))
        )}
      </span>
      {bonus ? <span className="adv">+{bonus}</span> : null}
    </div>
  );
}

export default function HUD({ game, onOpenMenu, onReset, onResetCamera }) {
  const {
    status,
    turnLabel,
    historyItems,
    captured,
    thinking,
    mode,
    playerColor,
    difficulty,
    soundOn,
    setSoundOn,
    pendingPromotion,
    choosePromotion,
  } = game;

  const byWhite = captured.list.filter((c) => c.color === "b").map((c) => pieceGlyph(c.type));
  const byBlack = captured.list.filter((c) => c.color === "w").map((c) => pieceGlyph(c.type));
  const adv = captured.advantage;

  const pairs = [];
  for (let i = 0; i < historyItems.length; i += 2) {
    pairs.push([historyItems[i], historyItems[i + 1]]);
  }
  const lastIndex = historyItems.length - 1;

  return (
    <div className="hud">
      <div className="topbar">
        <div className="panel turn-card">
          <div className={`turn-dot${status.turn === "b" ? " black" : ""}`} />
          <div className="turn-meta">
            <span className="label">{status.gameOver ? "Game over" : "Turn"}</span>
            <span className="value">
              {turnLabel}
              {mode === "pvc" ? (status.turn === playerColor ? " · You" : " · AI") : ""}
            </span>
            <StatusPill status={status} thinking={thinking} />
          </div>
        </div>

        <div className="panel controls">
          <button type="button" className="btn" onClick={onOpenMenu}>
            {"\u2699"} New Game
          </button>
          <button type="button" className="btn" onClick={onReset} title="Restart with same settings">
            {"\u21BB"} Reset
          </button>
          <button
            type="button"
            className="btn"
            onClick={game.undo}
            disabled={historyItems.length === 0 || thinking}
          >
            {"\u21B6"} Undo
          </button>
          <button type="button" className="btn icon" onClick={onResetCamera} title="Reset camera view">
            {"\u{1F3A5}"}
          </button>
          <button
            type="button"
            className={`btn icon${soundOn ? " active" : ""}`}
            onClick={() => setSoundOn((s) => !s)}
            title="Toggle sound"
          >
            {soundOn ? "\u{1F50A}" : "\u{1F507}"}
          </button>
        </div>
      </div>

      <div className="panel captured">
        <h4>Captured pieces</h4>
        <CapturedRow
          label="White"
          glyphs={byWhite}
          colorClass="pb"
          bonus={adv > 0 ? adv : 0}
        />
        <CapturedRow
          label="Black"
          glyphs={byBlack}
          colorClass="pw"
          bonus={adv < 0 ? -adv : 0}
        />
        <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--text-dim)", letterSpacing: 0.3 }}>
          {mode === "pvc" ? `vs AI · ${difficulty}` : "Local 2P"}
        </div>
      </div>

      <div className="panel history">
        <h4>Moves</h4>
        <div className="hist-scroll">
          {pairs.length === 0 ? (
            <div className="hist-empty">No moves yet</div>
          ) : (
            <div className="hist-grid">
              {pairs.map((pair, i) => (
                <div key={i} style={{ display: "contents" }}>
                  <span className="num">{i + 1}.</span>
                  <span className={`mv${i * 2 === lastIndex ? " last" : ""}`}>
                    {pair[0]?.san || ""}
                  </span>
                  <span className={`mv${i * 2 + 1 === lastIndex ? " last" : ""}`}>
                    {pair[1]?.san || ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {pendingPromotion && (
        <div className="overlay" style={{ zIndex: 30 }}>
          <div className="modal" style={{ maxWidth: 360 }}>
            <div className="modal-head" style={{ marginBottom: 12 }}>
              <div className="modal-logo" aria-hidden>
                {"\u265B"}
              </div>
              <div>
                <h1 style={{ fontSize: 18 }}>Promote pawn</h1>
                <p>Choose a piece</p>
              </div>
            </div>
            <div className="chips" style={{ justifyContent: "center" }}>
              {["q", "r", "b", "n"].map((p) => (
                <button
                  key={p}
                  type="button"
                  className="chip"
                  style={{ fontSize: 30, padding: "10px 20px" }}
                  onClick={() => choosePromotion(p)}
                >
                  {pieceGlyph(p)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
