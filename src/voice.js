// Hands-free listening: the app keeps listening while it is open, so you can just talk
// ("show me how to make pancakes", "bigger", "next step") like on AR glasses.
import { useEffect, useRef } from 'react';

let SR = null;
let useSREvent = () => {};
try {
  // eslint-disable-next-line global-require
  const mod = require('expo-speech-recognition');
  SR = mod.ExpoSpeechRecognitionModule;
  useSREvent = mod.useSpeechRecognitionEvent;
} catch (e) {
  SR = null;
}

export const voiceSupported = () => !!SR;

const START_OPTIONS = {
  lang: 'en-GB',
  interimResults: true,
  continuous: false,
  maxAlternatives: 1,
  iosTaskHint: 'search',
  iosCategory: {
    category: 'playAndRecord',
    categoryOptions: ['defaultToSpeaker', 'allowBluetooth', 'mixWithOthers'],
    mode: 'default',
  },
};

// enabled: keep listening. onHeard(text, isFinal) receives everything you say.
export function useVoice(enabled, onHeard, onState) {
  const on = useRef(enabled);
  const running = useRef(false);
  const restartTimer = useRef(null);
  const heard = useRef(onHeard);
  heard.current = onHeard;

  const start = async () => {
    if (!SR || running.current || !on.current) return;
    try {
      const perm = await SR.requestPermissionsAsync();
      if (!perm || !perm.granted) {
        onState && onState('denied');
        return;
      }
      running.current = true;
      SR.start(START_OPTIONS);
      onState && onState('listening');
    } catch (e) {
      running.current = false;
      onState && onState('error');
    }
  };

  const restart = (ms) => {
    clearTimeout(restartTimer.current);
    restartTimer.current = setTimeout(start, ms);
  };

  useSREvent('result', (e) => {
    const r = e && e.results && e.results[0];
    if (r && r.transcript) heard.current(r.transcript, !!e.isFinal);
  });
  useSREvent('end', () => {
    running.current = false;
    if (on.current) restart(250); // listen for the next thing you say
  });
  useSREvent('error', (e) => {
    running.current = false;
    const code = e && e.error;
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      on.current = false;
      onState && onState('denied');
      return;
    }
    if (on.current) restart(code === 'no-speech' ? 250 : 1500);
  });

  useEffect(() => {
    on.current = enabled;
    if (enabled) start();
    else {
      clearTimeout(restartTimer.current);
      try {
        SR && SR.abort();
      } catch (e) {
        // ignore
      }
      running.current = false;
      onState && onState('off');
    }
    return () => clearTimeout(restartTimer.current);
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Fast local understanding of simple commands, so they work instantly (and without AI)
const COMMANDS = [
  [/^(pause|stop)( it| the video| video)?$/, 'pause'],
  [/^(play|resume|continue)( it| the video| video)?$/, 'play'],
  [/^(next video|another video|skip( video)?|different video)$/, 'next_video'],
  [/^(mute|quiet|silence)( it)?$/, 'mute'],
  [/^(unmute|sound on|louder|turn (the )?sound on)$/, 'unmute'],
  [/^(bigger|make it bigger|larger|zoom in)$/, 'bigger'],
  [/^(smaller|make it smaller|shrink|zoom out)$/, 'smaller'],
  [/^(here|bring it here|come here|move it here|put it here|place it here|place it|put it there|place)$/, 'here'],
  [/^(remove( it)?|delete( it)?|close( it)?|get rid of it)$/, 'remove'],
  [/^(clear( everything| all| the room| my room)?|remove everything)$/, 'clear'],
  [/^(next step|next|done|what'?s next)$/, 'next_step'],
  [/^(previous step|go back|back|last step)$/, 'previous_step'],
];

export function quickCommand(text) {
  const t = text
    .toLowerCase()
    .replace(/[^a-z' ]/g, '')
    .replace(/^(hey |ok |okay )?(my view |view )?(please )?/, '')
    .replace(/ please$/, '')
    .trim();
  for (const [re, cmd] of COMMANDS) if (re.test(t)) return cmd;
  return null;
}

// Is this worth acting on? Filters out background talk (and voices coming from videos)
const ASK = /^(hey |ok |okay )?(my view |view )?(please )?(show|play|find|search|open|put|place|bring|add|give|teach|how|i want|i'd like|can you|could you|let me|watch|display|get me|make|what does|what is|explain)/;
export const looksLikeRequest = (text) => ASK.test(text.toLowerCase().trim());
