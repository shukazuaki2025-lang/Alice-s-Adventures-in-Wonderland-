import { globalEventBus } from '../core/types';
import { ProceduralSynth } from './ProceduralSynth';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private synth: ProceduralSynth | null = null;

  // Master Buses
  private masterGain!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private ambientGain!: GainNode;
  private ambientFilter!: BiquadFilterNode;

  // Volume Settings
  private masterVol = 0.8;
  private musicVol = 0.7;
  private sfxVol = 0.85;

  // State
  private isUnlocked = false;

  public getIsUnlocked(): boolean {
    return this.isUnlocked;
  }
  private currentTrackId: string | null = null;
  private stopCurrentTrackFn: (() => void) | null = null;
  private alicePitchScale = 1.0;

  constructor() {
    this.bindEvents();
  }

  private initAudioContext(): void {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      // Create Master Gain and Busses
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVol, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVol, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVol, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.ambientFilter = this.ctx.createBiquadFilter();
      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.frequency.setValueAtTime(20000, this.ctx.currentTime);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.ambientGain.connect(this.ambientFilter);
      this.ambientFilter.connect(this.masterGain);

      this.synth = new ProceduralSynth(this.ctx);
      console.log('[AudioManager] AudioContext and procedural nodes initialized successfully');
    } catch (e) {
      console.error('[AudioManager] Failed to initialize AudioContext:', e);
    }
  }

  private bindEvents(): void {
    // Unlock autoplay on user click / touch / start Journey
    const unlock = () => {
      if (!this.ctx) {
        this.initAudioContext();
        const resumeCtx = () => {
          this.isUnlocked = true;
          console.log('[AudioManager] AudioContext unlocked via user gesture');
          if (this.currentTrackId) {
             const track = this.currentTrackId;
             this.currentTrackId = null;
             this.playMusic(track);
          }
        };
        const ctx = this.ctx as AudioContext | null;
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().then(resumeCtx);
        } else if (ctx) {
          resumeCtx();
        }
      }
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);

    globalEventBus.on('startJourney', () => unlock());

    // Dialogue Ducking (-6 dB music attenuation during spoken dialogue)
    globalEventBus.on('dialogueTrigger', () => this.duckMusic(true));
    globalEventBus.on('dialogueEnd', () => this.duckMusic(false));

    // Size-scaling pitch & filter modulation
    globalEventBus.on('scaleChanged', (scale: number) => this.setAliceScale(scale));

    // SFX triggers
    globalEventBus.on('playSfx', (sfxId: string) => this.playSfx(sfxId));

    // Music track triggers
    globalEventBus.on('playMusic', (trackId: string) => this.playMusic(trackId));
    
    // Automatically switch music on state change
    globalEventBus.on('stateChanged', (state: string) => {
      let track = 'M1';
      if (state === 'S0_TITLE') track = 'M1';
      else if (state === 'S1_BANK') track = 'M2';
      else if (state === 'S2_CHASE') track = 'M3';
      else if (state === 'S3_FALL') track = 'M4';
      else if (state === 'S4_PASSAGE' || state === 'S5_HALL') track = 'M5';
      else if (state === 'S6_SMALL') track = 'M6';
      else if (state === 'S7_CAKE' || state === 'END') track = 'M7';
      this.playMusic(track);
    });

    // Volume sliders
    globalEventBus.on('setMasterVolume', (v: number) => this.setMasterVolume(v));
    globalEventBus.on('setMusicVolume', (v: number) => this.setMusicVolume(v));
    globalEventBus.on('setSfxVolume', (v: number) => this.setSfxVolume(v));
  }

  public setMasterVolume(val: number): void {
    this.masterVol = Math.max(0, Math.min(1, val));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.masterVol, this.ctx.currentTime);
    }
  }

  public setMusicVolume(val: number): void {
    this.musicVol = Math.max(0, Math.min(1, val));
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setValueAtTime(this.musicVol, this.ctx.currentTime);
    }
  }

  public setSfxVolume(val: number): void {
    this.sfxVol = Math.max(0, Math.min(1, val));
    if (this.ctx && this.sfxGain) {
      this.sfxGain.gain.setValueAtTime(this.sfxVol, this.ctx.currentTime);
    }
  }

  /**
   * Duck BGM by -6 dB during dialogue
   */
  public duckMusic(duck: boolean): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const targetVal = duck ? this.musicVol * 0.5 : this.musicVol; // -6 dB is ~0.5x linear gain
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.linearRampToValueAtTime(targetVal, now + 0.5);
  }

  /**
   * Alice size-scaling audio modulation:
   * When small (scale <= 0.3): footstep/character SFX pitch scale = 1.6x, ambient filter cutoff = 1500 Hz
   * When normal (scale 1.0): pitch scale = 1.0x, ambient filter cutoff = 20000 Hz
   */
  public setAliceScale(scale: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (scale <= 0.3) {
      // Small Alice (0.254m)
      this.alicePitchScale = 1.6;
      this.ambientFilter.frequency.cancelScheduledValues(now);
      this.ambientFilter.frequency.exponentialRampToValueAtTime(1500, now + 0.8);
    } else {
      // Normal Alice (1.20m)
      this.alicePitchScale = 1.0;
      this.ambientFilter.frequency.cancelScheduledValues(now);
      this.ambientFilter.frequency.exponentialRampToValueAtTime(20000, now + 0.8);
    }
  }

  /**
   * Play procedural BGM track (M1 to M7)
   */
  public playMusic(trackId: string): void {
    if (this.currentTrackId === trackId) return;
    this.currentTrackId = trackId;
    if (!this.synth || !this.ctx) return;

    // Stop current track
    if (this.stopCurrentTrackFn) {
      this.stopCurrentTrackFn();
      this.stopCurrentTrackFn = null;
    }

    this.stopCurrentTrackFn = this.synth.startMusicTrack(trackId, this.musicGain);
    console.log(`[AudioManager] Playing procedural music track ${trackId}`);
  }

  /**
   * Play procedural SFX (SFX-01 to SFX-30)
   */
  public playSfx(sfxId: string): void {
    if (!this.synth || !this.ctx) return;

    switch (sfxId) {
      case 'sfx_step_grass':
        this.synth.playFootstepGrass(this.sfxGain, this.alicePitchScale);
        break;
      case 'sfx_step_wood':
        this.synth.playFootstepWood(this.sfxGain, this.alicePitchScale);
        break;
      case 'sfx_step_stone':
        this.synth.playFootstepStone(this.sfxGain, this.alicePitchScale);
        break;
      case 'sfx_step_leaves':
        this.synth.playFootstepLeaves(this.sfxGain, this.alicePitchScale);
        break;
      case 'sfx_daisy_pick':
        this.synth.playDaisyPick(this.sfxGain);
        break;
      case 'sfx_watch_open':
        this.synth.playWatchOpen(this.sfxGain);
        break;
      case 'sfx_rabbit_tick':
        this.synth.playWatchTick(this.sfxGain);
        break;
      case 'sfx_rabbit_scurry':
        this.synth.playRabbitScurry(this.sfxGain);
        break;
      case 'sfx_wind_loop':
        this.synth.playWindLoop(this.sfxGain);
        break;
      case 'sfx_hole_jump':
        this.synth.playHoleJump(this.sfxGain);
        break;
      case 'sfx_jar_grab':
        this.synth.playJarPick(this.sfxGain);
        break;
      case 'sfx_jar_return':
        this.synth.playJarPlace(this.sfxGain);
        break;
      case 'sfx_thought_pop':
        this.synth.playThoughtPop(this.sfxGain);
        break;
      case 'sfx_thump_land':
        this.synth.playLandThump(this.sfxGain);
        break;
      case 'sfx_door_rattle':
        this.synth.playDoorLocked(this.sfxGain);
        break;
      case 'sfx_key_pickup':
        this.synth.playKeyPick(this.sfxGain);
        break;
      case 'sfx_key_down':
        this.synth.playKeyDown(this.sfxGain);
        break;
      case 'sfx_key_turn_small':
        this.synth.playKeyTurnSmall(this.sfxGain);
        break;
      case 'sfx_curtain_slide':
        this.synth.playCurtain(this.sfxGain);
        break;
      case 'sfx_little_door':
        this.synth.playLittleDoor(this.sfxGain);
        break;
      case 'sfx_bottle_cork':
        this.synth.playCork(this.sfxGain);
        break;
      case 'sfx_drink_gulp':
        this.synth.playDrink(this.sfxGain);
        break;
      case 'sfx_shrink_magic':
        this.synth.playShrink(this.sfxGain);
        break;
      case 'sfx_table_slip':
        this.synth.playSlip(this.sfxGain);
        break;
      case 'sfx_sniffle':
        this.synth.playSniffle(this.sfxGain);
        break;
      case 'sfx_box_open':
        this.synth.playBoxOpen(this.sfxGain);
        break;
      case 'sfx_cake_eat':
        this.synth.playNibble(this.sfxGain);
        break;
      default:
        // Default chime
        this.synth.playTone(this.sfxGain, 880, 0.2, 'sine');
        break;
    }
  }

  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }
}
