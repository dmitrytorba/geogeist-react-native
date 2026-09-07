const TOKEN_KEY = 'gg_session_token';

function createSessionStore(backend) {
  if (!backend || typeof backend.getItem !== 'function') {
    throw new Error('session store backend required');
  }
  return {
    async getToken() {
      const value = await backend.getItem(TOKEN_KEY);
      return value || null;
    },
    async setToken(token) {
      if (!token) {
        await backend.removeItem(TOKEN_KEY);
        return;
      }
      await backend.setItem(TOKEN_KEY, token);
    },
    async clear() {
      await backend.removeItem(TOKEN_KEY);
    },
  };
}

function memoryBackend(initial = {}) {
  const data = { ...initial };
  return {
    async getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    async setItem(key, value) {
      data[key] = String(value);
    },
    async removeItem(key) {
      delete data[key];
    },
  };
}

module.exports = { TOKEN_KEY, createSessionStore, memoryBackend };
