// Shared app state: everything in your room, plus what the AR engine reports.
import { useSyncExternalStore } from 'react';

let state = {
  // Things in the room. Each: { id, kind: 'model' | 'video', status: 'pending' | 'placed',
  //   url, name, credit (models) | query (videos), pos, yaw, floating, auto }
  entities: [],
  selectedId: null, // placed object you tapped
  soundId: null, // the one video playing with sound
  placeNonce: 0, // increments when the user taps Place (or Siri places)
  pendingLoad: 'idle', // idle | loading | ready | error, for the object being placed

  // AR engine -> UI
  trackingOk: false,
  surfaceFound: false,
  aimOnSurface: false,

  // online search
  searchStatus: null,
  searchLog: null,
  toast: null,
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

export const useStore = (selector) => useSyncExternalStore(subscribe, () => selector(state));

// ----- room helpers -----
let seq = 0;
export const newId = () => `e${Date.now().toString(36)}${(seq++).toString(36)}`;

export const pendingEntity = () => state.entities.find((e) => e.status === 'pending') || null;

// Start placing something new (replaces anything still waiting to be placed)
export function addPending(entity) {
  const id = entity.id || newId();
  setState({
    entities: [...state.entities.filter((e) => e.status !== 'pending'), { ...entity, id, status: 'pending' }],
    pendingLoad: entity.kind === 'model' ? 'loading' : 'idle',
    selectedId: null,
  });
  return id;
}

export function updateEntity(id, patch) {
  setState({ entities: state.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
}

export function removeEntity(id) {
  setState({
    entities: state.entities.filter((e) => e.id !== id),
    selectedId: state.selectedId === id ? null : state.selectedId,
    soundId: state.soundId === id ? null : state.soundId,
  });
}

export function clearRoom() {
  setState({ entities: [], selectedId: null, soundId: null, pendingLoad: 'idle' });
}

let toastTimer = null;
export function toast(msg, ms = 3500) {
  clearTimeout(toastTimer);
  setState({ toast: msg });
  toastTimer = setTimeout(() => setState({ toast: null }), ms);
}
