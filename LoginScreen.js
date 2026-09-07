import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function LoginScreen({ api, onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const action = mode === 'signup' ? api.signup : api.login;
      const result = await action(email.trim(), password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onAuthenticated(result);
    } catch {
      setError('Could not sign in. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Text>
      <Text style={styles.hint}>Map still works offline from your account. Chat needs a signed-in session.</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor="#9ca3af"
        editable={!busy}
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Password"
        placeholderTextColor="#9ca3af"
        editable={!busy}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.primary, busy && styles.disabled]} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode === 'signup' ? 'Sign up' : 'Log in'}</Text>}
      </Pressable>
      <Pressable
        onPress={() => {
          setError(null);
          setMode(mode === 'signup' ? 'login' : 'signup');
        }}
        disabled={busy}
      >
        <Text style={styles.switch}>
          {mode === 'signup' ? 'Already have an account? Log in' : 'Need an account? Sign up'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 16, gap: 10 },
  title: { color: '#f8fafc', fontSize: 22, fontWeight: '700' },
  hint: { color: '#cbd5e1', marginBottom: 8 },
  input: {
    color: '#fff',
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: { color: '#fecaca' },
  primary: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  primaryText: { color: '#fff', fontWeight: '700' },
  switch: { color: '#93c5fd', textAlign: 'center', marginTop: 8 },
});
