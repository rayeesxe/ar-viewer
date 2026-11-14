// Tiny shared store so the AR scene (rendered by Viro) and the app UI stay in sync.
import { useSyncExternalStore } from 'react';

let state = {
  // UI -> scene
  modelId: null,
  modelUrl: null,
  placeNonce: 0, // increments when the user taps "Place"
  placed: false,

  // scene -> UI
  trackingOk: false, // ARKit is tracking the room normally
  surfaceFound: false, // a floor/table has been detected at least once
  aimOnSurface: false, // the centre of the screen is on a detected surface
  loadState: 'idle', // idle | loading | ready | error
};

const listeners = new Set();

export const getState = () => state;

export const setState = (patch) => {
  const next = typeof patch === 'function' ? patch(state) : patch;
  let changed = false;
  for (const k in next) {
    if (state[k] !== next[k]) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// Select a single primitive value from the store.
export const useStore = (selector) =>
  useSyncExternalStore(subscribe, () => selector(state));
