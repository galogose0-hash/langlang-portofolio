import { findBestMove } from "./chessEngine";

self.onmessage = (event) => {
  const { fen, difficulty, requestId } = event.data || {};
  try {
    const move = findBestMove(fen, difficulty);
    self.postMessage({ type: "move", move, requestId });
  } catch (err) {
    self.postMessage({ type: "error", error: String(err), requestId });
  }
};
