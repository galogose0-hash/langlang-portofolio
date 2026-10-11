export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8];

export const SQUARE_SIZE = 1;
export const BOARD_ORIGIN_Y = 0;

/**
 * Convert an algebraic square (e.g. "e4") to a 3D position on the board.
 * White sits at +Z, so rank 1 is closest to the default camera.
 */
export function squareToPosition(square) {
  const file = square.charCodeAt(0) - 97; // a -> 0
  const rank = parseInt(square[1], 10); // 1..8
  const x = file - 3.5;
  const z = 3.5 - (rank - 1);
  return [x, BOARD_ORIGIN_Y, z];
}

export function positionToSquare([x, , z]) {
  const file = Math.round(x + 3.5);
  const rank = Math.round(3.5 - z) + 1;
  return `${FILES[file]}${rank}`;
}

export function isDarkSquare(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1], 10) - 1;
  return (file + rank) % 2 === 0;
}

const GLYPHS = {
  p: "\u265F",
  n: "\u265E",
  b: "\u265D",
  r: "\u265C",
  q: "\u265B",
  k: "\u265A",
};

/** Unicode chess glyph for a piece type. */
export function pieceGlyph(type) {
  return GLYPHS[type] || "";
}

export const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export const PIECE_NAMES = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};
