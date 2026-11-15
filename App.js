// My View: camera screen, swipe-up search, tap Place to anchor an object, Siri and YouTube hands free.
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
import { CATALOG, CATEGORIES } from './src/catalog';
import VideoPanel from './src/VideoPanel';
import { toSearchQuery } from './src/youtube';
import { findModel } from './src/modelSearch';
import { getState, setState, useStore } from './src/store';

LogBox.ignoreAllLogs(true);

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = Math.round(SCREEN_H * 0.62);
const PEEK = 92;
const CLOSED_Y = SHEET_H - PEEK;
const OPEN_Y = 0;

export default function App() {
  const modelId = useStore((s) => s.modelId);
  const placed = useStore((s) => s.placed);
  const trackingOk = useStore((s) => s.trackingOk);
  const surfaceFound = useStore((s) => s.surfaceFound);
  const aimOnSurface = useStore((s) => s.aimOnSurface);
  const loadState = useStore((s) => s.loadState);
  const videoQuery = useStore((s) => s.videoQuery);
  const remote = useStore((s) => s.remote);
  const searchStatus = useStore((s) => s.searchStatus);
  const [cat, setCat] = useState('All');

  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const selected =
    CATALOG.find((c) => c.id === modelId) || (modelId === 'remote' && remote) || null;

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

  // ----- actions -----
  const pick = (item) => {
    setState({ modelId: item.id, modelUrl: item.url, placed: false, remote: null });
    animateSheet(false);
  };
  const place = () =>
    setState({
      placeFront: getState().placeFront || !getState().aimOnSurface,
      placeNonce: getState().placeNonce + 1,
    });

  const watch = (q) => setState({ videoQuery: toSearchQuery(q) });

  // Anything at all: our catalog first, then online 3D libraries, then AI, then YouTube
  const searchId = useRef(0);
  const showAnything = async (q, auto) => {
    const norm = q.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\b(a|an|the|some|me|show|please)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const local = CATALOG.find(
      (c) => c.id === norm || c.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim() === norm || c.name.toLowerCase().endsWith(' ' + norm)
    );
    if (local) return auto ? summon(local) : pick(local);
    const id = ++searchId.current;
    animateSheet(false);
    setState({ searchStatus: `Looking for ${q}` });
    const found = await findModel(q, (st) =>
      searchId.current === id && setState({ searchStatus: `${st}...` })
    );
    if (searchId.current !== id) return;
    setState({ searchStatus: null });
    if (!found) return watch(q);
    autoPlace.current = !!auto;
    setState({
      modelId: 'remote',
      modelUrl: found.url,
      placed: false,
      remote: { id: 'remote', name: found.name, credit: found.credit },
    });
  };

  // Typed search with no matching object: look it up on YouTube instead
  const submitSearch = () => {
    const q = query.trim();
    if (!q) return;
    if (results[0]) return pick(results[0]);
    setQuery('');
    showAnything(q, true);
  };

  // ----- Siri -----
  // myview://show/<object>   "Hey Siri, show me an avocado in My View"
  // myview://watch/<words>   "Hey Siri, show me how to make a sandwich in My View"
  // myview://search/<words>  "Hey Siri, search My View" -> object if we have it, otherwise YouTube
  const autoPlace = useRef(false);
  const summon = (item) => {
    autoPlace.current = true;
    if (getState().modelId === item.id) setState({ placed: false });
    else pick(item);
  };
  useEffect(() => {
    const handle = (url) => {
      if (!url) return;
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
        if (item) summon(item);
        else showAnything(arg, true);
      } else if (kind === 'watch') {
        watch(arg);
        const item = CATALOG.find((c) => ` ${arg.toLowerCase()} `.includes(` ${c.id} `));
        if (item) summon(item);
      } else {
        if (/^how\b/i.test(arg)) watch(arg);
        else showAnything(arg, true);
      }
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When Siri asked for it: drop it on the floor you are pointing at, or right in front of you
  useEffect(() => {
    if (!autoPlace.current || loadState !== 'ready' || placed || !trackingOk) return;
    if (aimOnSurface) {
      autoPlace.current = false;
      place();
      return;
    }
    const t = setTimeout(() => {
      if (!autoPlace.current) return;
      autoPlace.current = false;
      setState({ placeFront: true });
      place();
    }, 1200);
    return () => clearTimeout(t);
  }, [loadState, aimOnSurface, placed, trackingOk]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = () => setState({ placed: false });
  const remove = () => setState({ modelId: null, modelUrl: null, placed: false });

  // ----- guidance text -----
  let guide = null;
  if (searchStatus) {
    guide = searchStatus;
  } else if (!trackingOk) {
    guide = 'Move your phone slowly to look around';
  } else if (selected && loadState === 'loading') {
    guide = `Loading ${selected.name}...`;
  } else if (selected && loadState === 'error') {
    guide = `Couldn't load ${selected.name}. Try another object.`;
  } else if (selected && !placed) {
    guide = aimOnSurface ? 'Tap Place to anchor it here' : 'Point at the floor, or tap Place to put it in front of you';
  } else if (selected && placed) {
    guide = 'Anchored. Walk around it';
  } else if (!surfaceFound) {
    guide = 'Move your phone slowly to scan the floor';
  } else {
    guide = 'Floor found. Swipe up to add an object';
  }

  const canPlace = selected && loadState === 'ready' && !placed && trackingOk;

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

      {/* guidance */}
      <View style={styles.topBar} pointerEvents="box-none">
        <View style={[styles.pill, { flexDirection: 'row', alignItems: 'center' }]}>
          {((selected && loadState === 'loading') || searchStatus) && (
            <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.pillText} numberOfLines={2}>
            {guide}
          </Text>
        </View>
        {selected && placed && (
          <Text style={styles.hint}>Drag to move · Pinch to resize · Twist to rotate</Text>
        )}
        {selected && selected.credit && (
          <Text style={styles.credit} numberOfLines={1}>
            {selected.credit}
          </Text>
        )}
      </View>

      {/* Place button */}
      {selected && !placed && loadState === 'ready' && (
        <View style={[styles.placeWrap, { bottom: PEEK + 22 }]} pointerEvents="box-none">
          <TouchableOpacity
            onPress={place}
            disabled={!canPlace}
            activeOpacity={0.7}
            style={[styles.placeBtn, !canPlace && styles.placeBtnOff]}
          >
            <Text style={styles.placeText}>Place</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* After placing */}
      {selected && placed && (
        <View style={[styles.actions, { bottom: PEEK + 22 }]} pointerEvents="box-none">
          <TouchableOpacity style={styles.actionBtn} onPress={move}>
            <Text style={styles.actionText}>Move</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={remove}>
            <Text style={styles.actionText}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* floating YouTube player */}
      {videoQuery && (
        <VideoPanel query={videoQuery} onClose={() => setState({ videoQuery: null })} />
      )}

      {/* swipe-up search sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
        <View style={styles.sheetInner}>
          <View {...sheetPan.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
            {!sheetOpen && <Text style={styles.peekText}>Swipe up to add an object or find a video</Text>}
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={() => animateSheet(true)}
              placeholder="Search objects or anything on YouTube"
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
              <TouchableOpacity
                key={c}
                onPress={() => setCat(c)}
                style={[styles.chip, cat === c && styles.chipOn]}
              >
                <Text style={[styles.chipText, cat === c && styles.chipTextOn]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={results}
            ListHeaderComponent={
              query.trim().length > 1 ? (
                <View>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    const q = query.trim();
                    setQuery('');
                    showAnything(q, true);
                  }}
                  activeOpacity={0.6}
                >
                  <View style={[styles.rowIcon, { backgroundColor: '#3a6df0' }]}>
                    <Text style={styles.rowIconText}>3D</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      Find "{query.trim()}" in 3D
                    </Text>
                    <Text style={styles.rowCat}>Searches online 3D libraries and places it in front of you</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    watch(query.trim());
                    setQuery('');
                    animateSheet(false);
                  }}
                  activeOpacity={0.6}
                >
                  <View style={[styles.rowIcon, { backgroundColor: '#ff0033' }]}>
                    <Text style={styles.rowIconText}>▶</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      Watch "{query.trim()}"
                    </Text>
                    <Text style={styles.rowCat}>YouTube video, plays over your camera</Text>
                  </View>
                </TouchableOpacity>
                </View>
              ) : null
            }
            keyExtractor={(i) => i.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 48 }}
            ListEmptyComponent={
              <Text style={styles.empty}>Not in My View yet. Tap Find in 3D or Watch above.</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => pick(item)} activeOpacity={0.6}>
                <View style={styles.rowIcon}>
                  <Text style={styles.rowIconText}>{item.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowCat}>{item.cat}</Text>
                </View>
                {modelId === item.id && <View style={styles.rowDot} />}
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
  hint: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 5,
  },

  placeWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
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

  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  actionBtn: { ...glass, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 22 },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '500' },

  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: SHEET_H },
  sheetInner: {
    ...glass,
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,18,20,0.8)',
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
  rowIconText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  rowName: { color: '#fff', fontSize: 16, fontWeight: '500' },
  rowCat: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },
  rowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34c759' },
  credit: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 4,
  },
  chips: { flexGrow: 0, marginBottom: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  chipOn: { backgroundColor: '#ffffff' },
  chipText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  chipTextOn: { color: '#000' },
  empty: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 30, paddingHorizontal: 30 },
});
