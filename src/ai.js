// Gemini (free tier) as the app's brain: understands what you said, writes better
// searches, picks the best video, writes step-by-step cards and real-world sizes.
// Everything here is optional: without a key the app falls back to simple rules.
import Constants from 'expo-constants';

const extra = (Constants.expoConfig && Constants.expoConfig.extra) || {};
const KEY = extra.geminiKey || '';
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash'];

export const aiAvailable = () => !!KEY;

let goodModel = null;

async function ask(prompt, { timeoutMs = 9000, image = null } = {}) {
  if (!KEY) return null;
  const order = goodModel ? [goodModel, ...MODELS.filter((m) => m !== goodModel)] : MODELS;
  for (const model of order) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl ? ctrl.signal : undefined,
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: image
                  ? [{ inline_data: { mime_type: image.mime, data: image.data } }, { text: prompt }]
                  : [{ text: prompt }],
              },
            ],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
          }),
        }
      );
      if (timer) clearTimeout(timer);
      if (r.status === 404 || r.status === 400) continue; // model name not available: try the next
      if (!r.ok) {
        if (r.status === 429) continue; // rate limited on this model: try a lighter one
        return null;
      }
      const j = await r.json();
      const text =
        j.candidates &&
        j.candidates[0] &&
        j.candidates[0].content &&
        (j.candidates[0].content.parts || []).map((p) => p.text || '').join('');
      if (!text) continue;
      goodModel = model;
      return JSON.parse(text.replace(/^```(json)?|```$/g, '').trim());
    } catch (e) {
      if (timer) clearTimeout(timer);
    }
  }
  return null;
}

/*
 Turns anything you say into an action.
 Returns {
   action: 'video' | 'object' | 'both' | 'command' | 'none',
   video_query, object, size_m, steps: [..], command, target
 }
*/
export async function understand(text, room) {
  const roomList = (room || [])
    .map((e) => `${e.id}: ${e.kind === 'video' ? 'video screen about ' + e.query : '3D ' + e.name}`)
    .join('\n');
  const prompt = `You are the brain of "My View", an augmented reality app. The user wears/holds a device and talks to it hands free.
They can place YouTube video screens and 3D objects in their room, and control them by voice.

Things currently in the room:
${roomList || '(nothing yet)'}

The user just said: "${text}"

Decide what they want and reply with JSON only:
{
 "action": "video" (they want to watch/learn/listen: tutorials, recipes, music, news, how to do something)
         | "object" (they want to SEE a thing in 3D: an animal, landmark, planet, vehicle, body part, object)
         | "both" (a how-to where showing the thing in 3D also helps, e.g. "how does a heart work")
         | "answer" (a quick question with a short spoken answer, e.g. "how long do I boil an egg", "how many grams in a cup")
         | "look" (they want you to look through the camera: "what is this", "what am I looking at", "what can I make with this")
         | "command" (control something already in the room)
         | "none" (not meant for the app, background chatter),
 "answer": "for answer: the reply in 1 or 2 short spoken sentences",
 "suggestions": ["for answer: up to 3 short follow-up requests the user may want, e.g. 'show me how to boil an egg'"],
 "video_query": "best YouTube search for a clear, well-made video. For how-to and recipes ask for a step by step tutorial, avoid reviews, reactions and shorts",
 "object": "short English name of the 3D thing to find, e.g. 'pyramids of Giza', 'T rex', 'human heart'",
 "size_m": number, how big the object should appear in metres (largest side): its real size up to 6, landmarks and buildings as a 1 metre table model, planets 0.6,
 "steps": ["for how-to videos only: 4 to 8 short steps, max 8 words each"],
 "command": one of "pause","play","next_video","mute","unmute","bigger","smaller","here","remove","clear","next_step","previous_step",
 "target": "id from the room list the command is about, or empty for the most recent"
}`;
  const res = await ask(prompt);
  if (!res || !res.action) return null;
  return res;
}

// Pick the most useful video from search results.
// Returns { best: index, relevant: false when none of them is really what was asked for }
export async function pickBest(request, videos) {
  if (!KEY || !videos || !videos.length) return { best: 0, relevant: true };
  const list = videos
    .map((v, i) => `${i}: "${v.title}"${v.channel ? ' by ' + v.channel : ''}${v.length ? ' (' + v.length + ')' : ''}`)
    .join('\n');
  const res = await ask(
    `A user standing in their kitchen/room asked: "${request}". They want to watch it hands free on a screen.
Pick the single best video: a clear tutorial or the real thing they asked for, good quality, ideally 3 to 20 minutes.
Avoid reviews, reactions, compilations, shorts, clickbait and anything off topic.
The video must be about exactly what they asked for (a sandwich request must not get a cake video).
Videos:
${list}
Reply with JSON only: {"best": index, "relevant": true or false (false if none of them is about what they asked)}`,
    { timeoutMs: 7000 }
  );
  if (!res) return { best: 0, relevant: true };
  const i = Number(res.best);
  return {
    best: Number.isInteger(i) && i >= 0 && i < videos.length ? i : 0,
    relevant: res.relevant !== false,
  };
}

// A better search when the first results were off topic
export async function betterQuery(request, badTitles) {
  const res = await ask(
    `A YouTube search for "${request}" gave off-topic results like: ${badTitles.slice(0, 4).join(' | ')}.
Write one better YouTube search that will find a clear video of exactly what they asked for.
Reply with JSON only: {"query": "..."}`,
    { timeoutMs: 6000 }
  );
  return res && res.query ? String(res.query) : null;
}

// Look through the camera and answer
export async function lookAt(imageBase64, question, mime = 'image/jpeg') {
  const res = await ask(
    `You are "My View", an AR assistant looking through the user's phone camera. They asked: "${question}".
Answer helpfully in 1 to 3 short spoken sentences about what you can see. If they ask what they can make or do,
suggest the best idea. Then give up to 3 follow-up requests they could say, e.g. "show me how to make an omelette".
Reply with JSON only: {"answer": "...", "suggestions": ["..."]}`,
    { image: { mime, data: imageBase64 }, timeoutMs: 20000 }
  );
  return res && res.answer ? res : null;
}

// Short step list for a how-to, when understand() didn't provide one
export async function stepsFor(task) {
  const res = await ask(
    `Write a short step by step guide for: "${task}". 4 to 8 steps, max 8 words each.
Reply with JSON only: {"steps": ["..."]}`
  );
  return res && Array.isArray(res.steps) ? res.steps.slice(0, 8) : null;
}
