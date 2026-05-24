import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';

export default function App() {
  const [coords, setCoords] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function getLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (active) {
            setErrorMsg('Location permission denied.');
            setLoading(false);
          }
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (active) {
          setCoords(current.coords);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setErrorMsg(err?.message || 'Failed to fetch location.');
          setLoading(false);
        }
      }
    }

    getLocation();

    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Coordinates</Text>

      {loading && <ActivityIndicator size="large" />}

      {!loading && errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

      {!loading && coords ? (
        <View style={styles.card}>
          <Text style={styles.label}>Latitude</Text>
          <Text style={styles.value}>{coords.latitude.toFixed(6)}</Text>
          <Text style={styles.label}>Longitude</Text>
          <Text style={styles.value}>{coords.longitude.toFixed(6)}</Text>
          <Text style={styles.meta}>Accuracy: ±{Math.round(coords.accuracy)}m</Text>
        </View>
      ) : null}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    gap: 6,
    backgroundColor: '#fafafa',
  },
  label: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  meta: {
    marginTop: 6,
    color: '#444',
  },
  error: {
    color: '#b00020',
    textAlign: 'center',
  },
});
