// My View: fill your room with 3D objects and YouTube screens that stay where you put them.
// Siri or search looks in our own storage first, then online 3D libraries, then YouTube.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Keyboard,
  LogBox,
  Linking,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ViroARSceneNavigator } from '@reactvision/react-viro';
import ARScene from './src/ARScene';
import VideoEntity, { DEFAULT_SIZE } from './src/VideoEntity';
import { CATALOG, CATEGORIES } from './src/catalog';
import { toSearchQuery } from './src/youtube';
import { findModel, markFailed } from './src/modelSearch';
import { pose, frontPoint, yawFacing } from './src/camera';
import {
  getState,
  setState,
  useStore,
  addPending,
  pendingEntity,
  updateEntity,
  removeEntity,
  clearRoom,
  toast,
  newId,
} from './src/store';

LogBox.ignoreAllLogs(true);

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = Math.round(SCREEN_H * 0.66);
const PEEK = 92;
const CLOSED_Y = SHEET_H - PEEK;
const OPEN_Y = 0;

const SUGGESTIONS = [
  'pyramids of Giza',
  'how to make a sandwich',
  'solar system',
  'T rex',
  'how to tie a tie',
  'Eiffel Tower',
  'human heart',
  'lofi music',
];

// Put a video screen at eye level in front of you, beside any screens already there
function placeVideo(id) {
  const fp = frontPoint(1.6, 'eye');
  if (!fp) return false;
  const me = getState().entities.find((e) => e.id === id);
  const size = (me && me.size) || DEFAULT_SIZE;
  let pos = fp.pos;
  const others = getState().entities.filter(
    (e) => e.id !== id && e.kind === 'video' && e.status === 'placed' && e.pos
  );
  const f = pose.forward;
  const len = Math.hypot(f[0], f[2]) || 1;
  const right = [-f[2] / len, 0, f[0] / len];
  const gap = size + 0.15;
  for (let i = 0; i < 8 && others.some((o) => Math.hypot(o.pos[0] - pos[0], o.pos[2] - pos[2]) < gap * 0.8); i++) {
    const step = (i % 2 === 0 ? 1 : -1) * gap * (Math.floor(i / 2) + 1);
    pos = [fp.pos[0] + right[0] * step, fp.pos[1], fp.pos[2] + right[2] * step];
  }
  updateEntity(id, { status: 'placed', pos, yaw: yawFacing(pos), floating: true, size });
  setState({ soundId: id });
  return true;
}

// Bring a placed object to about a metre in front of you
function bringHere(id) {
  const fp = frontPoint(1.0);
  if (!fp) return;
  updateEntity(id, { pos: fp.pos, yaw: yawFacing(fp.pos), floating: fp.floating });
}

// Another copy of an object, just to its right
function duplicate(e) {
  if (!e || !e.pos) return;
  const f = pose.forward;
  const len = Math.hypot(f[0], f[2]) || 1;
  const pos = [e.pos[0] - (f[2] / len) * 0.5, e.pos[1], e.pos[2] + (f[0] / len) * 0.5];
  const id = newId();
  setState({
    entities: [...getState().entities, { ...e, id, pos, yaw: yawFacing(pos) }],
    selectedId: id,
  });
}

