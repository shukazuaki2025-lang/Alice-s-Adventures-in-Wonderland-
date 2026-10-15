import { test } from 'node:test';
import assert from 'node:assert/strict';

// ---- minimal DOM so the engine classes can be constructed in Node ------------------------------------------------
class FakeTarget {
  constructor() {
    this.listeners = new Map();
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  dispatch(type, ev = {}) {
    const e = { preventDefault() {}, target: { closest: () => null }, ...ev };
    for (const fn of this.listeners.get(type) ?? []) fn(e);
    return e;
  }
}
const win = new FakeTarget();
win.innerWidth = 1280;
win.innerHeight = 720;
const doc = new FakeTarget();
doc.body = { classList: { toggle() {} } };
doc.getElementById = () => null;
doc.pointerLockElement = null;
globalThis.window = win;
globalThis.document = doc;
Object.defineProperty(globalThis, 'navigator', { value: { gpu: undefined }, configurable: true });
globalThis.performance ??= { now: () => Date.now() };

const THREE = await import('three');
const { CameraRig } = await import('../../src/engine/CameraRig.ts');
const { CharacterController } = await import('../../src/physics/CharacterController.ts');
const { PhysicsWorld } = await import('../../src/physics/PhysicsWorld.ts');
const { InputManager } = await import('../../src/engine/InputManager.ts');
const { locomotionTargets } = await import('../../src/game/entities/AliceEntity.ts');

const DT = 1 / 60;

function makeInput() {
  const input = new InputManager();
  return input;
}

test('InputManager: drag, wheel, touch and focus loss', async (t) => {
  await t.test('hold + drag accumulates look radians (right = positive yaw, down = positive pitch)', () => {
    const input = makeInput();
    win.dispatch('pointerdown', { pointerType: 'mouse', clientX: 400, clientY: 300, buttons: 1, button: 0, pointerId: 1 });
    win.dispatch('pointermove', { pointerType: 'mouse', clientX: 500, clientY: 330, buttons: 1, pointerId: 1 });
    const look = input.consumeLook();
    assert.ok(look.x > 0.3 && look.x < 0.6, `yaw delta ${look.x}`);
    assert.ok(look.y > 0.08 && look.y < 0.2, `pitch delta ${look.y}`);
    assert.deepEqual(input.consumeLook(), { x: 0, y: 0 }, 'consume resets the accumulator');
    win.dispatch('pointerup', { pointerType: 'mouse', buttons: 0, pointerId: 1 });
    win.dispatch('pointermove', { pointerType: 'mouse', clientX: 700, clientY: 330, buttons: 0, pointerId: 1 });
    assert.deepEqual(input.consumeLook(), { x: 0, y: 0 }, 'moving without a button held does not orbit');
  });

  await t.test('right and middle buttons orbit too', () => {
    for (const buttons of [2, 4]) {
      const input = makeInput();
      win.dispatch('pointerdown', { pointerType: 'mouse', clientX: 400, clientY: 300, buttons, button: buttons === 2 ? 2 : 1, pointerId: 2 });
      win.dispatch('pointermove', { pointerType: 'mouse', clientX: 360, clientY: 300, buttons, pointerId: 2 });
      assert.ok(input.consumeLook().x < 0, `buttons=${buttons}`);
      win.dispatch('pointerup', { pointerType: 'mouse', buttons: 0, pointerId: 2 });
    }
  });

  await t.test('presses that start on interactive UI never orbit', () => {
    const input = makeInput();
    const onButton = { closest: () => ({ tagName: 'BUTTON' }) };
    win.dispatch('pointerdown', { pointerType: 'mouse', clientX: 10, clientY: 10, buttons: 1, button: 0, pointerId: 3, target: onButton });
    win.dispatch('pointermove', { pointerType: 'mouse', clientX: 200, clientY: 10, buttons: 1, pointerId: 3 });
    assert.deepEqual(input.consumeLook(), { x: 0, y: 0 });
    win.dispatch('pointerup', { pointerType: 'mouse', buttons: 0, pointerId: 3 });
  });

  await t.test('a single giant movement spike is clamped', () => {
    const input = makeInput();
    win.dispatch('pointerdown', { pointerType: 'mouse', clientX: 0, clientY: 0, buttons: 1, button: 0, pointerId: 4 });
    win.dispatch('pointermove', { pointerType: 'mouse', clientX: 5000, clientY: 0, buttons: 1, pointerId: 4 });
    assert.ok(input.consumeLook().x < 0.7);
    win.dispatch('pointerup', { pointerType: 'mouse', buttons: 0, pointerId: 4 });
  });

  await t.test('wheel zoom accumulates and window blur releases stuck keys', () => {
    const input = makeInput();
    win.dispatch('wheel', { deltaY: 100, deltaMode: 0 });
    win.dispatch('wheel', { deltaY: 100, deltaMode: 0 });
    assert.ok(input.consumeZoom() > 1.5);
    win.dispatch('keydown', { code: 'KeyW', repeat: false });
    assert.equal(input.update().z, -1);
    win.dispatch('blur', {});
    assert.equal(input.update().lengthSq(), 0, 'blur must clear held keys');
  });

  await t.test('Shift = sprint', () => {
    const input = makeInput();
    assert.equal(input.sprint, false);
    win.dispatch('keydown', { code: 'ShiftLeft', repeat: false });
    assert.equal(input.sprint, true);
    win.dispatch('keyup', { code: 'ShiftLeft' });
    assert.equal(input.sprint, false);
  });
});

test('CameraRig: orbit, zoom, framing', async (t) => {
  await t.test('mouse right turns the view right (camera orbits left); mouse down raises the camera', () => {
    const rig = new CameraRig();
    const p = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < 90; i++) rig.update(p, DT);
    const x0 = rig.camera.position.x;
    const y0 = rig.camera.position.y;
    rig.applyMouseDelta(0.5, 0.15);
    for (let i = 0; i < 90; i++) rig.update(p, DT);
    assert.ok(rig.yaw < -0.4, `yaw ${rig.yaw}`);
    assert.ok(rig.camera.position.x < x0 - 0.5, 'camera moved around the player');
    assert.ok(rig.camera.position.y > y0, 'camera rose');
    // the lens keeps looking at the player
    const dir = rig.camera.getWorldDirection(new THREE.Vector3());
    const toTarget = rig.target.clone().sub(rig.camera.position).normalize();
    assert.ok(dir.dot(toTarget) > 0.99);
  });

  await t.test('pitch is clamped and the lens never goes below the floor', () => {
    const rig = new CameraRig();
    const p = new THREE.Vector3(0, 0, 0);
    rig.applyMouseDelta(0, -50);
    for (let i = 0; i < 120; i++) rig.update(p, DT);
    assert.ok(rig.camera.position.y >= 0.05, `y ${rig.camera.position.y}`);
    rig.applyMouseDelta(0, 50);
    for (let i = 0; i < 120; i++) rig.update(p, DT);
    assert.ok(rig.pitch <= (80 * Math.PI) / 180 + 1e-6);
  });

  await t.test('wheel zoom is smooth and clamped to a sane range', () => {
    const rig = new CameraRig();
    const p = new THREE.Vector3();
    for (let i = 0; i < 400; i++) rig.zoomBy(-5);
    for (let i = 0; i < 120; i++) rig.update(p, DT);
    assert.ok(rig.zoom >= 0.44 && rig.zoom < 0.5);
    for (let i = 0; i < 400; i++) rig.zoomBy(5);
    for (let i = 0; i < 240; i++) rig.update(p, DT);
    assert.ok(rig.zoom <= 1.91 && rig.zoom > 1.8);
  });

  await t.test('small Alice gets a close camera profile', () => {
    const rig = new CameraRig();
    rig.updateProfile(0.2117);
    for (let i = 0; i < 200; i++) rig.update(new THREE.Vector3(), DT);
    assert.ok(rig.distance < 1.0, `distance ${rig.distance}`);
  });
});

