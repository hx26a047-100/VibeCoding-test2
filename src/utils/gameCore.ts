import { Tile, TileType } from '../types';

const BOARD_ROWS = 7;
const BOARD_COLS = 7;
const TOTAL_TYPES: TileType[] = [0, 1, 2, 3, 4, 5];

// Generate a random tile type
export function getRandomType(): TileType {
  return TOTAL_TYPES[Math.floor(Math.random() * TOTAL_TYPES.length)];
}

// Generate a random string ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Create an initial board with no 3-matches, but with at least one viable swap
export function createNewBoard(): Tile[][] {
  let board: Tile[][] = [];
  let attempts = 0;

  while (attempts < 100) {
    board = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      const rowTiles: Tile[] = [];
      for (let c = 0; c < BOARD_COLS; c++) {
        // Find a type that doesn't create a match-3 immediately
        let type = getRandomType();
        while (
          (r >= 2 && board[r - 1][c].type === type && board[r - 2][c].type === type) ||
          (c >= 2 && rowTiles[c - 1].type === type && rowTiles[c - 2].type === type)
        ) {
          type = getRandomType();
        }

        rowTiles.push({
          id: generateId(),
          row: r,
          col: c,
          type,
          isMatched: false,
        });
      }
      board.push(rowTiles);
    }

    // Ensure there is at least one viable match-3 move to play
    if (hasPossibleMoves(board)) {
      break;
    }
    attempts++;
  }

  return board;
}

// Scan the board and find all tiles that are part of a 3-in-a-row/column match
// Returns coordinates of matched tiles
export function scanMatches(board: Tile[][]): { row: number; col: number }[] {
  const matchedCoords: { row: number; col: number }[] = [];
  const rows = board.length;
  const cols = board[0].length;
  const matchGrid = Array.from({ length: rows }, () => Array(cols).fill(false));

  // Horizontal matches
  for (let r = 0; r < rows; r++) {
    let matchLen = 1;
    let matchType = board[r][0].type;
    let startCol = 0;
    
    for (let c = 1; c <= cols; c++) {
      if (c < cols && board[r][c].type === matchType) {
        matchLen++;
      } else {
        if (matchLen >= 3) {
          for (let m = startCol; m < startCol + matchLen; m++) {
            matchGrid[r][m] = true;
          }
        }
        if (c < cols) {
          matchType = board[r][c].type;
          startCol = c;
          matchLen = 1;
        }
      }
    }
  }

  // Vertical matches
  for (let c = 0; c < cols; c++) {
    let matchLen = 1;
    let matchType = board[0][c].type;
    let startRow = 0;

    for (let r = 1; r <= rows; r++) {
      if (r < rows && board[r][c].type === matchType) {
        matchLen++;
      } else {
        if (matchLen >= 3) {
          for (let m = startRow; m < startRow + matchLen; m++) {
            matchGrid[m][c] = true;
          }
        }
        if (r < rows) {
          matchType = board[r][c].type;
          startRow = r;
          matchLen = 1;
        }
      }
    }
  }

  // Gather coordinates
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (matchGrid[r][c]) {
        matchedCoords.push({ row: r, col: c });
      }
    }
  }

  return matchedCoords;
}

// Groups matched coordinates into distinct clusters of the same adjacent color type
// This enables accurate calculating of scores per grouped match (e.g. T-shape, 4-in-a-row, L-shape)
export interface MatchCluster {
  type: TileType;
  tiles: { row: number; col: number }[];
  size: number;
}

export function findMatchClusters(board: Tile[][], matchedCoords: { row: number; col: number }[]): MatchCluster[] {
  const clusters: MatchCluster[] = [];
  const visited = Array.from({ length: board.length }, () => Array(board[0].length).fill(false));

  const matchedSet = new Set(matchedCoords.map(c => `${c.row},${c.col}`));

  for (const { row, col } of matchedCoords) {
    if (visited[row][col]) continue;

    const tileType = board[row][col].type;
    const clusterTiles: { row: number; col: number }[] = [];
    const queue: { row: number; col: number }[] = [{ row, col }];
    visited[row][col] = true;

    while (queue.length > 0) {
      const current = queue.shift()!;
      clusterTiles.push(current);

      // Check 4 directional neighbors
      const neighbors = [
        { r: current.row - 1, c: current.col },
        { r: current.row + 1, c: current.col },
        { r: current.row, c: current.col - 1 },
        { r: current.row, c: current.col + 1 },
      ];

      for (const n of neighbors) {
        // Must be in bounds
        if (n.r >= 0 && n.r < board.length && n.c >= 0 && n.c < board[0].length) {
          // Must be part of the marked match set
          if (matchedSet.has(`${n.r},${n.c}`)) {
            // Must have the same type, and not be visited
            if (!visited[n.r][n.c] && board[n.r][n.c].type === tileType) {
              visited[n.r][n.c] = true;
              queue.push({ row: n.r, col: n.c });
            }
          }
        }
      }
    }

    if (clusterTiles.length >= 3) {
      clusters.push({
        type: tileType,
        tiles: clusterTiles,
        size: clusterTiles.length,
      });
    }
  }

  return clusters;
}

