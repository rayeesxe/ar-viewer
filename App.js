// AR Viewer: camera screen, swipe-up search, tap Place to anchor an object on your floor.
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ViroARSceneNavigator } from '@reactvision/react-viro';
import ARScene from './src/ARScene';
import { CATALOG } from './src/catalog';
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

  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const selected = CATALOG.find((c) => c.id === modelId) || null;

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
    if (!q) return CATALOG;
    return CATALOG.filter((o) => `${o.name} ${o.tags} ${o.cat}`.toLowerCase().includes(q));
  }, [query]);

  // ----- actions -----
  const pick = (item) => {
    setState({ modelId: item.id, modelUrl: item.url, placed: false });
    animateSheet(false);
  };
  const place = () => setState({ placeNonce: getState().placeNonce + 1 });

  // ----- Siri: "Hey Siri, show me an avocado in My View" opens myview://show/avocado -----
  const autoPlace = useRef(false);
  useEffect(() => {
    const handle = (url) => {
      const m = url && url.match(/show\/([a-z0-9_-]+)/i);
      const item = m && CATALOG.find((c) => c.id === m[1].toLowerCase());
      if (item) {
        autoPlace.current = true;
        pick(item);
      }
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When Siri asked for it, drop it on the floor as soon as the floor is found
  useEffect(() => {
    if (autoPlace.current && loadState === 'ready' && aimOnSurface && !placed) {
      autoPlace.current = false;
      place();
    }
  }, [loadState, aimOnSurface, placed]); // eslint-disable-line react-hooks/exhaustive-deps
  const move = () => setState({ placed: false });
  const remove = () => setState({ modelId: null, modelUrl: null, placed: false });

  // ----- guidance text -----
  let guide = null;
  if (!trackingOk || !surfaceFound) {
    guide = 'Move your phone slowly to scan the floor';
  } else if (selected && loadState === 'loading') {
    guide = `Loading ${selected.name}...`;
  } else if (selected && loadState === 'error') {
    guide = `Couldn't load ${selected.name}. Try another object.`;
  } else if (selected && !placed) {
    guide = aimOnSurface ? 'Tap Place to anchor it here' : 'Point at the floor';
  } else if (selected && placed) {
    guide = 'Anchored. Walk around it';
  } else {
    guide = 'Floor found. Swipe up to add an object';
  }

  const canPlace = selected && loadState === 'ready' && !placed && aimOnSurface;

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
        <View style={styles.pill}>
          <Text style={styles.pillText} numberOfLines={2}>
            {guide}
          </Text>
        </View>
        {selected && placed && (
          <Text style={styles.hint}>Drag to move · Pinch to resize · Twist to rotate</Text>
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

      {/* swipe-up search sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
        <View style={styles.sheetInner}>
          <View {...sheetPan.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
            {!sheetOpen && <Text style={styles.peekText}>Swipe up to add an object</Text>}
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={() => animateSheet(true)}
              placeholder="Search helmet, robot, fox, shoe..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              onSubmitEditing={() => results[0] && pick(results[0])}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
                <Text style={styles.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={results}
            keyExtractor={(i) => i.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 48 }}
            ListEmptyComponent={<Text style={styles.empty}>Nothing matches "{query}"</Text>}
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
  empty: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 30 },
});
