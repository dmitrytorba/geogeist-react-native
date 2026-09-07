import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const TONES = ['casual', 'scholarly', 'kid'];
const LENGTHS = ['short', 'normal', 'long'];

function formatTourDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export default function ProfileScreen({
  user,
  tours,
  onSavePrefs,
  onResume,
  onRename,
  onDelete,
  onLogout,
  onClose,
}) {
  const prefs = user?.guide_prefs || {};
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [interests, setInterests] = useState(
    Array.isArray(prefs.interests) ? prefs.interests.join(', ') : prefs.interests || ''
  );
  const [tone, setTone] = useState(prefs.tone || 'casual');
  const [length, setLength] = useState(prefs.length || 'normal');
  const [language, setLanguage] = useState(prefs.language || 'en');
  const [renameId, setRenameId] = useState(null);
  const [renameTitle, setRenameTitle] = useState('');

  const save = () => {
    const interestList = interests
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    onSavePrefs({
      display_name: displayName.trim() || null,
      guide_prefs: { interests: interestList, tone, length, language },
    });
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Display name"
        placeholderTextColor="#9ca3af"
      />
      <TextInput
        style={styles.input}
        value={interests}
        onChangeText={setInterests}
        placeholder="Interests (comma separated)"
        placeholderTextColor="#9ca3af"
      />
      <Text style={styles.label}>Tone</Text>
      <View style={styles.row}>
        {TONES.map((item) => (
          <Pressable key={item} style={[styles.chip, tone === item && styles.chipOn]} onPress={() => setTone(item)}>
            <Text style={styles.chipText}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Length</Text>
      <View style={styles.row}>
        {LENGTHS.map((item) => (
          <Pressable key={item} style={[styles.chip, length === item && styles.chipOn]} onPress={() => setLength(item)}>
            <Text style={styles.chipText}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={language}
        onChangeText={setLanguage}
        autoCapitalize="none"
        placeholder="Language"
        placeholderTextColor="#9ca3af"
      />
      <Pressable style={styles.primary} onPress={save}>
        <Text style={styles.primaryText}>Save prefs</Text>
      </Pressable>

      <Text style={styles.title}>Tours</Text>
      {(tours || []).map((tour) => (
        <View key={tour.id} style={styles.tour}>
          <Pressable onPress={() => onResume(tour)} style={{ flex: 1 }}>
            <Text style={styles.tourTitle}>{tour.title || 'Tour'}</Text>
            <Text style={styles.tourMeta}>
              {formatTourDate(tour.created_at)} · {tour.lat}, {tour.lng}
            </Text>
          </Pressable>
          {renameId === tour.id ? (
            <View style={{ flex: 1, gap: 6 }}>
              <TextInput
                style={styles.input}
                value={renameTitle}
                onChangeText={setRenameTitle}
                placeholder="Title"
                placeholderTextColor="#9ca3af"
              />
              <Pressable
                onPress={() => {
                  onRename(tour.id, renameTitle);
                  setRenameId(null);
                }}
              >
                <Text style={styles.link}>Save title</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.row}>
              <Pressable
                onPress={() => {
                  setRenameId(tour.id);
                  setRenameTitle(tour.title || '');
                }}
              >
                <Text style={styles.link}>Rename</Text>
              </Pressable>
              <Pressable onPress={() => onDelete(tour.id)}>
                <Text style={styles.delete}>Delete</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}

      <Pressable onPress={onLogout}>
        <Text style={styles.delete}>Log out</Text>
      </Pressable>
      <Pressable onPress={onClose}>
        <Text style={styles.link}>Back to chat</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: 16, gap: 8, paddingBottom: 24 },
  title: { color: '#f8fafc', fontSize: 20, fontWeight: '700', marginTop: 8 },
  email: { color: '#cbd5e1' },
  label: { color: '#94a3b8', marginTop: 4 },
  input: {
    color: '#fff',
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#1f2937', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { backgroundColor: '#2563eb' },
  chipText: { color: '#fff' },
  primary: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  tour: { backgroundColor: '#111827', borderRadius: 8, padding: 10, gap: 6 },
  tourTitle: { color: '#f8fafc', fontWeight: '600' },
  tourMeta: { color: '#94a3b8', fontSize: 12 },
  link: { color: '#93c5fd' },
  delete: { color: '#fecaca' },
});
