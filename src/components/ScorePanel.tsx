import React, { useEffect, useState } from 'react';
import { Clock, Volume2, VolumeX, Award, BarChart3, RotateCcw } from 'lucide-react';
import { GameStats } from '../types';
import audio from '../utils/audio';

interface ScorePanelProps {
  stats: GameStats;
  timeRemaining: number; // in seconds
  totalTime: number; // in seconds
  multiplier: number;
  onRestart: () => void;
  onMuteToggle: () => void;
  isMuted: boolean;
  isTestPlay?: boolean;
}

export default function ScorePanel({
  stats,
  timeRemaining,
  totalTime,
  multiplier,
  onRestart,
  onMuteToggle,
  isMuted,
  isTestPlay = false,
}: ScorePanelProps) {
  // Compute percentage of remaining timer to visually update a bar
  const timePercent = isTestPlay ? 100 : Math.max(0, Math.min(100, (timeRemaining / totalTime) * 100));
  const isTimeLow = !isTestPlay && timeRemaining <= 10;

  // Track state for anim triggers on score increases
  const [prevScore, setPrevScore] = useState(stats.score);
  const [scoreFlash, setScoreFlash] = useState(false);

  useEffect(() => {
    if (stats.score > prevScore) {
      setScoreFlash(true);
      const t = setTimeout(() => setScoreFlash(false), 300);
      setPrevScore(stats.score);
      return () => clearTimeout(t);
    }
    setPrevScore(stats.score);
  }, [stats.score]);

  return (
    <div className="bg-[#0F0F0F]/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 landscape:p-3.5 lg:landscape:p-5 shadow-2xl space-y-4 landscape:space-y-2 lg:landscape:space-y-4" id="score-panel">
      {/* Header with audio control & reset */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2 landscape:pb-1 lg:landscape:pb-2">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-[#D4AF37]" />
          <span className="text-xs font-display italic font-semibold text-[#D4AF37] tracking-wider">Play Stats</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onMuteToggle}
            className={`p-2 rounded-lg border transition-all ${
              isMuted
                ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                : 'bg-white/5 border-white/10 text-zinc-350 hover:bg-white/10'
            }`}
            title={isMuted ? '音を出す' : '消音'}
            id="mute-toggle-btn"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onRestart}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition-all flex items-center gap-1.5 text-xs font-medium"
            id="stat-restart-btn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isTestPlay ? 'テスト終了' : 'リセット'}</span>
          </button>
        </div>
      </div>

      {/* Main Stats: Timer and Score row */}
      <div className="grid grid-cols-2 gap-4 landscape:gap-2 lg:landscape:gap-4">
        {/* Score Counter */}
        <div className="bg-black/40 rounded-xl p-3.5 landscape:p-2 lg:landscape:p-3.5 border border-white/5 flex flex-col justify-center">
          <span className="text-xs font-display italic text-[#D4AF37] tracking-wide block">Current Score</span>
          <span
            className={`text-2xl landscape:text-lg lg:landscape:text-2xl font-mono font-bold tracking-tight mt-1 transition-all duration-150 ${
              scoreFlash ? 'text-[#D4AF37] scale-[1.05]' : 'text-white'
            }`}
            id="score-display"
          >
            {stats.score.toLocaleString()}
          </span>
        </div>

        {/* Multiplier readout */}
        <div className="bg-black/40 rounded-xl p-3.5 landscape:p-2 lg:landscape:p-3.5 border border-white/5 flex flex-col justify-center">
          <span className="text-xs font-display italic text-[#D4AF37] tracking-wide block">Combo Multiplier</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl landscape:text-base lg:landscape:text-2xl font-mono font-bold text-[#D4AF37]" id="multiplier-display">
              {multiplier.toFixed(1)}x
            </span>
            {stats.combo > 1 && (
              <span className="text-[10px] bg-[#D4AF37] text-black font-semibold font-mono tracking-wider px-1.5 py-0.2 rounded uppercase animate-pulse">
                {stats.combo} Combo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Time Remaining Bar */}
      <div className="space-y-1.5 landscape:space-y-0.5 lg:landscape:space-y-1.5" id="timer-bar-group">
        <div className="flex justify-between items-center text-xs">
          <span className="font-display italic text-[#D4AF37] tracking-wider flex items-center gap-1">
            <Clock className={`w-4 h-4 landscape:w-3.5 landscape:h-3.5 lg:landscape:w-4 lg:landscape:h-4 ${isTimeLow ? 'text-red-500 animate-bounce' : 'text-[#D4AF37]'}`} />
            <span>Time Remaining</span>
          </span>
          <span className={`font-mono font-bold ${isTimeLow ? 'text-red-500 animate-pulse text-lg landscape:text-sm lg:landscape:text-lg' : 'text-zinc-200'}`}>
            {isTestPlay ? '無制限' : `${timeRemaining}秒`}
          </span>
        </div>
        <div className="h-3 landscape:h-2 lg:landscape:h-3 bg-black rounded-full overflow-hidden border border-white/5 p-[1.5px]">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              isTimeLow
                ? 'bg-gradient-to-r from-red-650 to-red-500 animate-pulse'
                : 'bg-gradient-to-r from-[#D4AF37] to-amber-600'
            }`}
            style={{ width: `${timePercent}%` }}
          />
        </div>
      </div>

      {/* Detail statistics bento-line */}
      <div className="bg-black/30 rounded-xl p-3 landscape:p-1.5 border border-white/5 grid grid-cols-3 gap-2 landscape:gap-1 text-center" id="advanced-stats-grid">
        <div className="space-y-0.5">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold font-mono">Max Combo</span>
          <div className="font-mono text-sm landscape:text-xs font-bold text-white">{stats.maxCombo}回</div>
        </div>
        <div className="space-y-0.5 border-x border-white/5">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold font-mono">Matches</span>
          <div className="font-mono text-sm landscape:text-xs font-bold text-white">{stats.matchesCount}回</div>
        </div>
        <div className="space-y-0.5">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold font-mono">Cleared</span>
          <div className="font-mono text-sm landscape:text-xs font-bold text-[#D4AF37]">{stats.tilesCleared}個</div>
        </div>
      </div>
    </div>
  );
}
