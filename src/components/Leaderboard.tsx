import React, { useState, useEffect } from 'react';
import { ScoreHistory } from '../types';
import { Trophy, Calendar, Zap, Sparkles, Trash2 } from 'lucide-react';
import { audio } from '../utils/audio';

interface LeaderboardProps {
  currentScore?: number;
  maxCombo?: number;
  multiplierType?: string;
  onClose?: () => void;
  isTestPlay?: boolean;
  duration?: number;
}

export default function Leaderboard({
  currentScore,
  maxCombo,
  multiplierType,
  onClose,
  isTestPlay = false,
  duration,
}: LeaderboardProps) {
  const [allScores, setAllScores] = useState<ScoreHistory[]>([]);
  const [activeTab, setActiveTab] = useState<number>(60);
  const [playerName, setPlayerName] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Default active tab to current round duration
  useEffect(() => {
    if (duration) {
      setActiveTab(duration);
    }
  }, [duration]);

  const isRegistering = currentScore !== undefined && currentScore > 0 && !hasSubmitted;

  // Force active tab to match play duration during registering to prevent cross-submission
  useEffect(() => {
    if (isRegistering && duration) {
      setActiveTab(duration);
    }
  }, [isRegistering, duration]);

  // Load all scores once
  useEffect(() => {
    const loadedScores = localStorage.getItem('match3_highscores');
    if (loadedScores) {
      try {
        const parsed = JSON.parse(loadedScores) as ScoreHistory[];
        setAllScores(parsed);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSubmitScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !currentScore) return;

    const gameDuration = duration || 60;

    const newRecord: ScoreHistory = {
      id: Math.random().toString(36).substring(2, 9),
      name: playerName.slice(0, 10),
      score: currentScore,
      maxCombo: maxCombo || 1,
      multiplierType: multiplierType || 'linear',
      duration: gameDuration,
      date: new Date().toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const updated = [...allScores, newRecord];
    setAllScores(updated);
    localStorage.setItem('match3_highscores', JSON.stringify(updated));
    setHasSubmitted(true);
    setActiveTab(gameDuration); // Auto switch tab to the played one so user sees their score!
  };

  const clearLeaderboard = () => {
    const modesLabels: Record<number, string> = { 30: 'クイック', 60: 'ノーマル', 120: 'ロング' };
    const activeLabel = modesLabels[activeTab] || 'ノーマル';
    if (window.confirm(`${activeLabel}モードのランキング記録をすべてリセットしますか？`)) {
      const updated = allScores.filter((s) => (s.duration || 60) !== activeTab);
      setAllScores(updated);
      localStorage.setItem('match3_highscores', JSON.stringify(updated));
    }
  };

  const getMultiplierLabel = (type: string) => {
    switch (type) {
      case 'linear': return 'リニア (+0.5x)';
      case 'steep': return '急上昇 (+1.0x)';
      case 'fever': return 'フィーバー (+1.5x)';
      default: return 'カスタム';
    }
  };

  const modes = [
    { label: 'クイック (30秒)', value: 30 },
    { label: 'ノーマル (60秒)', value: 60 },
    { label: 'ロング (120秒)', value: 120 },
  ];

  // Filter display scores for active tab
  const displayScores = allScores
    .filter((s) => (s.duration || 60) === activeTab)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="bg-[#0F0F0F]/95 backdrop-blur-md rounded-2xl border border-white/10 p-6 landscape:p-4 lg:landscape:p-6 shadow-2xl space-y-4 landscape:space-y-2.5 lg:landscape:space-y-6 max-w-md w-full mx-auto" id="leaderboard-card">
      <div className="flex items-center justify-between border-b border-white/5 pb-3 landscape:pb-1.5 lg:landscape:pb-3">
        <h3 className="text-xl font-display italic font-semibold text-[#D4AF37] flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#D4AF37] animate-pulse" />
          High Scores
        </h3>
        {displayScores.length > 0 && !isRegistering && (
          <button
            onClick={clearLeaderboard}
            className="text-zinc-500 hover:text-red-400 transition-colors p-1 rounded-md"
            title="ランキングをクリア"
            id="clear-leaderboard-btn"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs Selector */}
      <div className="flex gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5" id="leaderboard-tabs">
        {modes.map((m) => {
          const isSelected = activeTab === m.value;
          const isDisabled = isRegistering && m.value !== (duration || 60);

          return (
            <button
              key={m.value}
              type="button"
              disabled={isDisabled || isRegistering}
              onClick={() => {
                if (isRegistering) return;
                audio.playSelect();
                setActiveTab(m.value);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center ${
                isSelected
                  ? 'bg-[#D4AF37] text-black shadow-md font-sans'
                  : 'text-zinc-400 font-sans'
              } ${
                isDisabled
                  ? 'opacity-20 cursor-not-allowed'
                  : !isSelected ? 'hover:text-white hover:bg-white/5' : ''
              }`}
              id={`tab-btn-${m.value}`}
            >
              {m.label.split(' ')[0]} {/* Show クイック, ノーマル, ロング directly for space */}
            </button>
          );
        })}
      </div>

      {currentScore !== undefined && currentScore > 0 && !hasSubmitted && (
        isTestPlay ? (
          <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-center space-y-1.5" id="test-play-notice">
            <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-widest animate-pulse font-bold">Test Play Mode Active</p>
            <p className="text-2xl font-mono font-bold text-white">{currentScore.toLocaleString()} pts</p>
            <p className="text-xs text-zinc-400 font-sans">※ テストプレイモードのため、ランキングの記録は行われません。</p>
          </div>
        ) : (
          <form onSubmit={handleSubmitScore} className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3" id="submit-score-form">
            <div className="text-center">
              <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-widest">New Highscore Recorded!</p>
              <p className="text-2xl font-mono font-bold text-white mt-1">{currentScore.toLocaleString()} pts</p>
              <p className="text-xs text-zinc-400 mt-0.5 font-sans">Max Combo: {maxCombo || 1}回 ({modes.find(m => m.value === (duration || 60))?.label})</p>
            </div>
            <div>
              <label className="block text-[11px] font-sans font-medium text-zinc-400 mb-1">Enter Name (Max 10 characters)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="PLAYER"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]/50 text-sm flex-1 font-mono"
                  id="player-name-input"
                />
                <button
                  type="submit"
                  className="bg-[#D4AF37] hover:bg-[#bfa032] active:scale-95 text-black font-bold px-4 py-2 rounded-lg text-sm transition-all shadow-md"
                  id="save-score-submit-btn"
                >
                  登録
                </button>
              </div>
            </div>
          </form>
        )
      )}

      <div className="space-y-2.5">
        {displayScores.length === 0 ? (
          <div className="text-center py-6 text-zinc-500 text-sm font-sans leading-relaxed">
            このモードのハイスコア記録はまだありません。<br />プレイして一番乗りを目指そう！
          </div>
        ) : (
          displayScores.map((score, index) => {
            const isTop1 = index === 0;
            return (
              <div
                key={score.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isTop1
                    ? 'bg-[#D4AF37]/10 border-[#D4AF37]/35 shadow-[0_0_15px_rgba(212,175,55,0.05)]'
                    : 'bg-black/30 border-white/5'
                }`}
                id={`score-row-${index}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs font-mono ${
                      index === 0
                        ? 'bg-[#D4AF37] text-black shadow-md'
                        : index === 1
                        ? 'bg-zinc-300 text-zinc-900'
                        : index === 2
                        ? 'bg-amber-850 text-white bg-amber-800'
                        : 'bg-zinc-900 text-zinc-500 border border-white/5'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <div className="font-semibold text-sm text-zinc-100 flex items-center gap-1.5 font-sans">
                      {score.name}
                      {isTop1 && <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5 font-mono">
                      <span className="flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5 text-[#D4AF37]" />
                        {score.maxCombo} Combo
                      </span>
                      <span>•</span>
                      <span>{getMultiplierLabel(score.multiplierType)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`font-mono font-bold text-base ${isTop1 ? 'text-[#D4AF37]' : 'text-zinc-100'}`}>
                    {score.score.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-zinc-600 flex items-center justify-end gap-1 font-mono">
                    <Calendar className="w-2.5 h-2.5" />
                    {score.date}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="w-full bg-white/5 hover:bg-white/10 text-[#D4AF37] hover:text-white border border-white/10 py-2.5 rounded-xl font-semibold text-sm transition-all font-display italic"
          id="close-leaderboard-btn"
        >
          メニューに戻る
        </button>
      )}
    </div>
  );
}
