import { useCallback, useEffect, useState } from 'react';
import { authApi, keyStore, session, toursApi } from './services';

// The signed-in user, their session token, device-held API keys, and their
// tour list. Restores all of it from SecureStore on mount.
export default function useAccount() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [llmKey, setLlmKey] = useState(null);
  const [llmBaseUrl, setLlmBaseUrl] = useState(null);
  const [googleKey, setGoogleKey] = useState(null);
  const [forceKeyScreen, setForceKeyScreen] = useState(false);
  const [tours, setTours] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [stored, keys] = await Promise.all([
        session.getToken().catch(() => null),
        keyStore.load().catch(() => ({ llmKey: null, llmBaseUrl: null, googleKey: null })),
      ]);
      if (!active) return;
      setLlmKey(keys.llmKey);
      setLlmBaseUrl(keys.llmBaseUrl);
      setGoogleKey(keys.googleKey);
      if (!stored) {
        setAuthReady(true);
        return;
      }
      const result = await authApi.me(stored);
      if (!active) return;
      if (result.ok) {
        setToken(stored);
        setUser(result.user);
        // Don't hold the UI on the tour list; it fills in when it lands.
        toursApi.list(stored).then((listed) => {
          if (active && listed.ok && Array.isArray(listed.data)) setTours(listed.data);
        });
      } else if (result.status === 401) {
        // Only a rejected token is dropped; offline keeps it for next launch.
        await session.clear();
      }
      setAuthReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const refreshTours = useCallback(async (sessionToken) => {
    const t = sessionToken || token;
    if (!t) return [];
    const result = await toursApi.list(t);
    if (result.ok && Array.isArray(result.data)) {
      setTours(result.data);
      return result.data;
    }
    return [];
  }, [token]);

  const signIn = useCallback(async (result) => {
    await session.setToken(result.token);
    setToken(result.token);
    setUser(result.user);
    await refreshTours(result.token);
  }, [refreshTours]);

  const signOut = useCallback(async () => {
    await authApi.logout(token);
    await session.clear();
    setToken(null);
    setUser(null);
    setForceKeyScreen(false);
    setTours([]);
  }, [token]);

  const saveKeys = useCallback(async (next) => {
    await keyStore.save(next);
    setLlmKey(next.llmKey);
    setLlmBaseUrl(next.llmBaseUrl);
    setGoogleKey(next.googleKey);
    setForceKeyScreen(false);
  }, []);

  const deleteKeys = useCallback(async () => {
    await keyStore.clear();
    setLlmKey(null);
    setLlmBaseUrl(null);
    setGoogleKey(null);
    setForceKeyScreen(true);
  }, []);

  const savePrefs = useCallback(async (payload) => {
    if (!token) return;
    const result = await toursApi.patchMe(token, payload);
    if (result.ok) setUser(result.data);
  }, [token]);

  return {
    user,
    token,
    authReady,
    llmKey,
    llmBaseUrl,
    googleKey,
    forceKeyScreen,
    setForceKeyScreen,
    tours,
    setTours,
    refreshTours,
    signIn,
    signOut,
    saveKeys,
    deleteKeys,
    savePrefs,
  };
}
