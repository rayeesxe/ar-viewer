// Finds a 3D model for anything you ask for, from online libraries, then AI as a last resort.
// Order: Sketchfab (150k+ free models) -> Poly Pizza (10k+ low-poly) -> Meshy AI (generates one).
// Every model is checked first so we only show ones the AR engine can actually draw.
import Constants from 'expo-constants';

const extra = (Constants.expoConfig && Constants.expoConfig.extra) || {};
const SKETCHFAB = extra.sketchfabToken || '';
const POLYPIZZA = extra.polyPizzaKey || '';
const MESHY = extra.meshyKey || '';

export const onlineSources = () => ({
  sketchfab: !!SKETCHFAB,
  polypizza: !!POLYPIZZA,
  meshy: !!MESHY,
});

// glTF features the AR engine cannot draw: compressed meshes/textures fail to load,
// and glass-type materials come out invisible. Finishing layers (specular, clearcoat,
// sheen) are simply ignored by the engine, so those models are still fine to show.
const BLOCKED = [
  'KHR_draco_mesh_compression',
  'EXT_meshopt_compression',
  'KHR_texture_basisu',
  'EXT_texture_webp',
  'EXT_texture_avif',
  'KHR_mesh_quantization',
  'KHR_materials_transmission',
  'KHR_materials_volume',
  'KHR_materials_diffuse_transmission',
  'KHR_materials_dispersion',
  'KHR_materials_pbrSpecularGlossiness',
];

const MAX_BYTES = 30e6; // keeps downloads quick on mobile data

// Models that failed to load on this phone, so a retry picks a different one
const failed = new Set();
export const markFailed = (key) => key && failed.add(key);

const bytesToAscii = (u8) => {
  let s = '';
  for (let i = 0; i < u8.length; i += 8192) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  }
  return s;
};

// Reads just the header of a .glb to see which features it uses.
async function readBytes(r) {
  try {
    return new Uint8Array(await r.arrayBuffer());
  } catch (e) {
    return null; // this phone can't read raw bytes: skip the check rather than reject everything
  }
}

async function drawable(url) {
  try {
    let r = await fetch(url, { headers: { Range: 'bytes=0-19' } });
    if (!r.ok && r.status !== 206) return false;
    const head = await readBytes(r);
    if (!head) return true;
    const dv = new DataView(head.buffer);
    if (dv.getUint32(0, true) !== 0x46546c67) return false; // "glTF"
    const total = dv.getUint32(8, true);
    if (total > MAX_BYTES) return false;
    const len = dv.getUint32(12, true);
    r = await fetch(url, { headers: { Range: `bytes=20-${19 + len}` } });
    const body = await readBytes(r);
    if (!body) return true;
    const json = JSON.parse(bytesToAscii(body));
    const used = (json.extensionsUsed || []).concat(json.extensionsRequired || []);
    return !used.some((e) => BLOCKED.includes(e));
  } catch (e) {
    return false;
  }
}

async function fromSketchfab(q, onStatus) {
  if (!SKETCHFAB) return null;
  onStatus && onStatus('Searching Sketchfab');
  const r = await fetch(
    'https://api.sketchfab.com/v3/search?type=models&downloadable=true&count=12&max_face_count=400000&q=' +
      encodeURIComponent(q)
  );
  if (!r.ok) return null;
  const j = await r.json();
  const picks = (j.results || [])
    .filter((m) => !failed.has('sf:' + m.uid))
    .filter((m) => !(m.archives && m.archives.glb && m.archives.glb.size > MAX_BYTES))
    .slice(0, 6);
  for (const m of picks) {
    try {
      const d = await fetch(`https://api.sketchfab.com/v3/models/${m.uid}/download`, {
        headers: { Authorization: `Token ${SKETCHFAB}` },
      });
      if (!d.ok) continue;
      const dl = await d.json();
      const url = dl.glb && dl.glb.url;
      if (!url) continue;
      if (dl.glb.size && dl.glb.size > MAX_BYTES) continue;
      if (!(await drawable(url))) continue;
      return {
        key: 'sf:' + m.uid,
        url,
        name: m.name,
        credit: `${m.name} by ${(m.user && m.user.displayName) || 'Sketchfab artist'}${
          m.license && m.license.label ? `, ${m.license.label}` : ''
        } (Sketchfab)`,
      };
    } catch (e) {
      // try the next model
    }
  }
  return null;
}

async function fromPolyPizza(q, onStatus) {
  if (!POLYPIZZA) return null;
  onStatus && onStatus('Searching Poly Pizza');
  const r = await fetch(
    `https://api.poly.pizza/v1/search/${encodeURIComponent(q)}?limit=8&format=glb`,
    { headers: { 'X-Auth-Token': POLYPIZZA } }
  );
  if (!r.ok) return null;
  const j = await r.json();
  for (const m of j.results || []) {
    const url = m.Download;
    if (failed.has('pp:' + url)) continue;
    if (!url || !(await drawable(url))) continue;
    const by = (m.Creator && m.Creator.Username) || 'Poly Pizza artist';
    return {
      key: 'pp:' + url,
      url,
      name: m.Title || q,
      credit: `${m.Title || q} by ${by}${m.Licence ? `, ${m.Licence}` : ''} (Poly Pizza)`,
    };
  }
  return null;
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function meshyTask(body) {
  const r = await fetch('https://api.meshy.ai/openapi/v2/text-to-3d', {
    method: 'POST',
    headers: { Authorization: `Bearer ${MESHY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.result || null;
}

async function meshyWait(id, onStatus, label) {
  for (let i = 0; i < 90; i++) {
    await sleep(4000);
    const r = await fetch(`https://api.meshy.ai/openapi/v2/text-to-3d/${id}`, {
      headers: { Authorization: `Bearer ${MESHY}` },
    });
    if (!r.ok) continue;
    const t = await r.json();
    if (t.status === 'SUCCEEDED') return t;
    if (t.status === 'FAILED' || t.status === 'CANCELED') return null;
    onStatus && onStatus(`${label} ${t.progress ? `${t.progress}%` : ''}`.trim());
  }
  return null;
}

async function fromMeshy(q, onStatus) {
  if (!MESHY) return null;
  onStatus && onStatus('Creating a 3D model with AI');
  const preview = await meshyTask({ mode: 'preview', prompt: q, art_style: 'realistic' });
  if (!preview) return null;
  const shaped = await meshyWait(preview, onStatus, 'Shaping');
  if (!shaped) return null;
  let done = shaped;
  const refine = await meshyTask({ mode: 'refine', preview_task_id: preview });
  if (refine) {
    onStatus && onStatus('Painting textures');
    done = (await meshyWait(refine, onStatus, 'Painting')) || shaped;
  }
  const url = done.model_urls && done.model_urls.glb;
  if (!url) return null;
  return { key: 'ai:' + url, url, name: q, credit: `${q}, created with Meshy AI` };
}

// Returns { url, name, credit } or null when nothing could be found or made.
export async function findModel(q, onStatus) {
  for (const fn of [fromSketchfab, fromPolyPizza, fromMeshy]) {
    try {
      const m = await fn(q, onStatus);
      if (m) return m;
    } catch (e) {
      // move on to the next source
    }
  }
  return null;
}
