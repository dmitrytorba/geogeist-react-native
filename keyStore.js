const LLM_KEY = 'gg_llm_api_key';
const LLM_BASE = 'gg_llm_base_url';
const GOOGLE_KEY = 'gg_google_api_key';

function createKeyStore(backend) {
  if (!backend || typeof backend.getItem !== 'function') {
    throw new Error('key store backend required');
  }
  return {
    async load() {
      const [llmKey, llmBaseUrl, googleKey] = await Promise.all([
        backend.getItem(LLM_KEY),
        backend.getItem(LLM_BASE),
        backend.getItem(GOOGLE_KEY),
      ]);
      return {
        llmKey: llmKey || null,
        llmBaseUrl: llmBaseUrl || null,
        googleKey: googleKey || null,
      };
    },
    async save({ llmKey, llmBaseUrl, googleKey }) {
      if (llmKey) await backend.setItem(LLM_KEY, llmKey);
      else await backend.removeItem(LLM_KEY);
      if (llmBaseUrl) await backend.setItem(LLM_BASE, llmBaseUrl);
      else await backend.removeItem(LLM_BASE);
      if (googleKey) await backend.setItem(GOOGLE_KEY, googleKey);
      else await backend.removeItem(GOOGLE_KEY);
    },
    async clear() {
      await Promise.all([
        backend.removeItem(LLM_KEY),
        backend.removeItem(LLM_BASE),
        backend.removeItem(GOOGLE_KEY),
      ]);
    },
  };
}

function last4(value) {
  const text = String(value || '');
  if (!text) return '';
  return text.slice(-4);
}

function streamHeaders({ token, llmKey, llmBaseUrl, googleKey } = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'text/event-stream',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (llmKey) headers['X-LLM-Api-Key'] = llmKey;
  if (llmBaseUrl) headers['X-LLM-Base-Url'] = llmBaseUrl;
  if (googleKey) headers['X-Google-Api-Key'] = googleKey;
  return headers;
}

function isLlmKeyRequired(status, body) {
  return status === 401 && body && body.error === 'llm_key_required';
}

module.exports = {
  LLM_KEY,
  LLM_BASE,
  GOOGLE_KEY,
  createKeyStore,
  last4,
  streamHeaders,
  isLlmKeyRequired,
};
