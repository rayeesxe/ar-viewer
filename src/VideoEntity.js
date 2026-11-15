// A YouTube screen. While you choose a spot it floats at the top of the screen;
// once placed it stays pinned to that spot in the room, shrinking and turning as you move.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { searchVideos } from './youtube';
import { onPose, project, pose } from './camera';
import { setState, removeEntity, useStore } from './store';

const { width: W } = Dimensions.get('window');
const ORIGIN = 'https://myview.app';

// Size of the screen in the room
export const SCREEN_M = 0.64; // metres wide (16:9)

// Size the card is drawn at before scaling
const CW = 320;
const VH = 180;
const BAR = 38;

const playerHtml = (id, muted) => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#p{position:absolute;inset:0;width:100%;height:100%}</style>
</head><body><div id="p"></div>
<script src="https://www.youtube.com/iframe_api"></script>
<script>
function post(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(m)}
function onYouTubeIframeAPIReady(){
  window.__p=new YT.Player('p',{videoId:'${id}',host:'https://www.youtube.com',
    playerVars:{autoplay:1,playsinline:1,rel:0,modestbranding:1,loop:1,playlist:'${id}',origin:'${ORIGIN}'},
    events:{
      onReady:function(e){${muted ? 'e.target.mute();' : ''}e.target.playVideo();post('ready')},
      onStateChange:function(e){if(e.data===0){e.target.seekTo(0);e.target.playVideo();}},
      onError:function(e){post('error:'+e.data)}
    }});
}
setTimeout(function(){if(!window.YT||!window.YT.Player)post('error:load')},8000);
</script></body></html>`;

export default function VideoEntity({ entity, onPlace }) {
  const pending = entity.status === 'pending';
  const soundId = useStore((s) => s.soundId);
  const [videos, setVideos] = useState(null); // null = searching
  const [idx, setIdx] = useState(0);
  const [fallback, setFallback] = useState(false);
  const webRef = useRef(null);
  const hasSound = soundId === entity.id;

  // position on screen
  const tx = useRef(new Animated.Value(W / 2)).current;
  const ty = useRef(new Animated.Value(104 + (VH + BAR) / 2)).current;
  const sc = useRef(new Animated.Value((W - 24) / CW)).current;
  const ry = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(1)).current;
  const [hidden, setHiddenState] = useState(false);
  const hiddenRef = useRef(false);
  const setHidden = (h) => {
    if (hiddenRef.current !== h) {
      hiddenRef.current = h;
      setHiddenState(h);
    }
  };

  useEffect(() => {
    let live = true;
    setVideos(null);
    setIdx(0);
    searchVideos(entity.query).then((v) => live && setVideos(v));
    return () => {
      live = false;
    };
  }, [entity.query]);

  // Mute every screen except the one you picked for sound
  useEffect(() => {
    if (webRef.current) {
      webRef.current.injectJavaScript(
        `window.__p&&window.__p.${hasSound ? 'unMute' : 'mute'}&&window.__p.${hasSound ? 'unMute' : 'mute'}();true;`
      );
    }
  }, [hasSound]);

  // Follow the phone so the screen looks fixed in the room
  useEffect(() => {
    if (pending || !entity.pos) {
      tx.setValue(W / 2);
      ty.setValue(104 + (VH + BAR) / 2);
      sc.setValue((W - 24) / CW);
      ry.setValue(0);
      op.setValue(1);
      setHidden(false);
      return undefined;
    }
    const update = () => {
      const p = project(entity.pos);
      if (!p || p.x < -W || p.x > 2 * W) {
        op.setValue(0);
        setHidden(true);
        return;
      }
      const px = (pose.focal * SCREEN_M) / p.z; // on-screen width in points
      tx.setValue(p.x);
      ty.setValue(p.y);
      sc.setValue(Math.max(0.12, Math.min(3, px / CW)));
      // turn the card as you walk around it
      if (pose.position) {
        const yaw = ((entity.yaw || 0) * Math.PI) / 180;
        const vx = pose.position[0] - entity.pos[0];
        const vz = pose.position[2] - entity.pos[2];
        const view = Math.atan2(vx, vz);
        let a = ((view - yaw) * 180) / Math.PI;
        a = ((a + 540) % 360) - 180;
        ry.setValue(Math.max(-70, Math.min(70, -a)));
        op.setValue(Math.abs(a) > 100 ? 0.25 : 1);
      } else op.setValue(1);
      setHidden(false);
    };
    update();
    return onPose(update);
  }, [pending, entity.pos, entity.yaw]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = videos && videos[idx];
  const next = () => {
    if (!videos || videos.length < 2) return;
    setFallback(false);
    setIdx((i) => (i + 1) % videos.length);
  };
  const onMessage = (e) => {
    const m = (e.nativeEvent && e.nativeEvent.data) || '';
    if (m.startsWith('error')) setFallback(true);
  };

  let body;
  if (videos === null) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.status} numberOfLines={2}>
          Finding a video for "{entity.query}"
        </Text>
      </View>
    );
  } else if (!current) {
    body = (
      <View style={styles.center}>
        <Text style={styles.status}>No video found for "{entity.query}"</Text>
      </View>
    );
  } else {
    body = (
      <WebView
        ref={webRef}
        key={current.id + (fallback ? '-m' : '')}
        style={styles.web}
        source={
          fallback
            ? { uri: `https://m.youtube.com/watch?v=${current.id}` }
            : { html: playerHtml(current.id, !hasSound), baseUrl: ORIGIN }
        }
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        allowsFullscreenVideo={false}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        scrollEnabled={false}
        onMessage={onMessage}
        setSupportMultipleWindows={false}
      />
    );
  }

  const placeHere = () => onPlace && onPlace();

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={[
        styles.card,
        {
          opacity: op,
          transform: [
            { translateX: Animated.subtract(tx, CW / 2) },
            { translateY: Animated.subtract(ty, (VH + BAR) / 2) },
            { perspective: 900 },
            { rotateY: ry.interpolate({ inputRange: [-180, 180], outputRange: ['-180deg', '180deg'] }) },
            { scale: sc },
          ],
        },
        !pending && styles.cardPlaced,
      ]}
    >
      <View style={styles.video}>{body}</View>
      <View style={styles.bar}>
        {pending ? (
          <>
            <TouchableOpacity onPress={placeHere} style={[styles.btn, styles.btnMain]}>
              <Text style={[styles.btnText, { color: '#000' }]}>Place in room</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={() => setState({ soundId: hasSound ? null : entity.id })}
              style={styles.btn}
            >
              <Text style={styles.btnText}>{hasSound ? 'Sound on' : 'Muted'}</Text>
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>
              {current ? current.title || entity.query : entity.query}
            </Text>
          </>
        )}
        {videos && videos.length > 1 && (
          <TouchableOpacity onPress={next} style={styles.btn}>
            <Text style={styles.btnText}>Next</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => removeEntity(entity.id)} style={styles.btn}>
          <Text style={styles.btnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CW,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,18,20,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  cardPlaced: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  video: { width: CW, height: VH, backgroundColor: '#000' },
  web: { width: CW, height: VH, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  status: { color: 'rgba(255,255,255,0.85)', fontSize: 12, textAlign: 'center' },
  bar: { height: BAR, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 6 },
  title: { flex: 1, color: '#fff', fontSize: 11, fontWeight: '500' },
  btn: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.14)' },
  btnMain: { backgroundColor: '#ffffff' },
  btnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
