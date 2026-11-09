import * as SecureStore from 'expo-secure-store';
import { createAuthApi } from './authApi';
import { createSessionStore } from './sessionStore';
import { createToursApi } from './toursApi';
import { createKeyStore } from './keyStore';

const secureBackend = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const session = createSessionStore(secureBackend);
export const authApi = createAuthApi();
export const toursApi = createToursApi();
export const keyStore = createKeyStore(secureBackend);
