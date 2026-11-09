import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import { buildCesiumHtml } from './cesiumHtml';
import { DEFAULT_REGION, GOOGLE_MAPS_TILE_API_KEY, HAS_NATIVE_MAP_KEY } from './mapConfig';

// Cesium 3D tiles when a tile key is set, else the native map, else a notice.
// The parent moves the camera through the ref: moveTo(region, lat, lng, label).
const MapPane = forwardRef(function MapPane({ region, markers, bottomPadding, onMap3DError }, ref) {
  const mapRef = useRef(null);
  const webViewRef = useRef(null);
  const webViewReadyRef = useRef(false);
  const pendingWebViewMessagesRef = useRef([]);
  const [use3DMap, setUse3DMap] = useState(Boolean(GOOGLE_MAPS_TILE_API_KEY));

  // Built once: a changing `source` reloads Cesium and drops every marker.
  // Camera moves after load go through postMessage instead.
  const cesiumSource = useMemo(() => ({ html: buildCesiumHtml(GOOGLE_MAPS_TILE_API_KEY, DEFAULT_REGION) }), []);

  useImperativeHandle(
    ref,
    () => ({
      moveTo(next, lat, lng, label) {
        mapRef.current?.animateToRegion(next, 1400);
        if (!use3DMap) return;
        const message = JSON.stringify({ type: 'move_map', lat, lng, label });
        if (webViewReadyRef.current && webViewRef.current) {
          webViewRef.current.postMessage(message);
        } else {
          pendingWebViewMessagesRef.current.push(message);
        }
      },
    }),
    [use3DMap]
  );

  if (use3DMap) {
    return (
      <WebView
        ref={webViewRef}
        style={styles.map}
        originWhitelist={['*']}
        source={cesiumSource}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data || '{}');
            if (payload?.type === 'ready') {
              webViewReadyRef.current = true;
              const pending = pendingWebViewMessagesRef.current;
              pendingWebViewMessagesRef.current = [];
              pending.forEach((message) => webViewRef.current?.postMessage(message));
            } else if (payload?.type === 'error') {
              onMap3DError?.(payload.message || '3D map failed to load.');
              setUse3DMap(false);
            }
          } catch {}
        }}
      />
    );
  }

  if (HAS_NATIVE_MAP_KEY) {
    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType="hybrid"
        initialRegion={DEFAULT_REGION}
        region={region}
        mapPadding={{ top: 0, right: 0, bottom: bottomPadding, left: 0 }}
      >
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            title={marker.label}
          />
        ))}
      </MapView>
    );
  }

  return (
    <View style={[styles.map, styles.unavailable]}>
      <Text style={styles.title}>Map is unavailable in this build</Text>
      <Text style={styles.body}>Missing Google Maps Android API key. Set EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY in EAS env and rebuild.</Text>
    </View>
  );
});

export default MapPane;

const styles = StyleSheet.create({
  map: { ...StyleSheet.absoluteFillObject },
  unavailable: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617', padding: 16 },
  title: { color: '#fecaca', fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  body: { color: '#fee2e2', textAlign: 'center', marginTop: 8 },
});