test('CharacterController: camera-relative, smoothed locomotion', async (t) => {
  const make = () => {
    const c = new CharacterController(new PhysicsWorld());
    c.currentState = 'S5_HALL';
    return c;
  };

  await t.test('W walks away from the lens for any camera yaw', () => {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 3]) {
      const c = make();
      for (let i = 0; i < 60; i++) c.update(DT, new THREE.Vector3(0, 0, -1), yaw, false);
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const moved = c.position.clone().setY(0);
      assert.ok(moved.length() > 0.5, `moved ${moved.length()}`);
      assert.ok(moved.normalize().dot(fwd) > 0.999, `yaw ${yaw}`);
    }
  });

  await t.test('velocity eases in and out (no instant snap) and reaches walking speed', () => {
    const c = make();
    c.update(DT, new THREE.Vector3(0, 0, -1), 0, false);
    assert.ok(c.speed > 0 && c.speed < 0.45 * c.moveSpeed, `first-frame speed ${c.speed}`);
    for (let i = 0; i < 60; i++) c.update(DT, new THREE.Vector3(0, 0, -1), 0, false);
    assert.ok(Math.abs(c.speed - 1.4) < 0.05, `steady speed ${c.speed}`);
    c.update(DT, new THREE.Vector3(), 0, false);
    assert.ok(c.speed > 0.4 * 1.4, 'braking is gradual');
    for (let i = 0; i < 60; i++) c.update(DT, new THREE.Vector3(), 0, false);
    assert.equal(c.speed, 0);
  });

  await t.test('Shift runs faster than walking, small Alice is slower, giant faster', () => {
    const walk = make();
    const run = make();
    for (let i = 0; i < 90; i++) {
      walk.update(DT, new THREE.Vector3(0, 0, -1), 0, false);
      run.update(DT, new THREE.Vector3(0, 0, -1), 0, true);
    }
    assert.ok(run.speed > walk.speed * 1.5);
    assert.equal(run.isRunning, true);
    const small = make();
    small.setScale(0.2117, false);
    for (let i = 0; i < 90; i++) small.update(DT, new THREE.Vector3(0, 0, -1), 0, false);
    assert.ok(small.speed < 0.6);
  });

  await t.test('facing turns smoothly toward the direction of travel', () => {
    const c = make();
    c.setFacing(Math.PI); // facing -Z
    const samples = [];
    for (let i = 0; i < 90; i++) {
      c.update(DT, new THREE.Vector3(1, 0, 0), 0, false); // walk right: should face +X (yaw = PI/2)
      samples.push(c.rotation.y);
    }
    const firstStep = Math.abs(samples[0] - Math.PI);
    assert.ok(firstStep < 0.35, `first-frame turn ${firstStep}`);
    assert.ok(Math.abs(samples.at(-1) - Math.PI / 2) < 0.05, `final yaw ${samples.at(-1)}`);
    for (let i = 1; i < samples.length; i++) {
      assert.ok(samples[i] <= samples[i - 1] + 1e-9, 'monotonic turn, no overshoot / wobble');
    }
  });

  await t.test('walk bounds clamp the player and floor slabs are not walls', () => {
    const phys = new PhysicsWorld();
    phys.addStaticBox('COL_floor', new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(30, 0.1, 20), 'global');
    phys.setWalkBounds({ minX: -2, maxX: 2, minZ: -2, maxZ: 2 });
    const c = new CharacterController(phys);
    c.init(new THREE.Vector3(0, 0, 0));
    for (let i = 0; i < 300; i++) c.update(DT, new THREE.Vector3(0, 0, -1), 0, true);
    assert.ok(c.position.z > -2 && c.position.z < -1.5, `z ${c.position.z}`);
    assert.ok(Math.abs(c.position.x) < 1e-6, 'walking straight ahead must not drift sideways (floor slab ejection bug)');
  });
});

test('Alice locomotion blend: continuous idle -> walk -> run', () => {
  const at = (s) => locomotionTargets(s);
  assert.deepEqual(at(0), { idle: 1, walk: 0, run: 0 });
  assert.ok(at(1.2).walk > 0.99);
  assert.ok(at(2.6).run > 0.99);
  let prev = at(0);
  for (let s = 0.02; s < 3; s += 0.02) {
    const cur = at(s);
    const jump = Math.abs(cur.idle - prev.idle) + Math.abs(cur.walk - prev.walk) + Math.abs(cur.run - prev.run);
    assert.ok(jump < 0.2, `blend jumped ${jump} at ${s}`);
    assert.ok(Math.abs(cur.idle + cur.walk + cur.run - 1) < 1e-9, 'weights sum to 1');
    prev = cur;
  }
});
