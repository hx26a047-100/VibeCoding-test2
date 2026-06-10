export type TileType = 0 | 1 | 2 | 3 | 4 | 5;

export interface Tile {
  id: string; // Unique ID for key-based animations
  row: number;
  col: number;
  type: TileType;
  isMatched: boolean;
  isHighlighted?: boolean;
}

export type GameState = 'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export interface MultiplierSetting {
  type: 'linear' | 'steep' | 'fever' | 'custom';
  coefficient: number; // custom addition per combo step, e.g., 0.5
}

export interface ScoreHistory {
  id: string;
  name: string;
  score: number;
  maxCombo: number;
  multiplierType: string;
  date: string;
  duration?: number;
}

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  matchesCount: number;
  tilesCleared: number;
}
