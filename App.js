import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as Location from 'expo-location';
import { canSendPrompt, shouldBootstrap } from './chatGate';
import LoginScreen from './LoginScreen';
import KeySettings from './KeySettings';
import ProfileScreen from './ProfileScreen';
import MapPane from './MapPane';
import ChatPanel from './ChatPanel';
import ChatView, { ROLE } from './ChatView';
import useAccount from './useAccount';
import useTourStream from './useTourStream';
import { authApi, toursApi } from './services';
import { mapTourMessage, shouldSkipBootstrapOnResume } from './toursApi';
import { streamHeaders } from './keyStore';
import { DEFAULT_REGION } from './mapConfig';
import { apiBase } from './config';

const API_BASE = apiBase();

export default function App() {
  const mapPaneRef = useRef(null);

  const { width, height } = useWindowDimensions();
  const isDesktopLayout = width >= 768;

  const [markers, setMarkers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [map3DError, setMap3DError] = useState(null);
  const [tourId, setTourId] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  const account = useAccount();
  const { user, token, authReady, llmKey, llmBaseUrl, googleKey, forceKeyScreen, tours, refreshTours, signOut } = account;

  // The backend prompt treats user_location as the map center. Track the real
  // point, not the camera region, which is shifted south to clear the chat overlay.
  const [mapCenter, setMapCenter] = useState({
    latitude: DEFAULT_REGION.latitude,
    longitude: DEFAULT_REGION.longitude,
  });
  const currentLocation = useMemo(() => {
    if (!mapCenter?.latitude || !mapCenter?.longitude) return null;
    return `${mapCenter.latitude},${mapCenter.longitude}`;
  }, [mapCenter]);

  // Read through a ref so flyTo stays stable; otherwise a layout change
  // re-runs the mount-time location effect.
  const isDesktopLayoutRef = useRef(isDesktopLayout);
  isDesktopLayoutRef.current = isDesktopLayout;

  const flyTo = useCallback((lat, lng, label = 'Point of interest') => {
    const bottomOverlayRatio = isDesktopLayoutRef.current ? 0 : 0.45;
    const latitudeOffset = 0.08 * (bottomOverlayRatio * 0.6);
    const next = {
      latitude: lat - latitudeOffset,
      longitude: lng,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
    setMapCenter({ latitude: lat, longitude: lng });
    mapPaneRef.current?.moveTo(next, lat, lng, label);
  }, []);

  const addMarker = useCallback((lat, lng, label) => {
    setMarkers((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, latitude: lat, longitude: lng, label }]);
  }, []);

  const stream = useTourStream({
    onReply: (content) => setMessages((prev) => [...prev, { role: ROLE.ai, content }]),
    onMoveMap: ({ lat, lng, label }) => {
      addMarker(lat, lng, label);
      flyTo(lat, lng, label);
    },
    onKeyRequired: () => account.setForceKeyScreen(true),
    onSuccess: () => {
      if (!token) return;
      toursApi.list(token).then((listed) => {
        if (listed.ok && Array.isArray(listed.data)) {
          account.setTours(listed.data);
          setTourId((current) => current || listed.data[0]?.id || null);
        }
      });
    },
  });
  const { loading, setLoading, setError, start: startStream, cancel: cleanupStream } = stream;

  const fallbackToIpCoords = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/ipcoords/`);
      const data = await res.json();
      if (data?.lat && data?.lng) {
        addMarker(data.lat, data.lng, 'You are here');
        flyTo(data.lat, data.lng, 'You are here');
      }
    } catch {
      setError('Could not determine location.');
    } finally {
      setLoading(false);
    }
  }, [addMarker, flyTo, setError, setLoading]);

  // Returns true when a typed message went out (so the input can reset).
  const sendPrompt = useCallback(
    (textOverride = null) => {
      if (!canSendPrompt({ user, llmKey })) return false;
      if (!currentLocation) return false;

      const content = textOverride ?? input;
      const isBootstrap = !hasBootstrapped && (textOverride === '__bootstrap__' || !content.trim());
      if (!isBootstrap && !content.trim()) return false;

      if (!isBootstrap) setMessages((prev) => [...prev, { role: ROLE.human, content }]);

      startStream({
        url: `${API_BASE}/stream/`,
        headers: streamHeaders({ token, llmKey, llmBaseUrl, googleKey }),
        body: {
          content: isBootstrap ? 'hi' : content,
          user_location: currentLocation,
          history: messages,
          ...(tourId ? { tour_id: tourId } : {}),
        },
      });

      if (isBootstrap) {
        setHasBootstrapped(true);
        return false;
      }
      setInput('');
      return true;
    },
    [currentLocation, googleKey, hasBootstrapped, input, llmBaseUrl, llmKey, messages, startStream, token, tourId, user]
  );

  const handleLogout = useCallback(async () => {
    cleanupStream();
    await signOut();
    setMessages([]);
    setHasBootstrapped(false);
    setTourId(null);
    setShowProfile(false);
  }, [cleanupStream, signOut]);

  const handleResumeTour = useCallback(async (tour) => {
    if (!token || !tour?.id) return;
    const result = await toursApi.get(token, tour.id);
    if (!result.ok) return;
    const detail = result.data;
    setTourId(detail.id);
    setHasBootstrapped(true);
    setMessages((detail.messages || []).map(mapTourMessage));
    setShowProfile(false);
    if (Number.isFinite(detail.lat) && Number.isFinite(detail.lng)) {
      flyTo(detail.lat, detail.lng, detail.title || 'Tour');
    }
  }, [flyTo, token]);

  const handleRenameTour = useCallback(async (id, title) => {
    if (!token) return;
    await toursApi.patch(token, id, title);
    await refreshTours();
  }, [refreshTours, token]);

  const handleDeleteTour = useCallback(async (id) => {
    if (!token) return;
    await toursApi.remove(token, id);
    if (tourId === id) {
      setTourId(null);
      setMessages([]);
      setHasBootstrapped(false);
    }
    await refreshTours();
  }, [refreshTours, token, tourId]);

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
        flyTo(latitude, longitude, 'You are here');
        setLoading(false);
      } catch {
        if (active) await fallbackToIpCoords();
      }
    })();

    return () => {
      active = false;
    };
  }, [addMarker, fallbackToIpCoords, flyTo, setLoading]);

  useEffect(() => {
    if (
      shouldBootstrap({ user, llmKey, hasBootstrapped, currentLocation }) &&
      !shouldSkipBootstrapOnResume(tourId) &&
      !loading
    ) {
      sendPrompt('__bootstrap__');
    }
  }, [currentLocation, hasBootstrapped, llmKey, loading, sendPrompt, tourId, user]);

  let panel;
  if (!authReady) {
    panel = (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  } else if (!user) {
    panel = <LoginScreen api={authApi} onAuthenticated={account.signIn} />;
  } else if (showProfile) {
    panel = (
      <ProfileScreen
        user={user}
        tours={tours}
        onSavePrefs={account.savePrefs}
        onResume={handleResumeTour}
        onRename={handleRenameTour}
        onDelete={handleDeleteTour}
        onLogout={handleLogout}
        onClose={() => setShowProfile(false)}
      />
    );
  } else if (!llmKey || forceKeyScreen) {
    panel = <KeySettings initial={{ llmKey, llmBaseUrl, googleKey }} onSave={account.saveKeys} onDelete={account.deleteKeys} />;
  } else {
    panel = (
      <ChatView
        messages={messages}
        loading={loading}
        streaming={stream.streaming}
        streamText={stream.streamText}
        error={stream.error}
        map3DError={map3DError}
        userEmail={user.email}
        canSend={canSendPrompt({ user, llmKey })}
        input={input}
        onChangeInput={setInput}
        onSend={() => sendPrompt()}
        onLogout={handleLogout}
        onOpenProfile={() => setShowProfile(true)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <MapPane
          ref={mapPaneRef}
          markers={markers}
          bottomPadding={isDesktopLayout ? 0 : Math.round(height * 0.45)}
          onMap3DError={setMap3DError}
        />
        <ChatPanel isDesktopLayout={isDesktopLayout}>{panel}</ChatPanel>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617' },
  container: { flex: 1 },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
});
