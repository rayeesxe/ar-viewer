// Spoken replies. The microphone pauses while the app is talking so it doesn't hear itself.
import { setState } from './store';

let Speech = null;
try {
  // eslint-disable-next-line global-require
  Speech = require('expo-speech');
} catch (e) {
  Speech = null;
}

export function say(text) {
  if (!Speech || !text) return;
  try {
    Speech.stop();
    setState({ speaking: true });
    const done = () => setTimeout(() => setState({ speaking: false }), 400);
    Speech.speak(String(text), {
      language: 'en-GB',
      rate: 1.0,
      onDone: done,
      onStopped: done,
      onError: done,
    });
    // safety net in case no callback arrives
    setTimeout(() => setState({ speaking: false }), Math.min(20000, 2500 + String(text).length * 70));
  } catch (e) {
    setState({ speaking: false });
  }
}

export function hush() {
  try {
    Speech && Speech.stop();
  } catch (e) {
    // ignore
  }
  setState({ speaking: false });
}
