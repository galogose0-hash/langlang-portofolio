"use client";

import { useState } from "react";

const MODES = [
  {
    id: "pvc",
    emoji: "\u{1F916}",
    title: "Player vs AI",
    desc: "Challenge the computer. Pick a difficulty and your colour.",
  },
  {
    id: "pvp",
    emoji: "\u{1F465}",
    title: "2 Players",
    desc: "Local pass-and-play on the same screen.",
  },
];

const DIFFS = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

const COLORS = [
  { id: "w", label: "White", sw: "#f2efe6" },
  { id: "b", label: "Black", sw: "#2a2f3a" },
  { id: "random", label: "Random", sw: "linear-gradient(135deg,#f2efe6 50%,#2a2f3a 50%)" },
];

export default function PreGameModal({ open, canClose, initial, onStart, onClose }) {
  const [mode, setMode] = useState(initial?.mode || "pvc");
  const [difficulty, setDifficulty] = useState(initial?.difficulty || "medium");
  const [color, setColor] = useState(initial?.color || "w");

  if (!open) return null;

  const start = () => {
    const resolved = color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color;
    onStart({ mode, difficulty, color: resolved });
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-head">
          <div className="modal-logo" aria-hidden>
            {"\u265E"}
          </div>
          <div>
            <h1>3D Chess</h1>
            <p>Choose how you want to play</p>
          </div>
        </div>

        <div className="section-label">Game mode</div>
        <div className="mode-grid">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`mode-card${mode === m.id ? " selected" : ""}`}
              onClick={() => setMode(m.id)}
            >
              <div className="emoji">{m.emoji}</div>
              <div className="title">{m.title}</div>
              <div className="desc">{m.desc}</div>
            </button>
          ))}
        </div>

        {mode === "pvc" && (
          <>
            <div className="section-label">Difficulty</div>
            <div className="chips">
              {DIFFS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`chip${difficulty === d.id ? " selected" : ""}`}
                  onClick={() => setDifficulty(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <div className="section-label">Your colour</div>
            <div className="chips">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip${color === c.id ? " selected" : ""}`}
                  onClick={() => setColor(c.id)}
                >
                  <span className="sw" style={{ background: c.sw }} />
                  {c.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="modal-foot">
          <span className="hint">
            {mode === "pvc"
              ? "Tip: drag to rotate, scroll to zoom."
              : "Players take turns on this device."}
          </span>
          {canClose && (
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
          )}
          <button type="button" className="btn primary big" onClick={start}>
            Start Game
          </button>
        </div>
      </div>
    </div>
  );
}
