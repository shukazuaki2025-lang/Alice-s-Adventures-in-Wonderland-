/**
 * Procedural Web Audio API Sound Synthesizer
 * Generates music tracks M1-M7 and SFX-01 through SFX-30 purely via Web Audio nodes.
 */

export class ProceduralSynth {
  private ctx: AudioContext;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  // --- Utility Generators ---

  /**
   * Play a musical note/tone with ADSR envelope
   */
  public playTone(
    destination: AudioNode,
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainVal = 0.3,
    adsr = { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.2 }
  ): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + adsr.attack);
    gain.gain.linearRampToValueAtTime(gainVal * adsr.sustain, now + adsr.attack + adsr.decay);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  /**
   * Generate a filtered noise burst (footsteps, wind, water, crunch)
   */
  public playNoise(
    destination: AudioNode,
    duration: number,
    filterFreq = 1000,
    filterType: BiquadFilterType = 'lowpass',
    gainVal = 0.2,
    pitchScale = 1.0
  ): void {
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.playbackRate.value = pitchScale;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq * pitchScale, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    noiseSource.start(now);
  }

  // --- SFX Generators (SFX-01 to SFX-30) ---

  public playFootstepGrass(dest: AudioNode, pitchScale = 1.0): void {
    this.playNoise(dest, 0.2, 800, 'bandpass', 0.15, pitchScale);
    this.playTone(dest, 150 * pitchScale, 0.1, 'sine', 0.1, { attack: 0.005, decay: 0.05, sustain: 0.2, release: 0.05 });
  }

  public playFootstepWood(dest: AudioNode, pitchScale = 1.0): void {
    this.playTone(dest, 220 * pitchScale, 0.12, 'triangle', 0.2, { attack: 0.005, decay: 0.04, sustain: 0.3, release: 0.05 });
  }

  public playFootstepStone(dest: AudioNode, pitchScale = 1.0): void {
    this.playTone(dest, 600 * pitchScale, 0.08, 'sine', 0.15, { attack: 0.002, decay: 0.03, sustain: 0.1, release: 0.03 });
  }

  public playFootstepLeaves(dest: AudioNode, pitchScale = 1.0): void {
    this.playNoise(dest, 0.25, 2400, 'highpass', 0.18, pitchScale);
  }

  public playDaisyPick(dest: AudioNode): void {
    this.playTone(dest, 880, 0.2, 'sine', 0.25, { attack: 0.01, decay: 0.08, sustain: 0.4, release: 0.1 });
    this.playNoise(dest, 0.15, 1800, 'bandpass', 0.1);
  }

  public playWatchOpen(dest: AudioNode): void {
    this.playTone(dest, 2400, 0.05, 'square', 0.15, { attack: 0.002, decay: 0.02, sustain: 0.1, release: 0.02 });
  }

  public playWatchTick(dest: AudioNode): void {
    this.playTone(dest, 3200, 0.02, 'sine', 0.1, { attack: 0.001, decay: 0.01, sustain: 0.05, release: 0.01 });
  }

  public playRabbitScurry(dest: AudioNode): void {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this.playFootstepGrass(dest, 1.2), i * 90);
    }
  }

  public playHoleJump(dest: AudioNode): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.8);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.8);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.8);
  }

  public playJarPick(dest: AudioNode): void {
    this.playTone(dest, 1760, 0.15, 'sine', 0.2, { attack: 0.005, decay: 0.05, sustain: 0.3, release: 0.08 });
  }

  public playJarPlace(dest: AudioNode): void {
    this.playFootstepWood(dest, 0.8);
    setTimeout(() => this.playJarPick(dest), 40);
  }

  public playThoughtPop(dest: AudioNode): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.25);

    this.playTone(dest, 1046.5, 0.4, 'sine', 0.15, { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 });
  }

  public playLandThump(dest: AudioNode): void {
    this.playTone(dest, 80, 0.4, 'sine', 0.4, { attack: 0.01, decay: 0.15, sustain: 0.3, release: 0.2 });
    this.playFootstepLeaves(dest, 0.7);
  }

  public playDoorLocked(dest: AudioNode): void {
    this.playNoise(dest, 0.2, 1200, 'bandpass', 0.3);
    this.playTone(dest, 180, 0.15, 'triangle', 0.25);
  }

  public playKeyPick(dest: AudioNode): void {
    this.playTone(dest, 2800, 0.12, 'sine', 0.25, { attack: 0.002, decay: 0.04, sustain: 0.2, release: 0.06 });
  }

  public playKeyDown(dest: AudioNode): void {
    this.playTone(dest, 2200, 0.1, 'sine', 0.18, { attack: 0.002, decay: 0.03, sustain: 0.15, release: 0.05 });
  }

  public playKeyTurnSmall(dest: AudioNode): void {
    this.playTone(dest, 3000, 0.08, 'square', 0.15, { attack: 0.002, decay: 0.03, sustain: 0.2, release: 0.03 });
    setTimeout(() => this.playTone(dest, 3600, 0.1, 'sine', 0.2), 60);
  }

  public playCurtain(dest: AudioNode): void {
    this.playNoise(dest, 0.6, 600, 'lowpass', 0.2);
  }

  public playLittleDoor(dest: AudioNode): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(380, now + 0.5);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playCork(dest: AudioNode): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playDrink(dest: AudioNode): void {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        osc.frequency.setValueAtTime(350, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.18);
      }, i * 220);
    }
  }

  public playShrink(dest: AudioNode): void {
    // Whimsical descending slide whistle 1600 Hz -> 220 Hz
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 2.0);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 2.2);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 2.2);

    // Chime arpeggio over 2 seconds
    const freqs = [1046.5, 1318.5, 1567.98, 2093.0];
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        this.playTone(dest, freqs[i % 4]!, 0.3, 'sine', 0.12);
      }, i * 250);
    }
  }

  public playSlip(dest: AudioNode): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.4);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playSniffle(dest: AudioNode): void {
    this.playNoise(dest, 0.25, 1500, 'bandpass', 0.12);
    setTimeout(() => this.playNoise(dest, 0.25, 1800, 'bandpass', 0.1), 150);
  }

  public playBoxOpen(dest: AudioNode): void {
    this.playTone(dest, 2600, 0.15, 'sine', 0.2);
  }

  public playNibble(dest: AudioNode): void {
    this.playNoise(dest, 0.06, 3200, 'highpass', 0.2);
    setTimeout(() => this.playNoise(dest, 0.06, 3600, 'highpass', 0.2), 100);
  }

  // --- Procedural BGM Synthesizers (M1 to M7) ---

  public startMusicTrack(trackId: string, dest: AudioNode): () => void {
    let active = true;
    let timerId: number | null = null;

    if (trackId === 'M1') {
      // Title Waltz (Music box waltz D Major)
      const melody = [587.33, 659.25, 739.99, 880.0, 739.99, 659.25];
      let step = 0;
      timerId = window.setInterval(() => {
        if (!active) return;
        this.playTone(dest, melody[step % melody.length]!, 0.4, 'sine', 0.15);
        step++;
      }, 500);
    } else if (trackId === 'M2') {
      // Riverbank Afternoon (70 BPM F Major arpeggio)
      const notes = [349.23, 440.0, 523.25, 698.46, 523.25, 440.0];
      let step = 0;
      timerId = window.setInterval(() => {
        if (!active) return;
        this.playTone(dest, notes[step % notes.length]!, 0.6, 'sine', 0.12);
        step++;
      }, 600);
    } else if (trackId === 'M3') {
      // The Hurried Chase (140 BPM ticking woodblock & fast staccato)
      const notes = [440.0, 493.88, 523.25, 587.33];
      let step = 0;
      timerId = window.setInterval(() => {
        if (!active) return;
        this.playWatchTick(dest);
        if (step % 2 === 0) {
          this.playTone(dest, notes[(step / 2) % notes.length]!, 0.15, 'triangle', 0.15);
        }
        step++;
      }, 215);
    } else if (trackId === 'M4') {
      // Dreamy Descent (Slow dreamy swells)
      const notes = [261.63, 329.63, 392.0, 523.25];
      let step = 0;
      timerId = window.setInterval(() => {
        if (!active) return;
        this.playTone(dest, notes[step % notes.length]!, 1.2, 'sine', 0.1, { attack: 0.3, decay: 0.4, sustain: 0.6, release: 0.5 });
        step++;
      }, 1000);
    } else if (trackId === 'M5') {
      // The Dim Hall (A Minor waltz)
      const notes = [220.0, 261.63, 329.63, 440.0, 329.63, 261.63];
      let step = 0;
      timerId = window.setInterval(() => {
        if (!active) return;
        this.playTone(dest, notes[step % notes.length]!, 0.8, 'triangle', 0.12);
        step++;
      }, 800);
    } else if (trackId === 'M6') {
      // Garden Vista Stinger (Bright harp glissando)
      const gliss = [392.0, 493.88, 587.33, 783.99, 987.77, 1174.66];
      gliss.forEach((freq, idx) => {
        setTimeout(() => this.playTone(dest, freq, 0.8, 'sine', 0.2), idx * 80);
      });
    } else if (trackId === 'M7') {
      // Curious Finale (Questioning chord)
      const chord = [293.66, 369.99, 440.0, 554.37];
      chord.forEach((freq) => this.playTone(dest, freq, 2.5, 'sine', 0.1, { attack: 0.5, decay: 0.5, sustain: 0.8, release: 1.0 }));
    }

    return () => {
      active = false;
      if (timerId !== null) clearInterval(timerId);
    };
  }
}
