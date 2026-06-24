import React from 'react';
import { MultiplierSetting } from '../types';
import { Sliders, HelpCircle, Activity, Info } from 'lucide-react';
import audio from '../utils/audio';

interface TuningPanelProps {
  setting: MultiplierSetting;
  onChange: (newSetting: MultiplierSetting) => void;
  disabled?: boolean;
}

export default function TuningPanel({ setting, onChange, disabled = false }: TuningPanelProps) {
  const getMultiplier = (combo: number, coeff: number) => {
    if (combo <= 1) return 1.0;
    return 1.0 + (combo - 1) * coeff;
  };

  const handlePresetSelect = (presetType: 'linear' | 'steep' | 'fever' | 'custom') => {
    if (disabled) return;
    audio.playSelect();
    let coeff = 0.5;
    if (presetType === 'linear') coeff = 0.5;
    else if (presetType === 'steep') coeff = 1.0;
    else if (presetType === 'fever') coeff = 1.5;
    else coeff = setting.coefficient; // retain slider

    onChange({ type: presetType, coefficient: coeff });
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const val = parseFloat(e.target.value);
    onChange({ type: 'custom', coefficient: val });
  };

  // Create preview of combo steps from 1 to 5
  const debugCombos = [1, 2, 3, 4, 5];

  return (
    <div className={`bg-[#0F0F0F]/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 landscape:p-3.5 lg:landscape:p-5 shadow-2xl space-y-4 landscape:space-y-2 lg:landscape:space-y-4 transition-all duration-300 ${disabled ? 'opacity-60' : ''}`} id="tuning-panel">
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5 landscape:pb-1.5 lg:landscape:pb-2.5">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#D4AF37]" />
          <h3 className="font-display italic font-semibold text-[#D4AF37] text-base">
            Combo Speed settings
          </h3>
        </div>
        {disabled && (
          <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-md font-sans">
            プレイ中変更不可
          </span>
        )}
      </div>

      <div className={`space-y-4 ${disabled ? 'pointer-events-none select-none' : ''}`}>
        {/* Preset Selector */}
        <div>
          <label className="text-xs font-display italic text-zinc-400 block mb-2">Select speed growth rate</label>
          <div className="grid grid-cols-4 gap-2" id="preset-grid">
            {(['linear', 'steep', 'fever', 'custom'] as const).map((type) => {
              const active = setting.type === type;
              let label = '';
              let badge = '';
              if (type === 'linear') {
                label = 'リニア';
                badge = '+0.5';
              } else if (type === 'steep') {
                label = '急上昇';
                badge = '+1.0';
              } else if (type === 'fever') {
                label = '通常倍';
                badge = '+1.5';
              } else {
                label = '自由';
                badge = '編集';
              }

              return (
                <button
                  key={type}
                  type="button"
                  disabled={disabled}
                  onClick={() => handlePresetSelect(type)}
                  className={`p-2 rounded-xl text-xs font-medium border transition-all flex flex-col items-center justify-center gap-1 ${
                    active
                      ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.05)]'
                      : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                  } ${disabled ? 'cursor-not-allowed opacity-80' : ''}`}
                  id={`preset-btn-${type}`}
                >
                  <span className="font-sans font-semibold">{label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 select-none font-mono rounded ${active ? 'bg-[#D4AF37]/25 text-[#D4AF37]' : 'bg-black text-zinc-500'}`}>
                    {type === 'custom' ? `+${setting.coefficient.toFixed(1)}` : badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Slider */}
        <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-300 font-medium">1コンボ毎の倍率増加量:</span>
            <span className="text-sm font-mono font-bold text-[#D4AF37]">
              +{setting.coefficient.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.1"
            disabled={disabled}
            value={setting.coefficient}
            onChange={handleSliderChange}
            className="w-full h-1.5 bg-zinc-800 rounded-lg cursor-pointer accent-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed"
            id="multiplier-slider"
          />
          <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
            <span>低速 (+0.1)</span>
            <span>中速 (+1.5)</span>
            <span>超速 (+3.0)</span>
          </div>
        </div>

        {/* Real-time Math Preview Table & Spark Graphs */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs text-zinc-400 font-medium font-display italic">
            <Activity className="w-4 h-4 text-zinc-500" />
            <span>Multiplier Preview</span>
          </div>
          
          <div className="bg-black/50 rounded-xl border border-white/5 p-3.5 space-y-2">
            {debugCombos.map((c) => {
              const m = getMultiplier(c, setting.coefficient);
              const maxVal = getMultiplier(5, 3.0); // reference for bar sizing
              const percent = Math.min(100, (m / maxVal) * 100);

              return (
                <div key={c} className="flex items-center text-xs font-mono" id={`combo-preview-row-${c}`}>
                  <span className="w-16 text-zinc-400 text-left font-sans text-[11px]">
                    {c} Combo:
                  </span>
                  <div className="flex-1 h-3 bg-black rounded-full overflow-hidden mx-2.5 relative">
                    <div
                      className="h-full bg-gradient-to-r from-zinc-700 to-[#D4AF37] transition-all duration-305"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-bold text-[#D4AF37]">
                    {m.toFixed(1)}x
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Explain Rule */}
        <div className="flex gap-2 text-zinc-400 bg-white/[0.02] border border-white/5 p-3.5 rounded-xl text-[11px] leading-relaxed">
          <Info className="w-4 h-4 text-[#D4AF37] flex-shrink-0 mt-0.5" />
          <div className="font-sans">
            <p className="font-semibold text-zinc-200">スコア倍率計算ルール:</p>
            <p className="mt-1 text-zinc-400 font-mono">
              基本消去: <span className="text-white font-bold">10,000点</span><br />
              追加消去: +1個につき <span className="text-white font-bold">+10,000点</span><br />
              獲得スコア = <span className="text-[#D4AF37] font-bold">基本スコア × コンボ倍率</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
