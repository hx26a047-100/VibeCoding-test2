class GameAudioSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // AudioContext will be lazily initialized on first interaction
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getMuteStatus(): boolean {
    return this.isMuted;
  }

  private createOscillator(
    type: OscillatorType,
    freq: number,
    duration: number,
    gainStart: number
  ): { osc: OscillatorNode; gain: GainNode } | null {
    this.initCtx();
    if (!this.ctx || this.isMuted) return null;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gainNode.gain.setValueAtTime(gainStart, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    return { osc, gain: gainNode };
  }

  // Soft blip when selecting a block
  public playSelect() {
    const sound = this.createOscillator('sine', 600, 0.08, 0.1);
    if (!sound) return;
    sound.osc.start();
    sound.osc.stop(this.ctx!.currentTime + 0.08);
  }

  // Soft cancel/deselect sound
  public playDeselect() {
    const sound = this.createOscillator('sine', 350, 0.1, 0.1);
    if (!sound) return;
    sound.osc.start();
    sound.osc.stop(this.ctx!.currentTime + 0.1);
  }

  // Swoosh slide sound when swapping
  public playSwap() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const { osc, gain } = this.createOscillator('triangle', 300, 0.15, 0.15) || {};
    if (!osc || !gain) return;

    // Slide frequency downwards
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.15);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  // Error/revert swap buzzer
  public playRevert() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const { osc, gain } = this.createOscillator('triangle', 180, 0.25, 0.15) || {};
    if (!osc || !gain) return;

    osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.25);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  // Rising pentatonic arpeggio depending on combo count
  public playMatch(combo: number) {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    // Pentatonic scale starting at middle C (C4 = 261.63Hz)
    const baseScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];
    const itemIndex = (combo - 1) % baseScale.length;
    const octaveMultiplier = Math.floor((combo - 1) / baseScale.length) + 1;
    const baseFreq = baseScale[itemIndex] * octaveMultiplier;

    // Play a delightful tiny sequence using 2 or 3 overlapping notes for a chords/arpeggio feel
    const t = this.ctx.currentTime;
    
    // Primary note
    const s1 = this.createOscillator('sine', baseFreq, 0.3, 0.2);
    if (s1) {
      s1.osc.start(t);
      s1.osc.stop(t + 0.3);
    }

    // Third (Major-ish feel / Pentatonic harmony)
    const s2 = this.createOscillator('sine', baseFreq * 1.25, 0.25, 0.1);
    if (s2) {
      s2.osc.start(t + 0.05);
      s2.osc.stop(t + 0.3);
    }

    // Fifth
    const s3 = this.createOscillator('sine', baseFreq * 1.5, 0.2, 0.08);
    if (s3) {
      s3.osc.start(t + 0.1);
      s3.osc.stop(t + 0.3);
    }
  }

  // Shuffle board sound: a flurry of random quick chirps
  public playShuffle() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const chirpTime = t + i * 0.06;
      const freq = 400 + Math.random() * 800;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, chirpTime);
      gainNode.gain.setValueAtTime(0.08, chirpTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, chirpTime + 0.05);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(chirpTime);
      osc.stop(chirpTime + 0.05);
    }
  }

  // Deep heartbeat tick for low time warnings
  public playHeartbeat() {
    const sound = this.createOscillator('sine', 95, 0.15, 0.35);
    if (!sound) return;
    sound.osc.start();
    sound.osc.stop(this.ctx!.currentTime + 0.15);
  }

  // Cheerful retro game-start tune
  public playStartJingle() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 523.25];
    const durations = [0.1, 0.1, 0.1, 0.15, 0.1, 0.3];
    const delay = 0.08;
    const baseTime = this.ctx.currentTime;

    notes.forEach((freq, i) => {
      const t = baseTime + i * delay;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + durations[i]);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(t);
      osc.stop(t + durations[i]);
    });
  }

  // Descending sad synth tune for gameover
  public playGameOverJingle() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const notes = [392.00, 349.23, 329.63, 261.63, 196.00];
    const durations = [0.15, 0.15, 0.15, 0.2, 0.5];
    const delay = 0.18;
    const baseTime = this.ctx.currentTime;

    notes.forEach((freq, i) => {
      const t = baseTime + i * delay;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0.001, t + durations[i]);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(t);
      osc.stop(t + durations[i]);
    });
  }
}

export const audio = new GameAudioSynth();
export default audio;
