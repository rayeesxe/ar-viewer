// A YouTube screen pinned in your room. Just the video: tap it for controls,
// pinch it to resize. While you choose a spot it floats in front of you.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { searchVideos } from './youtube';
import { aiAvailable, pickBest } from './ai';
import { onPose, project, pose } from './camera';
import { setState, removeEntity, updateEntity, useStore } from './store';

const { width: W, height: H } = Dimensions.get('window');
const ORIGIN = 'https://myview.app';

export const DEFAULT_SIZE = 0.9; // metres wide in the room (16:9)
const CW = 360; // drawn size before scaling
const CH = Math.round((CW * 9) / 16);

// Clean player: no YouTube controls or titles; we drive it from our own buttons.
// Starts muted (iOS only allows silent autoplay), then turns the sound on once it is playing.
const playerHtml = (id, wantSound) => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}
#w{position:absolute;inset:0;overflow:hidden}
#p{position:absolute;left:-2%;top:-8%;width:104%;height:116%;pointer-events:none}</style>
</head><body><div id="w"><div id="p"></div></div>
<script src="https://www.youtube.com/iframe_api"></script>
<script>
var wantSound=${wantSound ? 'true' : 'false'},tried=0;
function post(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(m)}
function sound(on){wantSound=on;if(!window.__p)return;if(on){__p.unMute();__p.setVolume(100);tried=Date.now();}else{__p.mute();}}
function toggle(){if(!window.__p)return;var s=__p.getPlayerState();if(s===1){__p.pauseVideo();}else{__p.playVideo();}}
function onYouTubeIframeAPIReady(){
  window.__p=new YT.Player('p',{videoId:'${id}',host:'https://www.youtube.com',
    playerVars:{autoplay:1,mute:1,playsinline:1,controls:0,disablekb:1,fs:0,iv_load_policy:3,rel:0,modestbranding:1,loop:1,playlist:'${id}',origin:'${ORIGIN}'},
    events:{
      onReady:function(e){e.target.mute();e.target.playVideo();post('ready')},
      onStateChange:function(e){
        if(e.data===1){post('playing');if(wantSound&&e.target.isMuted())sound(true);}
        if(e.data===2){post('paused');if(tried&&Date.now()-tried<1500){tried=0;e.target.mute();e.target.playVideo();post('nosound');}}
        if(e.data===0){e.target.seekTo(0);e.target.playVideo();}
      },
      onError:function(e){post('error:'+e.data)}
    }});
}
setTimeout(function(){if(!window.YT||!window.YT.Player)post('error:load')},8000);
</script></body></html>`;

export default function VideoEntity({ entity, onPlace }) {
  const pending = entity.status === 'pending';
  const soundId = useStore((s) => s.soundId);
  const cmd = useStore((s) => s.cmd);
  const hasSound = soundId === entity.id;
  const size = entity.size || DEFAULT_SIZE;

  const [videos, setVideos] = useState(null); // null = searching
  const [idx, setIdx] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [controls, setControls] = useState(false);
  const webRef = useRef(null);
  const hideTimer = useRef(null);

  // where it is drawn
  const tx = useRef(new Animated.Value(W / 2)).current;
  const ty = useRef(new Animated.Value(H * 0.36)).current;
  const sc = useRef(new Animated.Value((W - 16) / CW)).current;
  const sx = useRef(new Animated.Value(1)).current; // narrows as you look from the side
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
    (async () => {
      const v = await searchVideos(entity.query);
      if (!live) return;
      if (aiAvailable() && v.length > 1) {
        // let Gemini choose the most useful one and put it first
        const best = await pickBest(entity.request || entity.query, v);
        if (!live) return;
        if (best > 0) v.unshift(v.splice(best, 1)[0]);
      }
      setVideos(v);
    })();
    return () => {
      live = false;
    };
  }, [entity.query]);

  const js = (code) => webRef.current && webRef.current.injectJavaScript(`${code};true;`);

  // only one screen plays sound at a time
  useEffect(() => {
    js(`sound(${hasSound ? 'true' : 'false'})`);
  }, [hasSound]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the phone so the screen stays fixed in the room
  useEffect(() => {
    if (pending || !entity.pos) {
      tx.setValue(W / 2);
      ty.setValue(H * 0.36);
      sc.setValue((W - 16) / CW);
      sx.setValue(1);
      op.setValue(1);
      setHidden(false);
      return undefined;
    }
    const update = () => {
      const p = project(entity.pos);
      if (!p || p.x < -W || p.x > 2 * W || p.y < -H || p.y > 2 * H) {
        op.setValue(0);
        setHidden(true);
        return;
      }
      const px = (pose.focal * size) / p.z; // on-screen width in points
      tx.setValue(p.x);
      ty.setValue(p.y);
      sc.setValue(Math.max(0.1, Math.min(4, px / CW)));
      let narrow = 1;
      let alpha = 1;
      if (pose.position) {
        const yaw = ((entity.yaw || 0) * Math.PI) / 180;
        const view = Math.atan2(pose.position[0] - entity.pos[0], pose.position[2] - entity.pos[2]);
        const a = Math.abs(Math.atan2(Math.sin(view - yaw), Math.cos(view - yaw)));
        narrow = Math.max(0.12, Math.cos(Math.min(a, Math.PI / 2)));
        alpha = a > Math.PI / 2 ? 0.3 : 1; // seen from behind
      }
      sx.setValue(narrow);
      op.setValue(alpha);
      setHidden(false);
    };
    update();
    return onPose(update);
  }, [pending, entity.pos, entity.yaw, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const showControls = () => {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 4000);
  };
  useEffect(() => () => clearTimeout(hideTimer.current), []);

  // tap = controls, pinch = resize
  const pinch = useRef({ d0: 0, s0: size, moved: false });
  const touchDist = (e) => {
    const t = e.nativeEvent.touches;
    if (!t || t.length < 2) return 0;
    return Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
  };
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pinch.current = { d0: 0, s0: sizeRef.current, moved: false };
      },
      onPanResponderMove: (e, g) => {
        const d = touchDist(e);
        if (d > 0) {
          if (!pinch.current.d0) pinch.current.d0 = d;
          const s = Math.max(0.3, Math.min(4, pinch.current.s0 * (d / pinch.current.d0)));
          updateEntity(entity.id, { size: s });
          pinch.current.moved = true;
        } else if (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6) pinch.current.moved = true;
      },
      onPanResponderRelease: () => {
        if (!pinch.current.moved) showControls();
      },
    })
  ).current;

  const current = videos && videos[idx];
  const next = () => {
    if (!videos || videos.length < 2) return;
    setFallback(false);
    setPlaying(false);
    setIdx((i) => (i + 1) % videos.length);
    showControls();
  };
  const onMessage = (e) => {
    const m = (e.nativeEvent && e.nativeEvent.data) || '';
    if (m.startsWith('error')) setFallback(true);
    else if (m === 'playing') setPlaying(true);
    else if (m === 'paused') setPlaying(false);
    else if (m === 'nosound') setState({ soundId: null });
  };
  const resize = (f) => {
    updateEntity(entity.id, { size: Math.max(0.3, Math.min(4, size * f)) });
    showControls();
  };

  // voice commands aimed at this screen
  useEffect(() => {
    if (!cmd || cmd.target !== entity.id) return;
    switch (cmd.name) {
      case 'pause':
        js('window.__p&&__p.pauseVideo()');
        break;
      case 'play':
        js('window.__p&&__p.playVideo()');
        break;
      case 'next_video':
        next();
        break;
      case 'mute':
        setState({ soundId: null });
        break;
      case 'unmute':
        setState({ soundId: entity.id });
        break;
      case 'bigger':
        resize(1.3);
        break;
      case 'smaller':
        resize(0.75);
        break;
      case 'here':
        onPlace && onPlace();
        break;
      case 'remove':
        removeEntity(entity.id);
        break;
      default:
    }
  }, [cmd && cmd.n]); // eslint-disable-line react-hooks/exhaustive-deps

  let body;
  if (videos === null) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.status} numberOfLines={2}>
          Finding the best video for "{entity.query}"
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
      <View style={StyleSheet.absoluteFill} pointerEvents={fallback ? 'auto' : 'none'}>
        <WebView
          ref={webRef}
          key={current.id + (fallback ? '-m' : '')}
          style={styles.web}
          source={
            fallback
              ? { uri: `https://m.youtube.com/watch?v=${current.id}` }
              : { html: playerHtml(current.id, hasSound), baseUrl: ORIGIN }
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
      </View>
    );
  }

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={[
        styles.card,
        {
          opacity: op,
          transform: [
            { translateX: Animated.subtract(tx, CW / 2) },
            { translateY: Animated.subtract(ty, CH / 2) },
            { scale: sc },
            { scaleX: sx },
          ],
        },
      ]}
    >
      <View style={styles.video}>{body}</View>

      {/* touch layer: tap for controls, pinch to resize */}
      {!fallback && <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />}

      {(controls || pending) && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={styles.topRow} pointerEvents="box-none">
            <TouchableOpacity onPress={() => removeEntity(entity.id)} style={styles.icon}>
              <Text style={styles.iconText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.bottomRow} pointerEvents="box-none">
            {pending ? (
              <TouchableOpacity onPress={onPlace} style={[styles.pillBtn, styles.pillMain]}>
                <Text style={[styles.pillText, { color: '#000' }]}>Place in room</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => {
                    js('toggle()');
                    showControls();
                  }}
                  style={styles.pillBtn}
                >
                  <Text style={styles.pillText}>{playing ? 'Pause' : 'Play'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setState({ soundId: hasSound ? null : entity.id });
                    showControls();
                  }}
                  style={styles.pillBtn}
                >
                  <Text style={styles.pillText}>{hasSound ? 'Mute' : 'Sound'}</Text>
                </TouchableOpacity>
                {videos && videos.length > 1 && (
                  <TouchableOpacity onPress={next} style={styles.pillBtn}>
                    <Text style={styles.pillText}>Next</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => resize(0.8)} style={styles.pillBtn}>
                  <Text style={styles.pillText}>−</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => resize(1.25)} style={styles.pillBtn}>
                  <Text style={styles.pillText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    onPlace && onPlace();
                    showControls();
                  }}
                  style={styles.pillBtn}
                >
                  <Text style={styles.pillText}>Here</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CW,
    height: CH,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  video: { width: CW, height: CH, backgroundColor: '#000' },
  web: { width: CW, height: CH, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  status: { color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center' },
  topRow: { position: 'absolute', top: 6, right: 6 },
  bottomRow: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  iconText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  pillBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  pillMain: { backgroundColor: '#ffffff', paddingHorizontal: 16 },
  pillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
