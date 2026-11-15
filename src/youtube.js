// Finds YouTube videos for a spoken or typed request.
// 1) YouTube Data API if a key was built in, 2) YouTube's own results page, 3) a public mirror.
import Constants from 'expo-constants';

const API_KEY =
  (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.youtubeKey) || '';

const decode = (s) =>
  s
    .replace(/\\u0026/g, '&')
    .replace(/\\"/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

async function viaApi(q) {
  if (!API_KEY) return [];
  const url =
    'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=6&videoEmbeddable=true&safeSearch=moderate&q=' +
    encodeURIComponent(q) +
    '&key=' +
    API_KEY;
  const r = await fetch(url);
  if (!r.ok) return [];
  const j = await r.json();
  return (j.items || [])
    .filter((i) => i.id && i.id.videoId)
    .map((i) => ({ id: i.id.videoId, title: decode(i.snippet.title || '') }));
}

async function viaResultsPage(q) {
  const r = await fetch(
    'https://www.youtube.com/results?hl=en&gl=GB&search_query=' + encodeURIComponent(q),
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Accept-Language': 'en-GB,en;q=0.9',
        Cookie: 'SOCS=CAI; CONSENT=YES+1',
      },
    }
  );
  if (!r.ok) return [];
  const html = await r.text();
  const out = [];
  const re = /"videoRenderer":\{"videoId":"([\w-]{11})"/g;
  let m;
  while ((m = re.exec(html)) && out.length < 6) {
    const id = m[1];
    if (out.some((v) => v.id === id)) continue;
    const chunk = html.slice(m.index, m.index + 3000);
    const t = chunk.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/);
    out.push({ id, title: t ? decode(t[1]) : '' });
  }
  return out;
}

async function viaMirror(q) {
  const r = await fetch(
    'https://pipedapi.kavin.rocks/search?filter=videos&q=' + encodeURIComponent(q)
  );
  if (!r.ok) return [];
  const j = await r.json();
  return (j.items || [])
    .map((i) => {
      const m = i.url && i.url.match(/v=([\w-]{11})/);
      return m ? { id: m[1], title: i.title || '' } : null;
    })
    .filter(Boolean)
    .slice(0, 6);
}

export async function searchVideos(q) {
  for (const fn of [viaApi, viaResultsPage, viaMirror]) {
    try {
      const v = await fn(q);
      if (v.length) return v;
    } catch (e) {
      // try the next source
    }
  }
  return [];
}

// Turns what Siri heard into a good search ("make a sandwich" -> "how to make a sandwich").
export function toSearchQuery(text) {
  const t = (text || '').trim();
  if (/^how\b/i.test(t)) return t;
  if (/^(make|cook|bake|build|fix|draw|tie|fold|clean|change|do|play|learn|grow|paint)\b/i.test(t))
    return `how to ${t}`;
  return t;
}
