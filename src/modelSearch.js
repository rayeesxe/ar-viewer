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

async function drawable(url, log) {
  try {
    let r = await fetch(url, { headers: { Range: 'bytes=0-19' } });
    if (!r.ok && r.status !== 206) {
      log && log.push(`file not reachable (${r.status})`);
      return false;
    }
    const head = await readBytes(r);
    if (!head) return true;
    const dv = new DataView(head.buffer);
    if (dv.getUint32(0, true) !== 0x46546c67) return false; // "glTF"
    const total = dv.getUint32(8, true);
    if (total > MAX_BYTES) {
      log && log.push('too large');
      return false;
    }
    const len = dv.getUint32(12, true);
    r = await fetch(url, { headers: { Range: `bytes=20-${19 + len}` } });
    const body = await readBytes(r);
    if (!body) return true;
    const json = JSON.parse(bytesToAscii(body));
    const used = (json.extensionsUsed || []).concat(json.extensionsRequired || []);
    const bad = used.filter((e) => BLOCKED.includes(e));
    if (bad.length) log && log.push('unsupported ' + bad[0].replace(/^(KHR|EXT)_/, ''));
    return !bad.length;
  } catch (e) {
    log && log.push('check failed: ' + (e && e.message));
    return false;
  }
}

async function fromSketchfab(q, onStatus, log) {
  if (!SKETCHFAB) {
    log.push('Sketchfab: no key');
    return null;
  }
  onStatus && onStatus('Searching Sketchfab');
  const r = await fetch(
    'https://api.sketchfab.com/v3/search?type=models&downloadable=true&count=12&max_face_count=400000&q=' +
      encodeURIComponent(q)
  );
  if (!r.ok) {
    log.push(`Sketchfab search error ${r.status}`);
    return null;
  }
  const j = await r.json();
  log.push(`Sketchfab: ${(j.results || []).length} results`);
  const picks = (j.results || [])
    .filter((m) => !failed.has('sf:' + m.uid))
    .filter((m) => !(m.archives && m.archives.glb && m.archives.glb.size > MAX_BYTES))
    .slice(0, 6);
  for (const m of picks) {
    try {
      const d = await fetch(`https://api.sketchfab.com/v3/models/${m.uid}/download`, {
        headers: { Authorization: `Token ${SKETCHFAB}` },
      });
      if (!d.ok) {
        log.push(`download refused ${d.status}${d.status === 401 || d.status === 403 ? ' (check the Sketchfab token)' : ''}`);
        if (d.status === 401 || d.status === 403) return null;
        continue;
      }
      const dl = await d.json();
      const url = dl.glb && dl.glb.url;
      if (!url) {
        log.push('no glb file');
        continue;
      }
      if (dl.glb.size && dl.glb.size > MAX_BYTES) continue;
      if (!(await drawable(url, log))) continue;
      return {
        key: 'sf:' + m.uid,
        url,
        name: m.name,
        credit: `${m.name} by ${(m.user && m.user.displayName) || 'Sketchfab artist'}${
          m.license && m.license.label ? `, ${m.license.label}` : ''
        } (Sketchfab)`,
      };
    } catch (e) {
      log.push('error ' + (e && e.message));
    }
  }
  return null;
}

async function fromPolyPizza(q, onStatus, log) {
  if (!POLYPIZZA) {
    log.push('Poly Pizza: no key');
    return null;
  }
  onStatus && onStatus('Searching Poly Pizza');
  const r = await fetch(
    `https://api.poly.pizza/v1/search/${encodeURIComponent(q)}?limit=8&format=glb`,
    { headers: { 'X-Auth-Token': POLYPIZZA } }
  );
  if (!r.ok) {
    log.push(`Poly Pizza error ${r.status}`);
    return null;
  }
  const j = await r.json();
  log.push(`Poly Pizza: ${(j.results || []).length} results`);
  for (const m of j.results || []) {
    const url = m.Download;
    if (failed.has('pp:' + url)) continue;
    if (!url || !(await drawable(url, log))) continue;
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

async function fromMeshy(q, onStatus, log) {
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

// Returns { model: { key, url, name, credit } | null, log: [what happened] }
export async function findModel(q, onStatus) {
  const log = [];
  for (const fn of [fromSketchfab, fromPolyPizza, fromMeshy]) {
    try {
      const m = await fn(q, onStatus, log);
      if (m) return { model: m, log };
    } catch (e) {
      log.push('network error: ' + (e && e.message));
    }
  }
  return { model: null, log };
}
