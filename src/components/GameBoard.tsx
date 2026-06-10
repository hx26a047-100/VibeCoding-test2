import React, { useState, useRef, useEffect } from 'react';
import { Tile, TileType } from '../types';
import { isAdjacent } from '../utils/gameCore';
import { Heart, Diamond, Square, Flame, Sparkles, Zap, RefreshCw } from 'lucide-react';
import audio from '../utils/audio';

const TILE_COMPONENTS = {
  0: { icon: Heart, colors: 'from-[#e11d48] to-[#9f1239] text-white shadow-[0_0_12px_rgba(225,29,72,0.3)] border-white/10' },
  1: { icon: Diamond, colors: 'from-[#2563eb] to-[#1e3a8a] text-white shadow-[0_0_12px_rgba(37,99,235,0.3)] border-white/10' },
  2: { icon: Square, colors: 'from-[#16a34a] to-[#14532d] text-white shadow-[0_0_12px_rgba(22,163,74,0.3)] border-white/10' },
  3: { icon: Flame, colors: 'from-[#d97706] to-[#78350f] text-white shadow-[0_0_12px_rgba(217,119,6,0.3)] border-white/10' },
  4: { icon: Sparkles, colors: 'from-[#9333ea] to-[#581c87] text-white shadow-[0_0_12px_rgba(147,51,234,0.3)] border-white/10' },
  5: { icon: Zap, colors: 'from-[#D4AF37] to-[#8a6f27] text-white shadow-[0_0_15px_rgba(212,175,55,0.4)] border-white/20 ring-1 ring-[#D4AF37]/30' },
};

interface GameBoardProps {
  board: Tile[][];
  disabled: boolean;
  onSwapAttempt: (r1: number, c1: number, r2: number, c2: number) => void;
  isShuffling: boolean;
}

