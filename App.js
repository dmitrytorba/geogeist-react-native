import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import Markdown from 'react-native-markdown-display';
import { WebView } from 'react-native-webview';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || 'https://tourapi.torb.uk').replace(/\/$/, '');
const GOOGLE_MAPS_TILE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_TILE_API_KEY || '';

const DEFAULT_REGION = {
  latitude: 37.6191,
  longitude: -122.3816,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

const ROLE = { human: 'human', ai: 'ai' };
const BLINK_MS = 420;

function parseMoveMapPayload(raw) {
  try {
    const normalized = String(raw || '').replace(/'/g, '"');
    const data = JSON.parse(normalized);
    const lat = Number.parseFloat(data.lat);
    const lng = Number.parseFloat(data.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: data.label || 'Point of interest' };
  } catch {
    return null;
  }
}

function AIBadge() {
  return (
    <View style={styles.aiBadgeOuter}>
      <Text style={styles.aiBadgeIcon}>📍</Text>
    </View>
  );
}

function buildCesiumHtml(apiKey, center) {
  const startLat = Number(center?.latitude) || DEFAULT_REGION.latitude;
  const startLng = Number(center?.longitude) || DEFAULT_REGION.longitude;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link href="https://cesium.com/downloads/cesiumjs/releases/1.127/Build/Cesium/Widgets/widgets.css" rel="stylesheet" />
    <style>
      html, body, #cesiumContainer { margin: 0; width: 100%; height: 100%; background: #020617; overflow: hidden; }
      .cesium-viewer-bottom, .cesium-credit-textContainer { display: none !important; }
    </style>
  </head>
  <body>
    <div id="cesiumContainer"></div>
    <script src="https://cesium.com/downloads/cesiumjs/releases/1.127/Build/Cesium/Cesium.js"></script>
    <script>
      (async function () {
        try {
          const viewer = new Cesium.Viewer('cesiumContainer', {
            animation: false,
            timeline: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,
            fullscreenButton: false,
            infoBox: false,
            selectionIndicator: false,
            shouldAnimate: true,
            globe: false,
          });

          const tileset = await Cesium.createGooglePhotorealistic3DTileset({ key: '${apiKey}' });
          viewer.scene.primitives.add(tileset);

          function addMarker(lat, lng, label) {
            viewer.entities.add({
              position: Cesium.Cartesian3.fromDegrees(lng, lat, 40),
              point: {
                pixelSize: 10,
                color: Cesium.Color.fromCssColorString('#22d3ee'),
                outlineColor: Cesium.Color.fromCssColorString('#082f49'),
                outlineWidth: 2,
              },
              label: {
                text: label || 'Point of interest',
                fillColor: Cesium.Color.WHITE,
                showBackground: true,
                backgroundColor: Cesium.Color.fromCssColorString('rgba(15,23,42,0.75)'),
                font: '14px sans-serif',
                pixelOffset: new Cesium.Cartesian2(0, -18),
              },
            });
          }

          function flyTo(lat, lng) {
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(lng, lat, 2200),
              orientation: {
                heading: 0,
                pitch: Cesium.Math.toRadians(-55),
                roll: 0,
              },
              duration: 1.3,
            });
          }

          flyTo(${startLat}, ${startLng});

          window.addEventListener('message', (event) => {
            try {
              const msg = JSON.parse(event.data || '{}');
              if ((msg?.type === 'move_map' || msg?.type === 'you_are_here') && Number.isFinite(msg.lat) && Number.isFinite(msg.lng)) {
                addMarker(msg.lat, msg.lng, msg.label);
                flyTo(msg.lat, msg.lng);
              }
            } catch {}
          });

          window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'ready' }));
        } catch (error) {
          window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', message: String(error?.message || error) }));
        }
      })();
    </script>
  </body>
