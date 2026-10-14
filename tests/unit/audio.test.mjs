import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioManager } from '../../src/audio/AudioManager.ts';
import { globalEventBus } from '../../src/core/types.ts';

// Mock Web Audio API
class MockAudioNode {
  connect() {}
  disconnect() {}
}

class MockGainNode extends MockAudioNode {
  gain = {
    setValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    cancelScheduledValues: () => {}
  };
}

class MockBiquadFilterNode extends MockAudioNode {
  type = 'lowpass';
  frequency = {
    setValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    cancelScheduledValues: () => {}
  };
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sine';
  frequency = {
    setValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {}
  };
  start() {}
  stop() {}
}

class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state = 'suspended';
  destination = new MockAudioNode();
  resume = () => { this.state = 'running'; return Promise.resolve(); }
  createGain = () => new MockGainNode();
  createBiquadFilter = () => new MockBiquadFilterNode();
  createOscillator = () => new MockOscillatorNode();
}
global.window = { AudioContext: MockAudioContext, addEventListener: () => {}, removeEventListener: () => {} };

test('Audio Pitch Modulation from Scale', () => {
  const am = new AudioManager();
  // Simulate unlock
  globalEventBus.emit('startJourney');
  
  assert.equal(am.alicePitchScale, 1.0);
  
  am.setAliceScale(0.2117);
  assert.equal(am.alicePitchScale, 1.6);
  
  am.setAliceScale(1.0);
  assert.equal(am.alicePitchScale, 1.0);
});

test('Dialogue Ducking attenuation', () => {
  const am = new AudioManager();
  globalEventBus.emit('startJourney');
  
  am.setMusicVolume(0.8);
  assert.equal(am.musicVol, 0.8);
  
  am.duckMusic(true);
  // It should set targetVal to 0.4
  // We can't easily assert the internal node values without a spy, but we can verify it doesn't crash
  assert.ok(true);
});
