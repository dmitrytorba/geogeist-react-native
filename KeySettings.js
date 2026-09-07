import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { last4 } from './keyStore';

const OPENAI_KEYS_URL = 'https://platform.openai.com/api-keys';

export default function KeySettings({ initial, onSave, onDelete, onSkip }) {
  const [llmKey, setLlmKey] = useState('');
  const [llmBaseUrl, setLlmBaseUrl] = useState(initial?.llmBaseUrl || '');
  const [googleKey, setGoogleKey] = useState('');
  const hasStored = Boolean(initial?.llmKey);

  const save = () => {
    const nextKey = llmKey.trim() || initial?.llmKey;
    if (!nextKey) return;
    onSave({
      llmKey: nextKey,
      llmBaseUrl: llmBaseUrl.trim() || null,
      googleKey: googleKey.trim() || initial?.googleKey || null,
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Add your OpenAI API key</Text>
      <Text style={styles.hint}>
        GeoGeist uses your key to talk to the model. It is stored only on this device.
      </Text>
      {hasStored ? (
        <Text style={styles.masked}>Saved key ending in {last4(initial.llmKey)}</Text>
      ) : null}
      <TextInput
        style={styles.input}
        value={llmKey}
        onChangeText={setLlmKey}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        placeholder={hasStored ? 'Paste a new key to replace' : 'sk-...'}
        placeholderTextColor="#9ca3af"
      />
      <TextInput
        style={styles.input}
        value={llmBaseUrl}
        onChangeText={setLlmBaseUrl}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Base URL (optional, default OpenAI)"
        placeholderTextColor="#9ca3af"
      />
      <TextInput
        style={styles.input}
        value={googleKey}
        onChangeText={setGoogleKey}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        placeholder="Google Places key (optional)"
        placeholderTextColor="#9ca3af"
      />
      <Pressable onPress={() => Linking.openURL(OPENAI_KEYS_URL)}>
        <Text style={styles.link}>Get a key at platform.openai.com/api-keys</Text>
      </Pressable>
      <Pressable style={styles.primary} onPress={save}>
        <Text style={styles.primaryText}>Save key</Text>
      </Pressable>
      {hasStored ? (
        <Pressable onPress={onDelete}>
          <Text style={styles.delete}>Delete key</Text>
        </Pressable>
      ) : null}
      {onSkip ? (
        <Pressable onPress={onSkip}>
          <Text style={styles.switch}>Not now</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 16, gap: 10 },
  title: { color: '#f8fafc', fontSize: 22, fontWeight: '700' },
  hint: { color: '#cbd5e1' },
  masked: { color: '#86efac' },
  input: {
    color: '#fff',
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  link: { color: '#93c5fd' },
  primary: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  delete: { color: '#fecaca', textAlign: 'center', marginTop: 8 },
  switch: { color: '#93c5fd', textAlign: 'center', marginTop: 8 },
});