export default function GameBoard({ board, disabled, onSwapAttempt, isShuffling }: GameBoardProps) {
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  
  // Drag / swipe states
  const dragStart = useRef<{ r: number; c: number; x: number; y: number } | null>(null);

  // Particle explosion effects
  const [particles, setParticles] = useState<{ id: string; x: number; y: number; color: string; vx: number; vy: number; size: number }[]>([]);

  // Clear selection if board changes or disabled triggers
  useEffect(() => {
    if (disabled) {
      setSelected(null);
    }
  }, [disabled, board]);

  // Handle tile click selection
  const handleTileClick = (r: number, c: number) => {
    if (disabled) return;
    audio.playSelect();

    if (!selected) {
      setSelected({ r, c });
    } else {
      // If same is clicked, deselect
      if (selected.r === r && selected.c === c) {
        setSelected(null);
        audio.playDeselect();
        return;
      }

      // Check if clicked tile is adjacent
      if (isAdjacent(selected.r, selected.c, r, c)) {
        onSwapAttempt(selected.r, selected.c, r, c);
        setSelected(null);
      } else {
        // Change selection to the newly clicked tile
        setSelected({ r, c });
      }
    }
  };

  // Drag start
  const handleDragStart = (r: number, c: number, clientX: number, clientY: number) => {
    if (disabled) return;
    dragStart.current = { r, c, x: clientX, y: clientY };
  };

  // Drag end / direction finder
  const handleDragEnd = (clientX: number, clientY: number) => {
    if (disabled || !dragStart.current) return;
    const { r, c, x: startX, y: startY } = dragStart.current;
    dragStart.current = null;

    const diffX = clientX - startX;
    const diffY = clientY - startY;

    // Minimum drag distance to count as swipe
    const threshold = 35;
    if (Math.abs(diffX) < threshold && Math.abs(diffY) < threshold) {
      return; // Too short, treat as normal click
    }

    let targetR = r;
    let targetC = c;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Horizontal swipe
      targetC = diffX > 0 ? c + 1 : c - 1;
    } else {
      // Vertical swipe
      targetR = diffY > 0 ? r + 1 : r - 1;
    }

    // Swapping bounds safety check
    const rows = board.length;
    const cols = board[0].length;
    if (targetR >= 0 && targetR < rows && targetC >= 0 && targetC < cols) {
      onSwapAttempt(r, c, targetR, targetC);
      setSelected(null);
    }
  };

  // Setup standard mobile listeners for dragging smoothly
  const handleTouchStart = (r: number, c: number, e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragStart(r, c, touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      handleDragEnd(touch.clientX, touch.clientY);
    }
  };

  const handleMouseDown = (r: number, c: number, e: React.MouseEvent) => {
    handleDragStart(r, c, e.clientX, e.clientY);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    handleDragEnd(e.clientX, e.clientY);
  };

  // Trigger matches particles when tiles are deleted
  useEffect(() => {
    const matchedTiles: Tile[] = [];
    board.forEach(row => {
      row.forEach(tile => {
        if (tile.isMatched) {
          matchedTiles.push(tile);
        }
      });
    });

    if (matchedTiles.length > 0) {
      const newParticles: typeof particles = [];
      const particleColors = [
        '#f43f5e', // red
        '#3b82f6', // blue
        '#10b981', // green
        '#f59e0b', // amber
        '#d946ef', // fuchsia
        '#06b6d4', // cyan
      ];

      matchedTiles.forEach(tile => {
        // Tile cell center coordinate percentages
        const tileX = (tile.col + 0.5) * (100 / board[0].length);
        const tileY = (tile.row + 0.5) * (100 / board.length);
        const tileColor = particleColors[tile.type];

        // Spawn 8 exploding particles per tile
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.5 + Math.random() * 2.2;
          newParticles.push({
            id: Math.random().toString(),
            x: tileX,
            y: tileY,
            color: tileColor,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.2, // bias upwards (gravity drift next)
            size: 4 + Math.random() * 5,
          });
        }
      });

      setParticles(prev => [...prev, ...newParticles].slice(0, 120));
    }
  }, [board]);

  // Particle gravity/drift updates
  useEffect(() => {
    if (particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles(prev =>
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx * 0.35,
            y: p.y + p.vy * 0.35 + 0.15, // light gravity pull downwards
            size: p.size * 0.94, // shrink
          }))
          .filter(p => p.size > 0.8 && p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100)
      );
    }, 24);

    return () => clearInterval(interval);
  }, [particles]);

  const rows = board.length;
  const cols = board[0].length;

  return (
    <div className="relative w-full aspect-square max-w-[480px] landscape:max-w-[70vh] lg:landscape:max-w-[480px] mx-auto bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-2.5 landscape:p-1.5 lg:landscape:p-2.5 shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden select-none" id="game-board-container">
      {/* Dynamic Background Accents */}
      <div className="absolute inset-0 bg-radial-gradient from-[#D4AF37]/5 to-transparent pointer-events-none" />

      {/* Grid cells behind (for visual guide) */}
      <div className="absolute inset-2.5 landscape:inset-1.5 lg:landscape:inset-2.5 grid grid-cols-7 grid-rows-7 gap-1.5 landscape:gap-1 lg:landscape:gap-1.5 pointer-events-none" id="background-grid-guide">
        {Array.from({ length: rows * cols }).map((_, i) => (
          <div
            key={i}
            className="bg-white/[0.02] rounded-lg border border-white/5"
          />
        ))}
      </div>

      {/* Active interactive tiles */}
      <div className="absolute inset-2.5 landscape:inset-1.5 lg:landscape:inset-2.5 grid grid-cols-7 grid-rows-7 gap-1.5 landscape:gap-1 lg:landscape:gap-1.5" id="interactive-tiles-layer">
        {board.map((row, r) =>
          row.map((tile) => {
            const isSel = selected?.r === r && selected?.c === tile.col;
            const config = TILE_COMPONENTS[tile.type];
            const TileIcon = config.icon;

            // Compute absolute positioning by percentages for native GPU-accelerated slides
            const topPercent = (tile.row * 100) / rows;
            const leftPercent = (tile.col * 100) / cols;
            const heightPercent = 100 / rows;
            const widthPercent = 100 / cols;

            return (
              <div
                key={tile.id}
                onMouseDown={(e) => handleMouseDown(r, tile.col, e)}
                onMouseUp={handleMouseUp}
                onTouchStart={(e) => handleTouchStart(r, tile.col, e)}
                onTouchEnd={handleTouchEnd}
                onClick={() => handleTileClick(r, tile.col)}
                style={{
                  position: 'absolute',
                  top: `${topPercent}%`,
                  left: `${leftPercent}%`,
                  width: `calc(${widthPercent}% - 6px)`,
                  height: `calc(${heightPercent}% - 6px)`,
                  margin: '3px',
                  transform: tile.isMatched ? 'scale(0)' : 'scale(1)',
                  opacity: tile.isMatched ? 0 : 1,
                  transition: 'top 0.28s cubic-bezier(0.25, 1, 0.5, 1), left 0.28s cubic-bezier(0.25, 1, 0.5, 1), transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out',
                  zIndex: isSel ? 30 : 10,
                }}
                className={`cursor-grab active:cursor-grabbing rounded-xl bg-gradient-to-br flex flex-col items-center justify-center p-1.5 border border-white/20 transition-all duration-300 shadow-md ${
                  config.colors
                } ${
                  isSel
                    ? 'ring-4 ring-[#D4AF37] scale-[1.05] shadow-[0_0_15px_rgba(212,175,55,0.6)]'
                    : 'hover:brightness-110 hover:scale-[1.02]'
                }`}
                id={`tile-${tile.row}-${tile.col}`}
              >
                <TileIcon className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 drop-shadow-md animate-enter transition-transform duration-300 group-hover:scale-110" />
              </div>
            );
          })
        )}
      </div>

      {/* Explosive Match Particles Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-25" id="particles-overlay">
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              boxShadow: `0 0 8px ${p.color}`,
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </div>

      {/* Board Locked/No Moves Shuffling Alert Overlay */}
      {isShuffling && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-40" id="shuffle-overlay">
          <div className="bg-slate-900 border border-slate-700/60 rounded-full p-4 animate-spin shadow-lg text-teal-400 shadow-teal-500/10">
            <RefreshCw className="w-8 h-8" />
          </div>
          <div className="text-center space-y-1">
            <h4 className="text-lg font-bold text-slate-100 font-sans">
              可能な手がありません！
            </h4>
            <p className="text-xs text-slate-400">
              ボードを再配置しています...
            </p>
          </div>
        </div>
      )}

      {/* Game board locked state when animations are executing */}
      {disabled && !isShuffling && (
        <div className="absolute inset-0 bg-transparent pointer-events-auto cursor-wait z-20" />
      )}
    </div>
  );
}
