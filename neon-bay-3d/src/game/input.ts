/** Unified input written by keyboard, mouse and the touch UI; consumed by the player and camera each frame. */
export const input = {
  joyX: 0, joyY: 0, joyActive: false, // virtual stick, y up = forward (-1..1)
  keys: new Set<string>(),
  dash: false, // held
  crouchToggle: false, // edge
  jump: false, // edge
  action: false, // edge
  camCycle: false, // edge
  lookDX: 0, lookDY: 0, // accumulated pixels since last frame
  gas: false, brake: false, left: false, right: false, hb: false, // touch driving buttons (held)
  phone: false, // edge: toggle the in-game phone
};

export function moveVector(): [number, number] {
  if (input.joyActive) return [input.joyX, input.joyY];
  const k = input.keys;
  const x = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
  const y = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
  const l = Math.hypot(x, y) || 1; return [x / l, y / l];
}

let bound = false;
export function bindKeyboard() {
  if (bound) return; bound = true;
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'tab') e.preventDefault();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (!input.keys.has(k)) {
      if (k === ' ') input.jump = true;
      if (k === 'c' || k === 'control') input.crouchToggle = true;
      if (k === 'e' || k === 'f') input.action = true;
      if (k === 'v') input.camCycle = true;
      if (k === 'p' || k === 'tab') input.phone = true;
    }
    input.keys.add(k);
    input.dash = input.keys.has('shift');
  });
  addEventListener('keyup', (e) => { input.keys.delete(e.key.toLowerCase()); input.dash = input.keys.has('shift'); });
  addEventListener('blur', () => { input.keys.clear(); input.dash = false; releaseDrive(); input.joyActive = false; input.joyX = input.joyY = 0; });
}

/** Drop every held driving button (used when the touch controls swap between foot and car). */
export function releaseDrive() { input.gas = input.brake = input.left = input.right = input.hb = false; input.joyActive = false; input.joyX = input.joyY = 0; }