const remember = (q) => {
  const r = [q, ...(getState().recents || []).filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
  setState({ recents: r });
};

export default function App() {
  const entities = useStore((s) => s.entities);
  const selectedId = useStore((s) => s.selectedId);
  const trackingOk = useStore((s) => s.trackingOk);
  const surfaceFound = useStore((s) => s.surfaceFound);
  const aimOnSurface = useStore((s) => s.aimOnSurface);
  const pendingLoad = useStore((s) => s.pendingLoad);
  const searchStatus = useStore((s) => s.searchStatus);
  const searchLog = useStore((s) => s.searchLog);
  const toastMsg = useStore((s) => s.toast);
  const recents = useStore((s) => s.recents);

  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchId = useRef(0);
  const autoId = useRef(null); // the item Siri asked for: place it without waiting for a tap
  const retry = useRef(null); // online model that failed to load: try the next match

  const pending = entities.find((e) => e.status === 'pending') || null;
  const pendingModel = pending && pending.kind === 'model' ? pending : null;
  const selected = entities.find((e) => e.id === selectedId) || null;
  const placed = entities.filter((e) => e.status === 'placed');
  const videos = entities.filter((e) => e.kind === 'video');

  // ----- swipe-up sheet -----
  const sheetY = useRef(new Animated.Value(CLOSED_Y)).current;
  const sheetStart = useRef(CLOSED_Y);
  const animateSheet = (open) => {
    setSheetOpen(open);
    if (!open) Keyboard.dismiss();
    Animated.spring(sheetY, {
      toValue: open ? OPEN_Y : CLOSED_Y,
      useNativeDriver: true,
      damping: 22,
      stiffness: 200,
    }).start();
  };
  const sheetPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => sheetY.stopAnimation((v) => (sheetStart.current = v)),
      onPanResponderMove: (_, g) =>
        sheetY.setValue(Math.min(CLOSED_Y, Math.max(OPEN_Y, sheetStart.current + g.dy))),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dy) < 4) return animateSheet(sheetStart.current > CLOSED_Y / 2);
        const v = sheetStart.current + g.dy;
        animateSheet(g.vy < -0.3 || (g.vy < 0.3 && v < CLOSED_Y / 2));
      },
    })
  ).current;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inCat = cat === 'All' ? CATALOG : CATALOG.filter((o) => o.cat === cat);
    if (!q) return inCat;
    return inCat.filter((o) => `${o.name} ${o.tags} ${o.cat}`.toLowerCase().includes(q));
  }, [query, cat]);

  // ----- adding things -----
  const addModel = (item, auto) => {
    searchId.current++;
    const id = addPending({ kind: 'model', url: item.url, name: item.name, credit: item.credit || null });
    autoId.current = auto ? id : null;
    animateSheet(false);
    return id;
  };

  const addVideo = (q, auto) => {
    remember(q);
    const id = addPending({ kind: 'video', query: toSearchQuery(q) });
    autoId.current = auto ? id : null;
    animateSheet(false);
    if (auto && getState().trackingOk && placeVideo(id)) autoId.current = null;
    return id;
  };

  // Our storage first (catalog), then online 3D libraries, then a YouTube screen
  const showAnything = async (q, auto) => {
    const norm = q
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\b(a|an|the|some|me|show|please)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const local = CATALOG.find(
      (c) =>
        c.id === norm ||
        c.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim() === norm ||
        c.name.toLowerCase().endsWith(' ' + norm)
    );
    remember(q);
    if (local) return addModel(local, auto);
    const sid = ++searchId.current;
    animateSheet(false);
    setState({ searchStatus: `Looking for ${q}` });
    const { model, log } = await findModel(q, (st) => searchId.current === sid && setState({ searchStatus: `${st}...` }));
    if (searchId.current !== sid) return;
    setState({ searchStatus: null, searchLog: `${q}: ${log.join(' · ')}` });
    if (!model) {
      toast(`No 3D model of "${q}" found, here is a video instead`);
      return addVideo(q, auto);
    }
    retry.current = { q, auto, key: model.key, tries: retry.current && retry.current.q === q ? retry.current.tries : 0 };
    const id = addPending({ kind: 'model', url: model.url, name: model.name, credit: model.credit, remote: true });
    autoId.current = auto ? id : null;
  };

  const submitSearch = () => {
    const q = query.trim();
    if (!q) return;
    setQuery('');
    if (/^how\b/i.test(q)) return addVideo(q, false);
    showAnything(q, false);
  };

  // An online model that won't load on this phone: quietly try the next match
  useEffect(() => {
    const r = retry.current;
    if (pendingLoad !== 'error' || !pendingModel || !pendingModel.remote || !r) return;
    markFailed(r.key);
    removeEntity(pendingModel.id);
    if (r.tries >= 2) {
      retry.current = null;
      toast(`Couldn't open a 3D model of "${r.q}", here is a video instead`);
      addVideo(r.q, r.auto);
      return;
    }
    r.tries += 1;
    showAnything(r.q, r.auto);
  }, [pendingLoad]); // eslint-disable-line react-hooks/exhaustive-deps

  const place = () => {
    if (pending && pending.kind === 'video') return placeVideo(pending.id);
    setState({ placeNonce: getState().placeNonce + 1 });
  };

  // ----- Siri -----
  // myview://show/<thing>    "Hey Siri, show me the pyramids of Giza in My View"
  // myview://watch/<words>   "Hey Siri, show me how to make a sandwich in My View"
  // myview://search/<words>  "Hey Siri, search My View" -> anything
  useEffect(() => {
    const handle = (url) => {
      if (!url) return;
      if (/myview:\/\/clear/i.test(url)) {
        clearRoom();
        toast('Room cleared');
        return;
      }
      const m = url.match(/myview:\/\/(show|watch|search)\/(.+)$/i);
      if (!m) return;
      const kind = m[1].toLowerCase();
      let arg = m[2];
      try {
        arg = decodeURIComponent(arg.replace(/\+/g, ' '));
      } catch (e) {}
      arg = arg.trim();
      if (kind === 'show') {
        const item = CATALOG.find((c) => c.id === arg.toLowerCase());
        if (item) addModel(item, true);
        else showAnything(arg, true);
      } else if (kind === 'watch' || /^how\b/i.test(arg)) {
        addVideo(arg, true);
      } else {
        showAnything(arg, true);
      }
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Siri items: place as soon as the room is tracked (on the floor you point at, or in front of you)
  useEffect(() => {
    const p = pendingEntity();
    if (!p || autoId.current !== p.id || !trackingOk) return undefined;
    if (p.kind === 'video') {
      if (placeVideo(p.id)) autoId.current = null;
      return undefined;
    }
    if (pendingLoad !== 'ready') return undefined;
    if (aimOnSurface) {
      autoId.current = null;
      place();
      return undefined;
    }
    const t = setTimeout(() => {
      if (autoId.current !== p.id) return;
      autoId.current = null;
      place();
    }, 1200);
    return () => clearTimeout(t);
  }, [pending && pending.id, pendingLoad, aimOnSurface, trackingOk]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- guidance text -----
  let guide;
  if (searchStatus) guide = searchStatus;
  else if (!trackingOk) guide = 'Move your phone slowly to look around';
  else if (pendingModel && pendingLoad === 'loading') guide = `Loading ${pendingModel.name}...`;
  else if (pendingModel && pendingLoad === 'error') guide = `Couldn't load ${pendingModel.name}`;
  else if (pendingModel) guide = aimOnSurface ? 'Tap Place to put it here' : 'Point at the floor, or tap Place to put it in front of you';
  else if (pending && pending.kind === 'video') guide = 'Face where you want the screen, then tap Place in room';
  else if (selected) guide = `${selected.name || 'Object'} selected`;
  else if (placed.length) guide = 'Walk around. Swipe up to add more';
  else if (!surfaceFound) guide = 'Move your phone slowly to scan the floor';
  else guide = 'Swipe up, or ask Siri, to add something';

  const busy = !!searchStatus || (pendingModel && pendingLoad === 'loading');
  const canPlace = pendingModel && pendingLoad === 'ready' && trackingOk;
  const credit = (pendingModel && pendingModel.credit) || (selected && selected.credit);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <ViroARSceneNavigator
        initialScene={{ scene: ARScene }}
        style={StyleSheet.absoluteFill}
        autofocus
        pbrEnabled
        hdrEnabled
        shadowsEnabled
      />

      {/* YouTube screens pinned in the room (drawn under the controls) */}
      {videos.map((e) => (
        <VideoEntity key={e.id} entity={e} onPlace={() => placeVideo(e.id)} />
      ))}

      {/* guidance */}
      <View style={styles.topBar} pointerEvents="box-none">
        <View style={[styles.pill, { flexDirection: 'row', alignItems: 'center' }]}>
          {busy && <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />}
          <Text style={styles.pillText} numberOfLines={2}>
            {guide}
          </Text>
        </View>
        {toastMsg && <Text style={styles.toast}>{toastMsg}</Text>}
        {credit && (
          <Text style={styles.credit} numberOfLines={1}>
            {credit}
          </Text>
        )}
      </View>

      {/* placing a 3D object */}
      {pendingModel && (
        <View style={[styles.actions, { bottom: PEEK + 22 }]} pointerEvents="box-none">
          <TouchableOpacity style={styles.actionBtn} onPress={() => removeEntity(pendingModel.id)}>
            <Text style={styles.actionText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={place}
            disabled={!canPlace}
            activeOpacity={0.7}
            style={[styles.placeBtn, !canPlace && styles.placeBtnOff]}
          >
            <Text style={styles.placeText}>Place</Text>
          </TouchableOpacity>
          <View style={[styles.actionBtn, { opacity: 0 }]}>
            <Text style={styles.actionText}>Cancel</Text>
          </View>
        </View>
      )}

      {/* an object you tapped */}
      {selected && !pendingModel && (
        <View style={[styles.actions, { bottom: PEEK + 22, gap: 8 }]} pointerEvents="box-none">
          <TouchableOpacity style={styles.actionBtn} onPress={() => removeEntity(selected.id)}>
            <Text style={styles.actionText}>Remove</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => duplicate(selected)}>
            <Text style={styles.actionText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => bringHere(selected.id)}>
            <Text style={styles.actionText}>Here</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setState({ selectedId: null })}>
            <Text style={styles.actionText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
      {selected && !pendingModel && (
        <Text style={[styles.hint, { bottom: PEEK + 80 }]}>Drag to move · Pinch to resize · Twist to rotate</Text>
      )}

      {/* swipe-up sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
        <View style={styles.sheetInner}>
          <View {...sheetPan.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
            {!sheetOpen && (
              <Text style={styles.peekText}>
                {placed.length
                  ? `${placed.length} in your room · swipe up to add more`
                  : 'Swipe up to add objects or videos'}
              </Text>
            )}
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={() => animateSheet(true)}
              placeholder="Search anything: pyramids, how to make pasta..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              onSubmitEditing={submitSearch}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
                <Text style={styles.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chips}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c} onPress={() => setCat(c)} style={[styles.chip, cat === c && styles.chipOn]}>
                <Text style={[styles.chipText, cat === c && styles.chipTextOn]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={results}
            keyExtractor={(i) => i.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 48 }}
            ListHeaderComponent={
              <View>
                {query.trim().length > 1 && (
                  <>
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => {
                        const q = query.trim();
                        setQuery('');
                        showAnything(q, false);
                      }}
                    >
                      <View style={[styles.rowIcon, { backgroundColor: '#3a6df0' }]}>
                        <Text style={styles.rowIconText}>3D</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          Find "{query.trim()}" in 3D
                        </Text>
                        <Text style={styles.rowCat}>Our storage first, then online 3D libraries</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => {
                        const q = query.trim();
                        setQuery('');
                        addVideo(q, false);
                      }}
                    >
                      <View style={[styles.rowIcon, { backgroundColor: '#ff0033' }]}>
                        <Text style={styles.rowIconText}>▶</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          Add a "{query.trim()}" video screen
                        </Text>
                        <Text style={styles.rowCat}>YouTube screen you can pin in your room</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}

                {!query && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 6 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {[...(recents || []), ...SUGGESTIONS.filter((x) => !(recents || []).includes(x))].map((q) => (
                      <TouchableOpacity
                        key={q}
                        style={styles.suggest}
                        onPress={() => (/^how\b/i.test(q) || /music/i.test(q) ? addVideo(q, true) : showAnything(q, true))}
                      >
                        <Text style={styles.suggestText}>
                          {(recents || []).includes(q) ? '↺ ' : ''}
                          {q}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {placed.length > 0 && !query && (
                  <View style={styles.roomBox}>
                    <View style={styles.roomHead}>
                      <Text style={styles.sectionTitle}>In your room</Text>
                      <TouchableOpacity onPress={clearRoom}>
                        <Text style={styles.clearText}>Clear all</Text>
                      </TouchableOpacity>
                    </View>
                    {placed.map((e) => (
                      <View key={e.id} style={styles.roomRow}>
                        <Text style={styles.roomKind}>{e.kind === 'video' ? '▶' : '◆'}</Text>
                        <Text style={styles.roomName} numberOfLines={1}>
                          {e.kind === 'video' ? e.query : e.name}
                        </Text>
                        <TouchableOpacity onPress={() => removeEntity(e.id)} hitSlop={8}>
                          <Text style={styles.clearText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {!query && <Text style={styles.sectionTitleSolo}>Objects</Text>}
              </View>
            }
            ListEmptyComponent={<Text style={styles.empty}>Not in our storage yet. Tap Find in 3D or add a video above.</Text>}
            ListFooterComponent={searchLog ? <Text style={styles.log}>Last online search: {searchLog}</Text> : null}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => addModel(item, false)} activeOpacity={0.6}>
                <View style={styles.rowIcon}>
                  <Text style={styles.rowIconText}>{item.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowCat}>{item.cat}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const glass = {
  backgroundColor: 'rgba(18,18,20,0.74)',
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: 'rgba(255,255,255,0.18)',
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  topBar: { position: 'absolute', top: 58, left: 24, right: 24, alignItems: 'center' },
  pill: { ...glass, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, maxWidth: '100%' },
  pillText: { color: '#fff', fontSize: 15, fontWeight: '500', textAlign: 'center' },
  toast: {
    marginTop: 8,
    color: '#fff',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    textAlign: 'center',
  },
  credit: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 4,
  },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 5,
  },

  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  placeBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  placeBtnOff: { opacity: 0.35 },
  placeText: { color: '#000', fontSize: 16, fontWeight: '600' },
  actionBtn: { ...glass, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22 },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '500' },

  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: SHEET_H },
  sheetInner: {
    ...glass,
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,18,20,0.82)',
  },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 10 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  peekText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 7 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  searchIcon: { color: 'rgba(255,255,255,0.65)', fontSize: 20, marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 16 },
  searchClear: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginLeft: 8 },
  chips: { flexGrow: 0, marginBottom: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  chipOn: { backgroundColor: '#ffffff' },
  chipText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  chipTextOn: { color: '#000' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 11 },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowIconText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rowName: { color: '#fff', fontSize: 16, fontWeight: '500' },
  rowCat: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },
  roomBox: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  roomHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sectionTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  sectionTitleSolo: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginHorizontal: 18,
    marginTop: 6,
  },
  clearText: { color: '#ff6b6b', fontSize: 13, fontWeight: '500' },
  roomRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  roomKind: { color: 'rgba(255,255,255,0.7)', fontSize: 12, width: 14 },
  roomName: { flex: 1, color: '#fff', fontSize: 14 },
  suggest: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  suggestText: { color: '#fff', fontSize: 13 },
  empty: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 30, paddingHorizontal: 30 },
  log: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginHorizontal: 18, marginTop: 14 },
});
