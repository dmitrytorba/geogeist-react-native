const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { memoryBackend } = require('./sessionStore');
const {
  createKeyStore,
  last4,
  streamHeaders,
  isLlmKeyRequired,
} = require('./keyStore');

describe('key store', () => {
  it('persists keys in SecureStore-shaped backend, not a random object', async () => {
    const backend = memoryBackend();
    const store = createKeyStore(backend);
    await store.save({ llmKey: 'sk-live-1234', llmBaseUrl: 'https://api.openai.com/v1', googleKey: 'gkey' });
    const reopened = createKeyStore(backend);
    const loaded = await reopened.load();
    assert.equal(loaded.llmKey, 'sk-live-1234');
    assert.equal(loaded.googleKey, 'gkey');
    await reopened.clear();
    const empty = await reopened.load();
    assert.equal(empty.llmKey, null);
  });

  it('shows only last 4 characters', () => {
    assert.equal(last4('sk-live-1234'), '1234');
  });
});

describe('stream headers', () => {
  it('includes Authorization and X-LLM-Api-Key together', () => {
    const headers = streamHeaders({
      token: 'gg_u_abc',
      llmKey: 'sk-test',
      llmBaseUrl: 'https://example.invalid/v1',
      googleKey: 'g-test',
    });
    assert.equal(headers.Authorization, 'Bearer gg_u_abc');
    assert.equal(headers['X-LLM-Api-Key'], 'sk-test');
    assert.equal(headers['X-LLM-Base-Url'], 'https://example.invalid/v1');
    assert.equal(headers['X-Google-Api-Key'], 'g-test');
  });
});

describe('llm_key_required', () => {
  it('reopens the key screen on 401 llm_key_required', () => {
    assert.equal(isLlmKeyRequired(401, { error: 'llm_key_required' }), true);
    assert.equal(isLlmKeyRequired(401, { error: 'auth_required' }), false);
  });
});