// Check if two tiles are orthogonally adjacent
export function isAdjacent(r1: number, c1: number, r2: number, c2: number): boolean {
  const rowDiff = Math.abs(r1 - r2);
  const colDiff = Math.abs(c1 - c2);
  return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

// Swaps two items on a virtual board, returns the new temporary board
export function getSwappedBoard(board: Tile[][], r1: number, c1: number, r2: number, c2: number): Tile[][] {
  // Deep clone of board
  const newBoard = board.map(row => row.map(tile => ({ ...tile })));

  // Swap types and IDs so animations track cleanly, but keep coordinates anchored
  const type1 = newBoard[r1][c1].type;
  const id1 = newBoard[r1][c1].id;

  newBoard[r1][c1].type = newBoard[r2][c2].type;
  newBoard[r1][c1].id = newBoard[r2][c2].id;

  newBoard[r2][c2].type = type1;
  newBoard[r2][c2].id = id1;

  return newBoard;
}

// Checks if the board contains any possible single swap moves that create a match-3
export function hasPossibleMoves(board: Tile[][]): boolean {
  const rows = board.length;
  const cols = board[0].length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Try horizontal swap with right neighbor
      if (c + 1 < cols) {
        const swapped = getSwappedBoard(board, r, c, r, c + 1);
        if (scanMatches(swapped).length > 0) return true;
      }
      // Try vertical swap with bottom neighbor
      if (r + 1 < rows) {
        const swapped = getSwappedBoard(board, r, c, r + 1, c);
        if (scanMatches(swapped).length > 0) return true;
      }
    }
  }
  return false;
}

// Slide current tiles downwards to fill in empty gaps (nulls/matched ones)
// and spawn new tiles from the top.
// Returns the new board and list of spawning tiles
export function dropAndFillTiles(board: Tile[][]): {
  newBoard: Tile[][];
  spawnedCount: number;
} {
  const rows = board.length;
  const cols = board[0].length;
  
  // Clone board
  const newBoard = board.map(row => row.map(tile => ({ ...tile })));
  let spawnedCount = 0;

  // Process column by column
  for (let c = 0; c < cols; c++) {
    // Collect non-matched tiles in this column from bottom to top
    const remainingTiles: Omit<Tile, 'row' | 'col'>[] = [];
    for (let r = rows - 1; r >= 0; r--) {
      if (!newBoard[r][c].isMatched) {
        remainingTiles.push({
          id: newBoard[r][c].id,
          type: newBoard[r][c].type,
          isMatched: false,
        });
      }
    }

    // Fill the rest with new tiles
    const needed = rows - remainingTiles.length;
    for (let i = 0; i < needed; i++) {
      remainingTiles.push({
        id: generateId(),
        type: getRandomType(),
        isMatched: false,
      });
      spawnedCount++;
    }

    // Re-assign back to column from bottom to top
    for (let r = rows - 1; r >= 0; r--) {
      const source = remainingTiles[rows - 1 - r];
      newBoard[r][c] = {
        id: source.id,
        row: r,
        col: c,
        type: source.type,
        isMatched: false,
      };
    }
  }

  return { newBoard, spawnedCount };
}

// Safely rearranges tiles on the board to ensure it contains matches,
// while avoiding pre-existing combos and keeping existing block ratios.
// Essentially performs an elegant shuffle until a board with matches is found.
export function shuffleBoard(board: Tile[][]): Tile[][] {
  const rows = board.length;
  const cols = board[0].length;
  
  // Flatten everything
  const allTileTypes = board.flat().map(t => t.type);
  let shuffledBoard = board.map(row => row.map(tile => ({ ...tile })));
  let attempts = 0;

  while (attempts < 100) {
    // Shuffle the type pool
    for (let i = allTileTypes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allTileTypes[i], allTileTypes[j]] = [allTileTypes[j], allTileTypes[i]];
    }

    // Assign back
    let index = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        shuffledBoard[r][c].type = allTileTypes[index++];
        shuffledBoard[r][c].id = generateId();
        shuffledBoard[r][c].isMatched = false;
      }
    }

    // Avoid instant matches but support at least one viable swap move!
    const matches = scanMatches(shuffledBoard);
    if (matches.length === 0 && hasPossibleMoves(shuffledBoard)) {
      break;
    }
    attempts++;
  }

  return shuffledBoard;
}
