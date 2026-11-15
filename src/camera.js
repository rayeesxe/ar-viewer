// Live phone position in the room, shared by the AR scene and the pinned video screens.
import { Dimensions, PixelRatio } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

export const pose = {
  position: null, // [x, y, z] metres
  forward: [0, 0, -1],
  up: [0, 1, 0],
  floorY: null, // height of the floor once ARKit has seen it
  focal: H * 0.785, // screen points per metre at 1 m; refined by calibrate()
};

const listeners = new Set();
export const onPose = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const updatePose = (o) => {
  if (!o || !o.position) return;
  pose.position = o.position;
  if (o.forward) pose.forward = o.forward;
  if (o.up) pose.up = o.up;
  listeners.forEach((l) => l(pose));
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// Where a point in the room appears on screen. Returns null when it is behind you.
export function project(p) {
  if (!pose.position) return null;
  const f = pose.forward;
  const u = pose.up;
  const r = cross(f, u);
  const d = sub(p, pose.position);
  const z = dot(d, f);
  if (z < 0.15) return null;
  return {
    x: W / 2 + (pose.focal * dot(d, r)) / z,
    y: H / 2 - (pose.focal * dot(d, u)) / z,
    z,
  };
}

// A spot `dist` metres in front of you. onFloor: on the floor if known, else just below eye level.
export function frontPoint(dist, mode) {
  if (!pose.position) return null;
  const f = pose.forward;
  const len = Math.hypot(f[0], f[2]) || 1;
  const x = pose.position[0] + (f[0] / len) * dist;
  const z = pose.position[2] + (f[2] / len) * dist;
  let y = pose.position[1] - 0.45;
  let floating = true;
  if (mode === 'eye') {
    y = pose.position[1] - 0.05;
  } else if (pose.floorY != null) {
    const h = pose.position[1] - pose.floorY;
    if (h > 0.3 && h < 2.2) {
      y = pose.floorY;
      floating = false;
    }
  }
  return { pos: [x, y, z], floating };
}

// Turn angle (degrees) so something at p faces you
export const yawFacing = (p) =>
  pose.position
    ? (Math.atan2(pose.position[0] - p[0], pose.position[2] - p[2]) * 180) / Math.PI
    : 0;

// Use the AR engine's own projection once to match this phone's camera lens exactly.
let calibrated = false;
export async function calibrate(navigator) {
  if (calibrated || !pose.position || !navigator || !navigator.project) return;
  calibrated = true;
  try {
    const f = pose.forward;
    const r = cross(f, pose.up);
    const p = [
      pose.position[0] + f[0] + r[0] * 0.2,
      pose.position[1] + f[1] + r[1] * 0.2,
      pose.position[2] + f[2] + r[2] * 0.2,
    ];
    const res = await navigator.project(p);
    const sp = res && (res.screenPosition || res);
    if (!sp || sp.length < 2) return;
    let dx = Math.abs(sp[0] - W / 2);
    if (sp[0] > W * 1.2) dx = Math.abs(sp[0] / PixelRatio.get() - W / 2); // reported in pixels
    const focal = dx / 0.2;
    if (focal > 250 && focal < 1600) pose.focal = focal;
  } catch (e) {
    // keep the estimate
  }
}
