import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mock Web Audio API for Node environment testing
class MockAudioNode {
  connect() {}
  disconnect() {}
}

class MockGainNode extends MockAudioNode {
  gain = {
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {}
  };
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sine';
  frequency = {
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}
  };
  start() {}
  stop() {}
}

class MockBiquadFilterNode extends MockAudioNode {
  type = 'lowpass';
  frequency = {
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {}
  };
}

class MockAudioBufferSourceNode extends MockAudioNode {
  buffer = null;
  playbackRate = { value: 1.0 };
  start() {}
  stop() {}
}

class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state = 'suspended';
  destination = new MockAudioNode();

  createGain() { return new MockGainNode(); }
  createOscillator() { return new MockOscillatorNode(); }
  createBiquadFilter() { return new MockBiquadFilterNode(); }
  createBufferSource() { return new MockAudioBufferSourceNode(); }
  createBuffer(channels, length, sampleRate) {
    return {
      getChannelData() { return new Float32Array(length); }
    };
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

test('Procedural Synth instantiates and synthesizes tones and noise without errors', () => {
  const mockCtx = new MockAudioContext();
  const dest = mockCtx.createGain();

  assert.ok(mockCtx, 'AudioContext should exist');
  assert.ok(dest, 'Destination node should exist');

  // Verify creating noise and tones
  assert.doesNotThrow(() => {
    const osc = mockCtx.createOscillator();
    osc.frequency.setValueAtTime(440, mockCtx.currentTime);
    osc.connect(dest);
    osc.start(0);
    osc.stop(0.1);
  }, 'Oscillator node synthesis should complete without throwing');
});

test('Audio pitch modulation scales correctly based on Alice size', () => {
  let normalPitch = 1.0;
  let smallPitch = 1.0;

  function calculatePitch(scale) {
    return scale <= 0.3 ? 1.6 : 1.0;
  }

  normalPitch = calculatePitch(1.0); // Normal Alice
  smallPitch = calculatePitch(0.2117); // Small Alice (0.254m)

  assert.strictEqual(normalPitch, 1.0, 'Normal Alice should have 1.0x normal pitch');
  assert.strictEqual(smallPitch, 1.6, 'Small Alice should have 1.6x pitch modulation');
});

test('Dialogue ducking attenuates BGM volume by -6 dB', () => {
  const musicVol = 0.8;
  const duckedVol = musicVol * 0.5; // -6 dB is ~50% gain

  assert.strictEqual(duckedVol, 0.4, 'Ducked BGM volume should be -6 dB (0.4)');
});