</html>`;
}

export default function App() {
  const mapRef = useRef(null);
  const webViewRef = useRef(null);
  const scrollRef = useRef(null);
  const xhrRef = useRef(null);

  const { width, height } = useWindowDimensions();
  const isDesktopLayout = width >= 768;

  const [region, setRegion] = useState(DEFAULT_REGION);
  const [markers, setMarkers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [inputHeight, setInputHeight] = useState(40);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [blinkOn, setBlinkOn] = useState(true);
  const [error, setError] = useState(null);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [use3DMap, setUse3DMap] = useState(Boolean(GOOGLE_MAPS_TILE_API_KEY));
  const [map3DError, setMap3DError] = useState(null);

  const currentLocation = useMemo(() => {
    if (!region?.latitude || !region?.longitude) return null;
    return `${region.latitude},${region.longitude}`;
  }, [region]);

  const postWebViewMapEvent = useCallback((type, lat, lng, label) => {
    webViewRef.current?.postMessage(JSON.stringify({ type, lat, lng, label }));
  }, []);

  const flyTo = useCallback(
    (lat, lng, label = 'Point of interest') => {
      const bottomOverlayRatio = isDesktopLayout ? 0 : 0.45;
      const latitudeOffset = 0.08 * (bottomOverlayRatio * 0.6);
      const next = {
        latitude: lat - latitudeOffset,
        longitude: lng,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
      setRegion(next);
      mapRef.current?.animateToRegion(next, 1400);
      if (use3DMap) postWebViewMapEvent('move_map', lat, lng, label);
    },
    [isDesktopLayout, postWebViewMapEvent, use3DMap]
  );

  const addMarker = useCallback((lat, lng, label) => {
    setMarkers((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        latitude: lat,
        longitude: lng,
        label,
      },
    ]);
  }, []);

  const cleanupStream = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.onreadystatechange = null;
      xhrRef.current.onprogress = null;
      xhrRef.current.onerror = null;
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  }, []);

  const fallbackToIpCoords = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/ipcoords/`);
      const data = await res.json();
      if (data?.lat && data?.lng) {
        addMarker(data.lat, data.lng, 'You are here');
        postWebViewMapEvent('you_are_here', data.lat, data.lng, 'You are here');
        flyTo(data.lat, data.lng, 'You are here');
      }
    } catch {
      setError('Could not determine location.');
    } finally {
      setLoading(false);
    }
  }, [addMarker, flyTo, postWebViewMapEvent]);

  const sendPrompt = useCallback(
    (textOverride = null) => {
      if (!currentLocation) return;

      const content = textOverride ?? input;
      const isBootstrap = !hasBootstrapped && (textOverride === '__bootstrap__' || !content.trim());
      if (!isBootstrap && !content.trim()) return;

      setError(null);
      setLoading(true);
      setStreaming(false);
      setStreamText('');

      if (!isBootstrap && content.trim()) {
        setMessages((prev) => [...prev, { role: ROLE.human, content }]);
      }

      cleanupStream();
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      let cursor = 0;
      let eventName = null;
      let eventData = '';

      const flushEvent = () => {
        if (!eventName) {
          eventData = '';
          return;
        }
        const data = eventData.replace(/\n$/, '');

        if (eventName === 'chat_stream') {
          setLoading(false);
          setStreaming(true);
          setStreamText((prev) => prev + data);
        } else if (eventName === 'chat_stop') {
          setLoading(false);
          setStreaming(false);
          setStreamText('');
          setMessages((prev) => [...prev, { role: ROLE.ai, content: data }]);
        } else if (eventName === 'move_map') {
          const payload = parseMoveMapPayload(data);
          if (payload) {
            addMarker(payload.lat, payload.lng, payload.label);
            postWebViewMapEvent('move_map', payload.lat, payload.lng, payload.label);
            flyTo(payload.lat, payload.lng, payload.label);
          }
        }

        eventName = null;
        eventData = '';
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          setLoading(false);
          setStreaming(false);
          setStreamText('');
          xhrRef.current = null;
          if (xhr.status >= 400) {
            setError('Tour backend returned an error.');
          }
        }
      };

      xhr.onerror = () => {
        setError('Couldn’t reach the tour backend. Check backend URL/auth and try again.');
        setLoading(false);
        setStreaming(false);
        setStreamText('');
      };

      xhr.onprogress = () => {
        const chunk = xhr.responseText.slice(cursor);
        cursor = xhr.responseText.length;
        const lines = chunk.split(/\r?\n/);

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            eventData += line.slice(5).trimStart() + '\n';
          } else if (line.trim() === '') {
            flushEvent();
          }
        }
      };

      xhr.open('POST', `${API_BASE}/stream/`);
      xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
      xhr.setRequestHeader('Accept', 'text/event-stream');
      xhr.send(
        JSON.stringify({
          content: isBootstrap ? 'hi' : content,
          user_location: currentLocation,
          history: messages,
        })
      );

      if (isBootstrap) setHasBootstrapped(true);

      if (!isBootstrap) {
        setInput('');
        setInputHeight(40);
      }
    },
    [addMarker, cleanupStream, currentLocation, flyTo, hasBootstrapped, input, messages, postWebViewMapEvent]
  );

  useEffect(() => {
    const t = setInterval(() => setBlinkOn((v) => !v), BLINK_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!active) return;

        if (status !== 'granted') {
          await fallbackToIpCoords();
          return;
        }

        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!active) return;

        const { latitude, longitude } = current.coords;
        addMarker(latitude, longitude, 'You are here');
        postWebViewMapEvent('you_are_here', latitude, longitude, 'You are here');
        flyTo(latitude, longitude, 'You are here');
        setLoading(false);
      } catch {
        if (active) await fallbackToIpCoords();
      }
    })();

    return () => {
      active = false;
      cleanupStream();
    };
  }, [addMarker, cleanupStream, fallbackToIpCoords, flyTo, postWebViewMapEvent]);

  useEffect(() => {
    if (!loading && currentLocation && !hasBootstrapped) {
      sendPrompt('__bootstrap__');
    }
  }, [currentLocation, hasBootstrapped, loading, sendPrompt]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, streamText, loading]);

  const panelPositionStyle = isDesktopLayout
    ? { left: 0, bottom: 0, top: 0, width: '34%', padding: 16 }
    : { left: 0, right: 0, bottom: 0, height: '50%', paddingHorizontal: 8, paddingBottom: 10 };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.container}>
        {use3DMap ? (
          <WebView
            ref={webViewRef}
            style={styles.map}
            originWhitelist={['*']}
            source={{ html: buildCesiumHtml(GOOGLE_MAPS_TILE_API_KEY, region) }}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            onMessage={(event) => {
              try {
                const payload = JSON.parse(event.nativeEvent.data || '{}');
                if (payload?.type === 'error') {
                  setMap3DError(payload.message || '3D map failed to load.');
                  setUse3DMap(false);
                }
              } catch {}
            }}
          />
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            mapType="hybrid"
            initialRegion={DEFAULT_REGION}
            region={region}
            mapPadding={{ top: 0, right: 0, bottom: isDesktopLayout ? 0 : Math.round(height * 0.45), left: 0 }}
          >
            {markers.map((marker) => (
              <Marker
                key={marker.id}
                coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                title={marker.label}
              />
            ))}
          </MapView>
        )}

        <KeyboardAvoidingView
          style={[styles.chatWrap, panelPositionStyle]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.chatPanel}>
            {!messages.length && !streaming ? (
              <View style={styles.centerState}>
                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorTitle}>Chat connection failed</Text>
                    <Text style={styles.errorBody}>{error}</Text>
                  </View>
                ) : map3DError ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorTitle}>3D map disabled</Text>
                    <Text style={styles.errorBody}>{map3DError}</Text>
                  </View>
                ) : (
                  <ActivityIndicator size="large" color="#fff" />
                )}
              </View>
            ) : (
              <>
                <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent}>
                  {messages.map((m, idx) => (
                    <View
                      key={`${m.role}-${idx}`}
                      style={[styles.bubbleRow, m.role === ROLE.human ? styles.userRow : styles.aiRow]}
                    >
                      {m.role === ROLE.ai ? <AIBadge /> : null}
                      <View style={[styles.bubble, m.role === ROLE.human ? styles.userBubble : styles.aiBubble]}>
                        <Markdown style={markdownStyles}>{m.content}</Markdown>
                      </View>
                    </View>
                  ))}

                  {loading && !streaming ? (
                    <View style={[styles.bubbleRow, styles.aiRow]}>
                      <AIBadge />
                      <View style={[styles.bubble, styles.loaderBubble]}>
                        <View style={styles.loaderPulse} />
                      </View>
                    </View>
                  ) : null}

                  {streaming ? (
                    <View style={[styles.bubbleRow, styles.aiRow]}>
                      <AIBadge />
                      <View style={[styles.bubble, styles.aiBubble]}>
                        <View style={styles.streamingRow}>
                          <Markdown style={markdownStyles}>{streamText || ' '}</Markdown>
                          <Text style={[styles.cursor, !blinkOn && styles.cursorHidden]}>📍</Text>
                        </View>
                      </View>
                    </View>
                  ) : null}
                </ScrollView>

                <View style={styles.inputRow}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        height: Math.max(40, Math.min(108, inputHeight)),
                        borderRadius: inputHeight > 54 ? 8 : 999,
                      },
                    ]}
                    value={input}
                    onChangeText={setInput}
                    onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height + 8)}
                    multiline
                    placeholder="Ask the tour guide..."
                    placeholderTextColor="#9ca3af"
                    editable={!streaming}
                    autoFocus={!isDesktopLayout}
                    onSubmitEditing={() => {
                      if (!streaming) sendPrompt();
                    }}
                    blurOnSubmit={false}
                  />
                  <Pressable
                    style={[styles.sendButton, streaming ? styles.sendButtonDisabled : null]}
                    onPress={() => sendPrompt()}
                    disabled={streaming}
                  >
                    <Text style={styles.sendButtonText}>Send</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617' },
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  chatWrap: {
    position: 'absolute',
  },
  chatPanel: {
    flex: 1,
    backgroundColor: 'rgba(31,41,55,0.90)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  errorBox: {
    backgroundColor: 'rgba(127,29,29,0.45)',
    borderColor: '#7f1d1d',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    maxWidth: 360,
  },
  errorTitle: { color: '#fecaca', fontWeight: '700', marginBottom: 4 },
  errorBody: { color: '#fee2e2' },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 8, paddingVertical: 10, gap: 8 },
  bubbleRow: { flexDirection: 'row', marginVertical: 4, marginRight: 8 },
  aiRow: { justifyContent: 'flex-start', alignItems: 'flex-start' },
  userRow: { justifyContent: 'flex-end' },
  aiBadgeOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBadgeIcon: { fontSize: 16 },
  bubble: {
    maxWidth: '86%',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  aiBubble: { backgroundColor: 'transparent' },
  userBubble: {
    backgroundColor: '#374151',
    borderRadius: 999,
    paddingHorizontal: 14,
  },
  loaderBubble: { backgroundColor: '#111827', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16 },
  loaderPulse: {
    width: 80,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#374151',
  },
  streamingRow: { flexDirection: 'row', alignItems: 'flex-end' },
  cursor: { marginLeft: 4, color: '#fff' },
  cursorHidden: { opacity: 0 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    color: '#fff',
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 10,
    textAlignVertical: 'center',
  },
  sendButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#fff', fontSize: 15 },
});

const markdownStyles = {
  body: { color: '#e5e7eb', fontSize: 15, lineHeight: 21 },
  paragraph: { marginTop: 0, marginBottom: 6 },
  heading3: { color: '#f8fafc', marginBottom: 6, fontWeight: '700', fontSize: 18 },
  list_item: { color: '#e5e7eb' },
  code_inline: { backgroundColor: '#0f172a', color: '#c7d2fe', borderRadius: 4 },
  code_block: { backgroundColor: '#0f172a', color: '#c7d2fe', borderRadius: 8, padding: 8 },
  fence: { backgroundColor: '#0f172a', color: '#c7d2fe', borderRadius: 8, padding: 8 },
  link: { color: '#93c5fd' },
};
