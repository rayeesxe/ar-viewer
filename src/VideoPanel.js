// Floating YouTube player that sits over the camera so you can watch hands free.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { searchVideos } from './youtube';

const { width: W } = Dimensions.get('window');
const ORIGIN = 'https://myview.app';

const playerHtml = (id) => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#p{position:absolute;inset:0;width:100%;height:100%}</style>
</head><body><div id="p"></div>
<script src="https://www.youtube.com/iframe_api"></script>
<script>
function post(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(m)}
function onYouTubeIframeAPIReady(){
  new YT.Player('p',{videoId:'${id}',host:'https://www.youtube.com',
    playerVars:{autoplay:1,playsinline:1,rel:0,modestbranding:1,origin:'${ORIGIN}'},
    events:{
      onReady:function(e){e.target.playVideo();post('ready')},
      onStateChange:function(e){if(e.data===0)post('ended')},
      onError:function(e){post('error:'+e.data)}
    }});
}
setTimeout(function(){if(!window.YT||!window.YT.Player)post('error:load')},8000);
</script></body></html>`;

export default function VideoPanel({ query, onClose }) {
  const [videos, setVideos] = useState(null); // null = searching
  const [idx, setIdx] = useState(0);
  const [big, setBig] = useState(true);
  const [fallback, setFallback] = useState(false); // play on the mobile YouTube page instead

  useEffect(() => {
    let live = true;
    setVideos(null);
    setIdx(0);
    setFallback(false);
    searchVideos(query).then((v) => live && setVideos(v));
    return () => {
      live = false;
    };
  }, [query]);

  const current = videos && videos[idx];
  const next = () => {
    if (!videos || !videos.length) return;
    setFallback(false);
    setIdx((i) => (i + 1) % videos.length);
  };

  const onMessage = (e) => {
    const m = e.nativeEvent.data || '';
    if (m.startsWith('error')) setFallback(true);
  };

  const width = big ? W - 24 : Math.round(W * 0.52);
  const height = Math.round((width * 9) / 16);

  let body;
  if (videos === null) {
    body = (
      <View style={[styles.center, { height }]}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.status}>Finding a video for "{query}"</Text>
      </View>
    );
  } else if (!current) {
    // nothing found by search: show YouTube's own results so you can tap one
    body = (
      <WebView
        style={{ width, height: height * 1.6, backgroundColor: '#000' }}
        source={{ uri: 'https://m.youtube.com/results?search_query=' + encodeURIComponent(query) }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />
    );
  } else {
    body = (
      <WebView
        key={current.id + (fallback ? '-m' : '')}
        style={{ width, height, backgroundColor: '#000' }}
        source={
          fallback
            ? { uri: `https://m.youtube.com/watch?v=${current.id}` }
            : { html: playerHtml(current.id), baseUrl: ORIGIN }
        }
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        scrollEnabled={false}
        onMessage={onMessage}
        setSupportMultipleWindows={false}
      />
    );
  }

  return (
    <View style={[styles.card, big ? styles.cardBig : styles.cardSmall, { width }]}>
      <View style={styles.video}>{body}</View>
      <View style={styles.bar}>
        <Text style={styles.title} numberOfLines={1}>
          {current ? current.title || query : query}
        </Text>
        {videos && videos.length > 1 && (
          <TouchableOpacity onPress={next} hitSlop={8} style={styles.btn}>
            <Text style={styles.btnText}>Next</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setBig((b) => !b)} hitSlop={8} style={styles.btn}>
          <Text style={styles.btnText}>{big ? 'Smaller' : 'Bigger'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.btn}>
          <Text style={styles.btnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 104,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,18,20,0.86)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  cardBig: { left: 12 },
  cardSmall: { right: 12 },
  video: { backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  status: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  title: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '500' },
  btn: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
