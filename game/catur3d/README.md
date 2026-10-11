# 3D Chess — Interactive Board

A modern, responsive, high-performance 3D chess game built with **Next.js**, **React Three Fiber (Three.js)** and **chess.js**. Play against an AI (Easy / Medium / Hard) or pass-and-play locally on the same device.

---

## 1. Libraries to install

All of these are already declared in `package.json`. To install from scratch:

```bash
npm install next react react-dom three @react-three/fiber @react-three/drei chess.js gsap
```

| Package | Role |
| --- | --- |
| `next` | App framework (App Router, bundler, dev server) |
| `react` / `react-dom` | UI runtime |
| `three` | WebGL 3D engine |
| `@react-three/fiber` | React renderer for Three.js (declarative R3F) |
| `@react-three/drei` | Helpers: `OrbitControls`, `Environment`, `Lightformer`, `ContactShadows` |
| `chess.js` | Full chess rules: legal moves, check/checkmate, castling, en passant, promotion, draw |
| `gsap` | Tweened camera transitions (smooth "Reset Camera" animation) |

> No external image/font assets are required — all wood/marble **PBR textures are generated procedurally on a `<canvas>`** at runtime (see `lib/textures.js`).

## 2. Run it

```bash
npm install      # install dependencies
npm run dev      # http://localhost:3000/game/catur3d/
```

Production:

```bash
npm run build
npm run start
```

## 3. Controls

- **Left-drag** — orbit / rotate the board
- **Right-drag** (or two-finger drag) — pan
- **Scroll / pinch** — zoom
- **Click a piece** — select it (glowing highlight + legal-move hints)
- **Click a glowing square** — move there
- **🎥 button** — reset camera to the ideal view
- **🔊 / 🔇** — toggle sound effects

## 4. Features

**Pre-game menu** — Player vs AI (Easy / Medium / Hard, choose White / Black / Random) or local 2-player. A modal appears before the board is interactive.

**3D rendering** — marble & wood board with a wooden frame, 32 procedurally-modelled pieces (lathe profiles + an extruded horse-head knight) using `MeshStandardMaterial` with color + roughness maps and an image-based lighting environment for realistic PBR shading.

**Lighting** — ambient + hemisphere fill, a shadow-casting directional key light, a soft rim light, `ContactShadows` and soft (PCF) shadow maps.

**Gameplay** — full `chess.js` rules, click-to-select with legal-move dots (green) and capture rings (red), smooth lerp/arc move animations, fade-out on capture, spawn pop on promotion/undo, and a promotion picker.

**AI** — minimax + alpha-beta pruning + quiescence search with piece-square-table evaluation, running in a **Web Worker** (`lib/ai.worker.js`) so the UI never freezes. The worker falls back to a synchronous search if Workers are unavailable. A short "thinking" delay precedes each move.

**HUD** — floating glass panels: whose turn it is, status (Check / Checkmate / Draw / Stalemate / Thinking), move history in algebraic notation, captured pieces with material advantage, plus New Game / Reset / Undo / Reset Camera / Sound controls and a game-over result card.

**Responsiveness & cleanup** — the canvas auto-resizes with the window; the AI worker is terminated, Web Audio nodes closed, pointer listeners removed and Three.js geometries/materials/textures disposed on unmount.

## 5. Project structure

```
game/catur3d/
├─ app/
│  ├─ layout.jsx            # Root layout + metadata
│  ├─ page.jsx              # Loads ChessApp client-only (ssr: false)
│  └─ globals.css           # Design system: HUD, modal, buttons, responsive rules
├─ components/
│  ├─ ChessApp.jsx          # Top-level: game hook + modal + drag detection + result card
│  ├─ GameCanvas.jsx        # <Canvas> config (shadows, dpr, tone mapping)
│  ├─ Scene.jsx             # Lights, environment, materials, pieces, camera rig
│  ├─ Board.jsx             # 64 squares, wooden frame, highlights
│  ├─ Piece.jsx             # One piece: lerp/arc animation + highlight + click
│  ├─ HUD.jsx               # Turn, status, captured, history, controls, promotion picker
│  └─ PreGameModal.jsx      # Mode / difficulty / colour selection
└─ lib/
   ├─ board.js              # Square↔3D mapping, glyphs, piece values
   ├─ textures.js           # Procedural wood/marble color + roughness maps
   ├─ pieceGeometry.js      # Lathe profiles + extruded knight geometry cache
   ├─ useChessGame.js       # chess.js state, piece reconciliation, AI scheduling, undo
   ├─ chessEngine.js        # Pure minimax engine (also used by the worker)
   ├─ ai.worker.js          # Web Worker wrapper around chessEngine
   └─ sound.js              # Web Audio sound effects
```

### How smooth animation works

`chess.js` only knows about squares. To animate pieces we keep persistent piece objects with stable ids and **reconcile** them against the new board after every move (`reconcile()` in `lib/useChessGame.js`): pieces that stay keep their id, the moving piece is matched to its new square and lerps there, promotions reuse the promoting pawn, and captured pieces are flagged and fade out. This automatically handles castling, en passant, promotion and undo.

## 6. Optional: swap in Stockfish

The engine interface is intentionally isolated. To use Stockfish instead:

1. Add `stockfish` (or `stockfish.js`) and copy the `.js`/`.wasm` files into `public/`.
2. Replace the body of `lib/ai.worker.js` — instantiate Stockfish, send the FEN with a skill level mapped from Easy/Medium/Hard, and `postMessage` back `{ from, to, promotion }` in the same shape returned by `findBestMove`.
3. Nothing else changes: the UI already talks to the worker through `requestAIMove()`.

## 7. Deploy into the portfolio (sub-folder)

This project lives inside the static portfolio at `porto/game/catur3d/`, and the
portfolio folder (`porto/`) is the site root. The game is therefore served from
`/game/catur3d/` — this is set as `basePath`/`assetPrefix` in `next.config.mjs`.

```bash
npm run build
```

`npm run build` exports the static site with Next, then `scripts/postbuild.mjs`
publishes the exported files (including **`catur3d.html`**) directly into this
folder, so they land at the URL the portfolio links to:

```
porto/game/catur3d/catur3d.html      <-- the game page (linked from porto/index.html)
porto/game/catur3d/_next/...         (JS/CSS/worker chunks)
porto/game/catur3d/index.html
porto/game/catur3d/404.html
```

The card in `porto/index.html` links to it with a relative URL:

```html
<a href="game/catur3d/catur3d.html">Catur 3D — Play vs AI</a>
```

### Changing the URL / folder

`basePath` defaults to `/game/catur3d`. Override it before building (must start
with `/`) if you rename/move the folder:

```powershell
# PowerShell
$env:NEXT_BASE_PATH="/new/path"; npm run build
```
```cmd
:: CMD
set NEXT_BASE_PATH=/new/path && npm run build
```

For **GitHub Pages** project sites the base path usually includes the repo name;
if `porto` is deployed under a repo sub-path, include it too (e.g.
`/my-repo/game/catur3d`).

> Notes
> - Must be served over **HTTP(S)**, not opened via `file://` (Web Workers/modules require a server). Any static host works: cPanel/Apache, Nginx, Netlify, Vercel, GitHub Pages.
> - `out/` is only a temporary staging folder — the postbuild step moves its contents up into this folder and deletes it.
> - After changing `NEXT_BASE_PATH`, re-run `npm run build`.
> - `npm run dev` serves locally at `http://localhost:3000/game/catur3d/`.

