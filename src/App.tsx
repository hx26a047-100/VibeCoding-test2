import { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Tile, MultiplierSetting, GameStats, ScoreHistory } from './types';
import {
  createNewBoard,
  scanMatches,
  findMatchClusters,
  isAdjacent,
  getSwappedBoard,
  hasPossibleMoves,
  dropAndFillTiles,
  shuffleBoard,
} from './utils/gameCore';
import audio from './utils/audio';
import GameBoard from './components/GameBoard';
import ScorePanel from './components/ScorePanel';
import TuningPanel from './components/TuningPanel';
import Leaderboard from './components/Leaderboard';

import {
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Sliders,
  HelpCircle,
  Pause,
  Zap,
  Flame,
  Award,
  ListCollapse,
  Dumbbell,
  Volume2,
  VolumeX,
} from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [board, setBoard] = useState<Tile[][]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isTestPlay, setIsTestPlay] = useState<boolean>(false);

  // Stats
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    matchesCount: 0,
    tilesCleared: 0,
  });

  // Time metrics
  const [roundDuration, setRoundDuration] = useState<number>(60); // 30, 60, 120 seconds
  const [timeRemaining, setTimeRemaining] = useState<number>(60);

  // Multiplier Curve Setting - satisfies "コンボ数によって得られるスコアの倍率をいじって" (tweak combo multipliers)
  const [multiplierSetting, setMultiplierSetting] = useState<MultiplierSetting>({
    type: 'linear',
    coefficient: 0.5, // Adds +0.5x multiplier per combo step
  });

  // Current multiplier factor during combo sequences
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.0);

  // Floating text pop elements for scored combos
  const [floatingScores, setFloatingScores] = useState<{ id: string; x: number; y: number; text: string }[]>([]);

  // High score championship cache
  const [championScore, setChampionScore] = useState<number>(0);

  // Sync champion score from localStorage for the start-screen motivation
  useEffect(() => {
    const saved = localStorage.getItem('match3_highscores');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ScoreHistory[];
        const modeScores = parsed.filter((s) => (s.duration || 60) === roundDuration);
        if (modeScores.length > 0) {
          const topScore = Math.max(...modeScores.map((s) => s.score));
          setChampionScore(topScore);
        } else {
          setChampionScore(0);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      setChampionScore(0);
    }
  }, [gameState, roundDuration]);

  // Handle local mute status synchronization
  useEffect(() => {
    setIsMuted(audio.getMuteStatus());
  }, []);

  const toggleMute = () => {
    const status = audio.toggleMute();
    setIsMuted(status);
  };

  // Launch Game Core
  const handleStartGame = () => {
    setIsTestPlay(false);
    audio.playStartJingle();
    const newGrid = createNewBoard();
    setBoard(newGrid);
    setStats({
      score: 0,
      combo: 0,
      maxCombo: 0,
      matchesCount: 0,
      tilesCleared: 0,
    });
    setTimeRemaining(roundDuration);
    setCurrentMultiplier(1.0);
    setFloatingScores([]);
    setIsLocked(false);
    setIsShuffling(false);
    setGameState('PLAYING');
  };

  // Launch Test Play
  const handleStartTestPlay = () => {
    setIsTestPlay(true);
    audio.playStartJingle();
    const newGrid = createNewBoard();
    setBoard(newGrid);
    setStats({
      score: 0,
      combo: 0,
      maxCombo: 0,
      matchesCount: 0,
      tilesCleared: 0,
    });
    setTimeRemaining(9999);
    setCurrentMultiplier(1.0);
    setFloatingScores([]);
    setIsLocked(false);
    setIsShuffling(false);
    setGameState('PLAYING');
  };

  // Countdown clock timer loop
  useEffect(() => {
    let timerId: NodeJS.Timeout;

    if (gameState === 'PLAYING') {
      if (isTestPlay) {
        return;
      }
      timerId = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerId);
            setGameState('GAMEOVER');
            audio.playGameOverJingle();
            return 0;
          }

          // Trigger tick heartbeat sound in final 10 seconds area
          if (prev <= 11) {
            audio.playHeartbeat();
          }

          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [gameState, isTestPlay]);

  // Clean up floating points after slide fades
  useEffect(() => {
    if (floatingScores.length > 0) {
      const timer = setTimeout(() => {
        setFloatingScores((prev) => prev.slice(1));
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [floatingScores]);

  // Recursive block cascading engine
  const processMatchTurn = useCallback(
    async (currentBoard: Tile[][], combo: number) => {
      // 1. Scan for matching locations
      const matchedCoords = scanMatches(currentBoard);
      
      if (matchedCoords.length === 0) {
        // Cascade completed! Reset current combo multiplier meter
        setCurrentMultiplier(1.0);
        
        // Check if there are legal swap moves available on the board
        const possible = hasPossibleMoves(currentBoard);
        if (!possible && gameState === 'PLAYING') {
          setIsShuffling(true);
          audio.playShuffle();
          
          await new Promise((resolve) => setTimeout(resolve, 1400));
          
          const shuffledGrid = shuffleBoard(currentBoard);
          setBoard(shuffledGrid);
          setIsShuffling(false);
          setIsLocked(false);
        } else {
          setIsLocked(false);
        }
        return;
      }

      // 2. Mark matches as active on tiles
      const updatedWithMatches = currentBoard.map((row) =>
        row.map((t) => ({ ...t }))
      );
      matchedCoords.forEach(({ row, col }) => {
        updatedWithMatches[row][col].isMatched = true;
      });

      // 3. Cluster matched vectors for detailed individual scores
      const clusters = findMatchClusters(currentBoard, matchedCoords);
      let turnBaseScore = 0;
      const turnFloating: { id: string; x: number; y: number; text: string }[] = [];

      // Calculate score for each discrete matches cluster
      clusters.forEach((cluster) => {
        // Base match score: 3 tiles = 10,000, each extra tile increases base score by +10,000
        const clusterBase = 10000 + (cluster.size - 3) * 10000;
        turnBaseScore += clusterBase;

        // Position cluster floats appropriately (visual center)
        let sumRow = 0;
        let sumCol = 0;
        cluster.tiles.forEach((t) => {
          sumRow += t.row;
          sumCol += t.col;
        });
        const avgRow = sumRow / cluster.tiles.length;
        const avgCol = sumCol / cluster.tiles.length;

        // Compute percentages mapping coordinates
        const px = (avgCol + 0.5) * (100 / 7);
        const py = (avgRow + 0.5) * (100 / 7);

        // Adjust for current combo coefficient
        const coeffMult = 1.0 + (combo - 1) * multiplierSetting.coefficient;
        const pointsAwarded = Math.round(clusterBase * coeffMult);

        turnFloating.push({
          id: Math.random().toString(),
          x: px,
          y: py,
          text: `+${pointsAwarded.toLocaleString()}${combo > 1 ? ` (${coeffMult.toFixed(1)}x COMBO!)` : ''}`,
        });
      });

      const globalCoeff = 1.0 + (combo - 1) * multiplierSetting.coefficient;
      setCurrentMultiplier(globalCoeff);
      const totalPoints = Math.round(turnBaseScore * globalCoeff);

      // Play combo pitch sound!
      audio.playMatch(combo);

      // Accumulate floating points
      setFloatingScores((prev) => [...prev, ...turnFloating]);

      // Stage states variables updates
      setBoard(updatedWithMatches);
      setStats((prev) => {
        const newMaxCombo = Math.max(prev.maxCombo, combo);
        return {
          score: prev.score + totalPoints,
          combo: combo,
          maxCombo: newMaxCombo,
          matchesCount: prev.matchesCount + clusters.length,
          tilesCleared: prev.tilesCleared + matchedCoords.length,
        };
      });

      // 4. Wait for popping matched fade effects (300ms)
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 5. Shift existing vectors and drop new gems from top
      const { newBoard: shiftedBoard } = dropAndFillTiles(updatedWithMatches);
      setBoard(shiftedBoard);

      // 6. Wait for fall transitions (320ms)
      await new Promise((resolve) => setTimeout(resolve, 320));

      // 7. Check recursively for new cascade chains!
      await processMatchTurn(shiftedBoard, combo + 1);
    },
    [multiplierSetting, gameState]
  );

  // Active swap validator
  const handleSwapAttempt = useCallback(
    async (r1: number, c1: number, r2: number, c2: number) => {
      if (isLocked || gameState !== 'PLAYING') return;
      setIsLocked(true);

      const originalBoard = board;
      const swappedBoard = getSwappedBoard(board, r1, c1, r2, c2);

      // Slide elements
      setBoard(swappedBoard);
      audio.playSwap();

      // Wait for slide glide duration (260ms)
      await new Promise((resolve) => setTimeout(resolve, 260));

      // Check if swap made a match
      const matches = scanMatches(swappedBoard);

      if (matches.length === 0) {
        // Reject invalid swap actions
        setBoard(originalBoard);
        audio.playRevert();
        // Wait for slide back duration
        await new Promise((resolve) => setTimeout(resolve, 260));
        setIsLocked(false);
      } else {
        // Start Cascade Solving under Combo 1
        await processMatchTurn(swappedBoard, 1);
      }
    },
    [board, isLocked, gameState, processMatchTurn]
  );

  const getMultiplierLabel = (type: string) => {
    switch (type) {
      case 'linear':
        return 'リニア (+0.5x)';
      case 'steep':
        return '急上昇 (+1.0x)';
      case 'fever':
        return 'フィーバー (+1.5x)';
      default:
        return 'カスタム';
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col font-sans relative antialiased overflow-x-hidden selection:bg-[#D4AF37] selection:text-black" id="main-root">
      {/* Background Animated Gradient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#050505] via-zinc-950 to-[#0e0e0e] pointer-events-none animate-bg-gradient" />

      {/* Decorative Neon Ring */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[350px] bg-[#D4AF37]/3 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Bar */}
      <header className="border-b border-white/5 bg-black/80 backdrop-blur-md sticky top-0 z-30 px-4 py-3 landscape:py-1.5 landscape:px-3 lg:landscape:py-3 lg:landscape:px-4" id="app-header">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-br from-[#D4AF37] to-[#8a6f27] p-2 landscape:p-1 lg:landscape:p-2 rounded-xl shadow-lg ring-1 ring-white/10" id="brand-logo">
              <Sparkles className="w-5 h-5 text-black animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl landscape:text-base lg:landscape:text-xl font-display italic font-semibold tracking-wide text-white leading-none">
                L'Arcade du Match
              </h1>
              <span className="text-[10px] text-zinc-500 font-semibold font-mono block mt-0.5 uppercase tracking-widest landscape:hidden sm:landscape:block">
                Sophisticated 3-Match Puzzle
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(gameState === 'START' || gameState === 'GAMEOVER') && (
              <>
                <button
                  onClick={handleStartTestPlay}
                  className="bg-white/5 hover:bg-white/10 text-[#D4AF37] border border-[#D4AF37]/30 hover:border-[#D4AF37]/60 font-bold font-display italic text-xs landscape:text-[11px] px-3 landscape:px-2.5 py-1.5 landscape:py-1 rounded-lg flex items-center gap-1 transition-all shadow-md active:scale-95 cursor-pointer"
                  id="header-test-play-btn"
                >
                  <Dumbbell className="w-3 h-3 text-[#D4AF37]" />
                  <span>テストプレイ</span>
                </button>
                <button
                  onClick={handleStartGame}
                  className="bg-[#D4AF37] hover:bg-[#bfa032] text-black font-bold font-display italic text-xs landscape:text-[11px] px-3 landscape:px-2.5 py-1.5 landscape:py-1 rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                  id="header-start-game-btn"
                >
                  <Play className="w-3 h-3 fill-black" />
                  <span>ゲームスタート</span>
                </button>
              </>
            )}
            {gameState === 'PLAYING' && (
              <button
                onClick={() => setGameState('PAUSED')}
                className="bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-zinc-300 font-semibold text-xs landscape:text-[11px] px-3 landscape:px-2.5 py-1.5 landscape:py-1 rounded-lg flex items-center gap-1 transition-all"
                id="pause-game-btn"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>一時停止</span>
              </button>
            )}
            <button
              onClick={toggleMute}
              className={`p-2 landscape:p-1.5 lg:landscape:p-2 rounded-lg border text-xs transition-all ${
                isMuted
                  ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                  : 'bg-white/5 border-white/10 text-zinc-440 text-zinc-400 hover:bg-white/10 hover:text-white'
              }`}
              id="header-mute-btn"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 landscape:p-2.5 lg:landscape:p-6 flex flex-col justify-center animate-enter" id="app-main">
        {/* State: START / Title Menu Screen */}
        {gameState === 'START' && (
          <div className="grid grid-cols-1 landscape:grid-cols-12 lg:grid-cols-12 gap-6 landscape:gap-4 items-start" id="start-screen">
            {/* Left Hand: App Details & Mode Tuning */}
            <div className="col-span-1 landscape:col-span-7 lg:col-span-7 space-y-6 landscape:space-y-3.5 lg:landscape:space-y-6">
              
              {/* Introduction Card */}
              <div className="bg-[#0F0F0F]/80 backdrop-blur-md rounded-2xl border border-white/10 p-6 landscape:p-4 lg:landscape:p-6 space-y-4 landscape:space-y-2.5 lg:landscape:space-y-4 shadow-xl">
                <div className="space-y-11 landscape:space-y-4 lg:landscape:space-y-11">
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#D4AF37] text-[10px] font-bold uppercase tracking-wider">
                    <Flame className="w-3.5 h-3.5" />
                    爽快3消しパズル
                  </div>
                  <h2 className="text-2xl md:text-[2.2rem] font-medium font-display italic text-white leading-tight">
                    同じ宝石を３つ以上並べて消し去ろう
                  </h2>
                </div>
                
                <p className="text-zinc-400 text-sm leading-relaxed font-sans mt-2">
                  縦か横に同じデザイン of 宝石を3つ以上並べて消していくシンプルなパズルゲームです。
                  落下の連鎖で<strong>コンボ（連鎖）</strong>を繋げて、ハイスコアを叩き出しましょう！
                </p>

                {/* Score rules */}
                <div className="bg-black/30 rounded-xl border border-white/5 p-4 landscape:p-3 space-y-3 landscape:space-y-2 lg:landscape:p-4 lg:landscape:space-y-3">
                  <span className="text-xs font-display italic font-semibold text-[#D4AF37] flex items-center gap-1">
                    <Award className="w-4 h-4 text-[#D4AF37]" />
                    Score Multiplier Rules
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-400">
                    <div className="bg-black/45 p-3 rounded-lg border border-white/5 space-y-1">
                      <p className="font-semibold text-zinc-200">💎 基本消し点</p>
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-zinc-400 font-mono">
                        <li>3つ消し: <span className="text-[#D4AF37] font-bold">+10,000点</span></li>
                        <li>4つ消し: <span className="text-[#D4AF37] font-bold">+20,000点</span></li>
                        <li>5つ消し: <span className="text-[#D4AF37] font-bold">+30,000点</span></li>
                        <span className="text-[10px] text-zinc-500 mt-1 block font-sans">※ 3つより多いと1個あたり +10,000点加算</span>
                      </ul>
                    </div>

                    <div className="bg-black/45 p-3 rounded-lg border border-white/5 space-y-1">
                      <p className="font-semibold text-zinc-200">🚀 連鎖コンボ倍率</p>
                      <p className="text-[11px] leading-relaxed text-zinc-400">
                        1回の入れ替えで連続してブロックが消えると<strong>コンボ倍率</strong>が積み上がります！
                        <span className="block mt-2 font-mono font-bold text-black bg-[#D4AF37] py-1.5 px-2 rounded text-center">
                          獲得点数 = 基本消し点 × コンボ倍率
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Round Settings Panel */}
                <div className="space-y-2.5">
                  <span className="text-xs font-display italic text-zinc-400 block">Select Limits</span>
                  <div className="grid grid-cols-3 gap-2.5" id="timer-setting-group">
                    {([30, 60, 120] as const).map((secs) => (
                      <button
                        key={secs}
                        onClick={() => {
                          audio.playSelect();
                          setRoundDuration(secs);
                        }}
                        className={`py-2 landscape:py-1 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-0.5 ${
                          roundDuration === secs
                            ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37] shadow-sm shadow-[#D4AF37]/10'
                            : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                        }`}
                        id={`round-dur-${secs}`}
                      >
                        <span className="text-sm font-mono">{secs}秒</span>
                        <span className="text-[9px] font-sans font-medium text-zinc-500">
                          {secs === 30 ? 'クイック' : secs === 60 ? 'ノーマル' : 'ロング'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dynamic Tuning Slider Panel */}
              <TuningPanel setting={multiplierSetting} onChange={setMultiplierSetting} />

              {/* Launcher buttons */}
              <div className="grid grid-cols-2 gap-4 landscape:gap-2.5 lg:landscape:gap-4">
                <button
                  onClick={handleStartTestPlay}
                  className="w-full bg-white/5 hover:bg-white/10 text-[#D4AF37] border border-[#D4AF37]/30 hover:border-[#D4AF37]/60 font-bold font-display italic text-base sm:text-lg landscape:text-sm lg:landscape:text-lg py-4 landscape:py-2.5 lg:landscape:py-4 rounded-xl transition-all shadow-md select-none cursor-pointer flex items-center justify-center gap-2"
                  id="main-test-play-btn"
                >
                  <Dumbbell className="w-5 h-5 landscape:w-4 landscape:h-4 lg:landscape:w-5 lg:landscape:h-5 text-[#D4AF37]" />
                  テストプレイ
                </button>
                <button
                  onClick={handleStartGame}
                  className="w-full bg-[#D4AF37] hover:bg-[#bfa032] text-black font-bold font-display italic text-base sm:text-lg landscape:text-sm lg:landscape:text-lg py-4 landscape:py-2.5 lg:landscape:py-4 rounded-xl transition-all shadow-xl shadow-[#D4AF37]/10 hover:shadow-[#D4AF37]/20 select-none cursor-pointer flex items-center justify-center gap-2"
                  id="main-start-btn"
                >
                  <Play className="w-5 h-5 landscape:w-4 landscape:h-4 lg:landscape:w-5 lg:landscape:h-5 fill-black" />
                  ゲームスタート
                </button>
              </div>
            </div>

            {/* Right Hand: Highscores Dashboard */}
            <div className="col-span-1 landscape:col-span-5 lg:col-span-5 space-y-6 landscape:space-y-3.5 lg:landscape:space-y-6">
              {championScore > 0 && (
                <div className="bg-gradient-to-br from-[#D4AF37]/5 to-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-2xl p-5 shadow-lg relative overflow-hidden" id="champion-badge">
                  <div className="absolute right-[-10px] bottom-[-10px] opacity-10 rotate-12 pointer-events-none">
                    <Trophy className="w-32 h-32 text-[#D4AF37]" />
                  </div>
                  <div className="flex gap-4 items-center animate-combo-pulse">
                    <div className="bg-[#D4AF37]/15 p-3 rounded-xl border border-[#D4AF37]/30">
                      <Trophy className="w-6 h-6 text-[#D4AF37]" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold text-[#D4AF37] tracking-widest uppercase">CURRENT CHAMPION SCORE</span>
                      <h4 className="font-mono text-2xl font-black text-[#D4AF37] mt-0.5">
                        {championScore.toLocaleString()} 点
                      </h4>
                      <p className="text-[11px] text-[#D4AF37]/75 font-sans mt-0.5">連鎖倍率を調整して最高の称号を掴み取ろう！</p>
                    </div>
                  </div>
                </div>
              )}

              <Leaderboard duration={roundDuration} />
            </div>
          </div>
        )}

        {/* State: PLAYING or PAUSED */}
        {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
          <div className="grid grid-cols-1 landscape:grid-cols-12 lg:grid-cols-12 gap-6 landscape:gap-4 items-center" id="active-game-screen">
            
            {/* Grid Board container */}
            <div className="col-span-1 landscape:col-span-5 lg:col-span-7 flex flex-col items-center justify-center">
              {/* Floating score overlays directly mapping coordinates inside board relative block */}
              <div className="relative w-full aspect-square max-w-[480px] landscape:max-w-[70vh] lg:landscape:max-w-[480px]">
                
                {/* Board element itself */}
                <GameBoard
                  board={board}
                  disabled={isLocked || gameState === 'PAUSED'}
                  onSwapAttempt={handleSwapAttempt}
                  isShuffling={isShuffling}
                />

                {/* Floating score notices popping up */}
                <div className="absolute inset-2.5 pointer-events-none z-30 overflow-hidden" id="floating-scores-layer">
                  {floatingScores.map((score) => (
                    <div
                      key={score.id}
                      style={{
                        position: 'absolute',
                        left: `${score.x}%`,
                        top: `${score.y}%`,
                      }}
                      className="text-xs sm:text-sm font-bold font-mono text-[#D4AF37] bg-black/95 px-2.5 py-1 rounded border border-[#D4AF37]/30 shadow-[0_0_15px_rgba(212,175,55,0.2)] select-none pointer-events-none whitespace-nowrap animate-float-up"
                    >
                      {score.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar with Stats & Real-time Tuning */}
            <div className="col-span-1 landscape:col-span-7 lg:col-span-5 grid grid-cols-1 landscape:grid-cols-2 lg:landscape:grid-cols-1 gap-4 landscape:gap-3 lg:landscape:gap-0 lg:landscape:space-y-6">
              
              {/* Score and Timer Dashboard */}
              <ScorePanel
                stats={stats}
                timeRemaining={timeRemaining}
                totalTime={roundDuration}
                multiplier={currentMultiplier}
                onRestart={() => {
                  audio.playSelect();
                  setGameState('START');
                }}
                onMuteToggle={toggleMute}
                isMuted={isMuted}
                isTestPlay={isTestPlay}
              />

              {/* Dynamic Tuning Settings */}
              <div className="space-y-2 landscape:space-y-1.5 lg:landscape:space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-300 px-1">
                  <span>倍率設定: <strong className="text-[#D4AF37] font-display italic font-semibold">{getMultiplierLabel(multiplierSetting.type)}</strong></span>
                  <span className="text-[10px] text-zinc-500 font-mono landscape:hidden sm:landscape:block lg:landscape:block">※ リアルタイム調整可</span>
                </div>
                <TuningPanel setting={multiplierSetting} onChange={setMultiplierSetting} />
              </div>

            </div>
          </div>
        )}

        {/* State: GAMEOVER Screen */}
        {gameState === 'GAMEOVER' && (
          <div className="max-w-2xl mx-auto w-full space-y-6" id="gameover-screen">
            
            {/* Visual Header Summary */}
            <div className="bg-[#0F0F0F]/90 backdrop-blur-md rounded-2xl border border-white/10 p-8 shadow-2xl space-y-5 text-center relative overflow-hidden">
              <div className="absolute -top-12 -left-12 w-48 h-48 bg-[#D4AF37]/5 rounded-full blur-[60px]" />
              <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-[#D4AF37]/5 rounded-full blur-[60px]" />

              <div className="space-y-1">
                <span className="text-xs font-mono font-bold tracking-widest text-[#D4AF37] uppercase">TIME UP!</span>
                <h3 className="text-3xl font-display italic font-semibold text-white uppercase tracking-tight">
                  制限時間終了
                </h3>
              </div>

              {/* Final Score pop */}
              <div className="bg-black/60 rounded-xl p-5 border border-white/5 inline-block px-10 relative">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-semibold">FINAL SCORE</span>
                <div className="text-4xl md:text-5xl font-mono font-bold text-[#D4AF37] drop-shadow-[0_0_15px_rgba(212,175,55,0.3)] mt-1 animate-pulse">
                  {stats.score.toLocaleString()} <span className="text-xs text-[#D4AF37]">点</span>
                </div>
              </div>

              {/* Bento Stats breakdowns */}
              <div className="grid grid-cols-3 gap-3 text-center max-w-md mx-auto" id="gameover-bento">
                <div className="bg-black/45 p-3 rounded-lg border border-white/5">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold font-mono">最大コンボ数</p>
                  <p className="font-mono text-base font-bold text-[#D4AF37] mt-0.5">{stats.maxCombo} 回</p>
                </div>
                <div className="bg-black/45 p-3 rounded-lg border border-white/5">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold font-mono">マッチング回数</p>
                  <p className="font-mono text-base font-bold text-white mt-0.5">{stats.matchesCount} 回</p>
                </div>
                <div className="bg-black/45 p-3 rounded-lg border border-white/5">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold font-mono">消したブロック</p>
                  <p className="font-mono text-base font-bold text-white mt-0.5">{stats.tilesCleared} 個</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
                <button
                  onClick={handleStartGame}
                  className="bg-[#D4AF37] hover:bg-[#bfa032] text-black font-bold font-display italic py-3 px-8 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                  id="gameover-restart-btn"
                >
                  <RotateCcw className="w-4 h-4 fill-black" />
                  もう一度プレイする
                </button>
                <button
                  onClick={() => setGameState('START')}
                  className="bg-white/5 hover:bg-white/10 text-zinc-350 font-semibold py-3 px-8 rounded-xl transition-all border border-white/10"
                  id="gameover-menu-btn"
                >
                  メニューに戻る
                </button>
              </div>
            </div>

            {/* Leaderboard Input & Records Display */}
            <Leaderboard
              currentScore={stats.score}
              maxCombo={stats.maxCombo}
              multiplierType={multiplierSetting.type === 'custom' ? `custom-${multiplierSetting.coefficient}` : multiplierSetting.type}
              onClose={() => setGameState('START')}
              isTestPlay={isTestPlay}
              duration={roundDuration}
            />

          </div>
        )}

      </main>

      {/* Paused Overlay Modal */}
      {gameState === 'PAUSED' && (
        <div className="fixed inset-0 bg-[#050505]/95 backdrop-blur-md flex flex-col items-center justify-center z-50 p-4" id="paused-overlay">
          <div className="bg-[#0F0F0F] border border-white/10 rounded-2xl p-6 md:p-8 max-w-sm w-full text-center space-y-6 shadow-2xl relative">
            <div className="absolute top-[-20px] left-1/2 -translate-x-1/2 bg-[#D4AF37]/10 border border-[#D4AF37]/35 text-[#D4AF37] font-mono text-xs font-bold py-1 px-4 rounded-full shadow-md">
              PAUSED
            </div>
            
            <div className="space-y-1">
              <h3 className="text-xl font-display italic font-semibold text-white">
                ゲーム一時停止中
              </h3>
              <p className="text-xs text-zinc-400">
                少し息を整えましょう。続きから再開できます。
              </p>
            </div>

            {/* Resume / restart launcher pack */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  audio.playSelect();
                  setGameState('PLAYING');
                }}
                className="w-full bg-[#D4AF37] hover:bg-[#bfa032] text-black font-bold font-display italic py-3 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                id="resume-btn"
              >
                ゲームを再開する
              </button>
              <button
                onClick={() => {
                  audio.playSelect();
                  setGameState('START');
                }}
                className="w-full bg-white/5 hover:bg-white/10 text-zinc-350 text-xs py-3 rounded-xl transition-all border border-white/10"
                id="paused-quit-btn"
              >
                {isTestPlay ? 'テストプレイを終了する' : 'メニューに戻る (進行状況は失われます)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer credits bar */}
      <footer className="border-t border-white/5 bg-[#050505] px-4 py-4 text-center mt-auto text-[10px] text-zinc-650 font-mono flex flex-col sm:flex-row justify-between items-center gap-2 max-w-6xl w-full mx-auto landscape:hidden md:landscape:flex" id="app-footer">
        <span>© 2026 MATCH-3 ARCADE PUZZLE. ALL RIGHTS RESERVED.</span>
        <span>DESIGNED FOR MAXIMUM CRISP VISUAL FLUIDITY</span>
      </footer>
    </div>
  );
}
