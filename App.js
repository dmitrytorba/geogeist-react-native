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
  View,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import Markdown from 'react-native-markdown-display';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || 'https://tourapi.torb.uk').replace(/\/$/, '');
const DEFAULT_REGION = {
  latitude: 37.6191,
  longitude: -122.3816,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

const ROLE = {
  human: 'human',
  ai: 'ai',
};

function parseMoveMapPayload(raw) {
  try {
    const normalized = raw.replace(/'/g, '"');
    const data = JSON.parse(normalized);
    const lat = Number.parseFloat(data.lat);
    const lng = Number.parseFloat(data.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: data.label || 'Point of interest' };
  } catch {
    return null;
  }
}

export default function App() {
  const mapRef = useRef(null);
  const scrollRef = useRef(null);
  const xhrRef = useRef(null);

  const [region, setRegion] = useState(DEFAULT_REGION);
  const [markers, setMarkers] = useState([]);
  const [hasIntro, setHasIntro] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState(null);

  const currentLocation = useMemo(() => {
    if (!region?.latitude || !region?.longitude) return null;
    return `${region.latitude},${region.longitude}`;
  }, [region]);

  const flyTo = useCallback((lat, lng) => {
    const next = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 1400);
  }, []);

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
        flyTo(data.lat, data.lng);
      }
    } catch {
      setError('Could not determine location.');
    } finally {
      setLoading(false);
    }
  }, [addMarker, flyTo]);

  const sendPrompt = useCallback(
    (textOverride = null) => {
      if (!currentLocation) return;

      const content = textOverride ?? input;
      if (hasIntro && !content.trim()) return;

      setError(null);
      setLoading(true);
      setStreaming(false);
      setStreamText('');

      if (content.trim()) {
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
            flyTo(payload.lat, payload.lng);
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
          content: hasIntro ? content : 'hi',
          user_location: currentLocation,
          history: messages,
        })
      );

      setInput('');
      if (!hasIntro) setHasIntro(true);
    },
    [addMarker, cleanupStream, currentLocation, flyTo, hasIntro, input, messages]
  );

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

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active) return;

        const { latitude, longitude } = current.coords;
        addMarker(latitude, longitude, 'You are here');
        flyTo(latitude, longitude);
        setLoading(false);
      } catch {
        if (active) {
          await fallbackToIpCoords();
        }
      }
    })();

    return () => {
      active = false;
      cleanupStream();
    };
  }, [addMarker, cleanupStream, fallbackToIpCoords, flyTo]);

  useEffect(() => {
    if (!loading && !hasIntro && currentLocation) {
      sendPrompt('hi');
    }
  }, [currentLocation, hasIntro, loading, sendPrompt]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, streamText, loading]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={styles.map}
          mapType="hybrid"
          initialRegion={DEFAULT_REGION}
          region={region}
        >
          {markers.map((marker) => (
            <Marker
              key={marker.id}
              coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
              title={marker.label}
            />
          ))}
        </MapView>

        <KeyboardAvoidingView
          style={styles.chatWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.chatPanel}>
            <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent}>
              {error ? <Text style={styles.error}>{error}</Text> : null}

              {messages.map((m, idx) => (
                <View key={`${m.role}-${idx}`} style={[styles.bubbleRow, m.role === ROLE.human ? styles.userRow : styles.aiRow]}>
                  <View style={[styles.bubble, m.role === ROLE.human ? styles.userBubble : styles.aiBubble]}>
                    <Markdown style={markdownStyles}>{m.content}</Markdown>
                  </View>
                </View>
              ))}

              {loading && !streaming ? (
                <View style={styles.loaderRow}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.loaderText}>Thinking…</Text>
                </View>
              ) : null}

              {streaming ? (
                <View style={[styles.bubbleRow, styles.aiRow]}>
                  <View style={[styles.bubble, styles.aiBubble]}>
                    <Markdown style={markdownStyles}>{streamText || '…'}</Markdown>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                multiline
                placeholder="Ask the tour guide..."
                placeholderTextColor="#9ca3af"
                editable={!streaming}
              />
              <Pressable
                style={[styles.sendButton, streaming ? styles.sendButtonDisabled : null]}
                onPress={() => sendPrompt()}
                disabled={streaming}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </Pressable>
            </View>
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
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '56%',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  chatPanel: {
    backgroundColor: 'rgba(17,24,39,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    overflow: 'hidden',
  },
  messages: {
    maxHeight: 360,
  },
  messagesContent: {
    padding: 12,
    gap: 10,
  },
  bubbleRow: { flexDirection: 'row' },
  aiRow: { justifyContent: 'flex-start' },
  userRow: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '86%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  aiBubble: { backgroundColor: 'rgba(30,41,59,0.95)' },
  userBubble: { backgroundColor: '#374151' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.22)',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    color: '#fff',
    backgroundColor: '#1f2937',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButtonDisabled: { opacity: 0.55 },
  sendButtonText: { color: '#fff', fontWeight: '600' },
  loaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  loaderText: { color: '#cbd5e1', fontSize: 13 },
  error: {
    color: '#fecaca',
    backgroundColor: 'rgba(127,29,29,0.45)',
    borderColor: '#7f1d1d',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
});

const markdownStyles = {
  body: { color: '#e5e7eb', fontSize: 15, lineHeight: 21 },
  paragraph: { marginTop: 0, marginBottom: 6 },
  heading3: { color: '#f8fafc', marginBottom: 6 },
  list_item: { color: '#e5e7eb' },
  code_inline: { backgroundColor: '#0f172a', color: '#c7d2fe', borderRadius: 4 },
  code_block: { backgroundColor: '#0f172a', color: '#c7d2fe', borderRadius: 8, padding: 8 },
  fence: { backgroundColor: '#0f172a', color: '#c7d2fe', borderRadius: 8, padding: 8 },
  link: { color: '#93c5fd' },
};
