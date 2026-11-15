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
  recents: [], // things you asked for recently

  // voice
  listening: true, // hands-free listening on
  voiceState: 'off', // off | listening | denied | error
  heard: '', // live caption of what you are saying
  cmd: null, // { target, name, n } command for one item in the room
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

export const pendingEntity = (kind = 'model') =>
  state.entities.find((e) => e.status === 'pending' && e.kind === kind) || null;

// Start placing something new (replaces anything of the same kind still waiting to be placed)
export function addPending(entity) {
  const id = entity.id || newId();
  setState({
    entities: [
      ...state.entities.filter((e) => !(e.status === 'pending' && e.kind === entity.kind)),
      { ...entity, id, status: 'pending' },
    ],
    ...(entity.kind === 'model' ? { pendingLoad: 'loading' } : null),
    selectedId: null,
  });
  return id;
}

export function updateEntity(id, patch) {
  setState({ entities: state.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
}

export function removeEntity(id) {
  setState({
    // a video's step card goes with it
    entities: state.entities.filter((e) => e.id !== id && e.linkedTo !== id),
    selectedId: state.selectedId === id ? null : state.selectedId,
    soundId: state.soundId === id ? null : state.soundId,
  });
}

export function clearRoom() {
  setState({ entities: [], selectedId: null, soundId: null, pendingLoad: 'idle' });
}

let cmdN = 0;
export const sendCommand = (target, name) => setState({ cmd: { target, name, n: ++cmdN } });

let toastTimer = null;
export function toast(msg, ms = 3500) {
  clearTimeout(toastTimer);
  setState({ toast: msg });
  toastTimer = setTimeout(() => setState({ toast: null }), ms);
}
