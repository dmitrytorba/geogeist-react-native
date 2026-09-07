const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createAuthApi, mapAuthError } = require('./authApi');
const { createSessionStore, memoryBackend, TOKEN_KEY } = require('./sessionStore');
const { canSendPrompt, shouldBootstrap } = require('./chatGate');

describe('auth error copy', () => {
  it('maps 409 to a readable duplicate-email message', () => {
    assert.equal(mapAuthError(409, { error: 'email_taken' }), 'That email is already registered.');
  });

  it('maps 401 to a readable bad-password message', () => {
    assert.equal(mapAuthError(401, { error: 'auth_required' }), 'Incorrect email or password.');
  });
});

describe('authApi', () => {
  it('signup stores token from JSON and does not call /stream/', async () => {
    const calls = [];
    const fetchImpl = async (url, opts) => {
      calls.push({ url, opts });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          token: 'gg_u_testtoken',
          user: { id: '1', email: 'a@b.com', display_name: null, guide_prefs: null },
        }),
      };
    };
    const api = createAuthApi(fetchImpl, 'https://tourapi.torb.uk');
    const result = await api.signup('a@b.com', 'password1');
    assert.equal(result.ok, true);
    assert.equal(result.token, 'gg_u_testtoken');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://tourapi.torb.uk/auth/signup');
    assert.equal(calls[0].opts.method, 'POST');
  });

  it('surfaces 409 from signup as readable copy', async () => {
    const api = createAuthApi(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: 'email_taken' }),
    }));
    const result = await api.signup('a@b.com', 'password1');
    assert.equal(result.ok, false);
    assert.equal(result.error, 'That email is already registered.');
  });
});

describe('session store', () => {
  it('survives a simulated app restart from the same backend', async () => {
    const backend = memoryBackend();
    const first = createSessionStore(backend);
    await first.setToken('gg_u_abc');
    const second = createSessionStore(backend);
    assert.equal(await second.getToken(), 'gg_u_abc');
    await second.clear();
    assert.equal(await second.getToken(), null);
    assert.equal(TOKEN_KEY, 'gg_session_token');
  });
});

describe('chat gate', () => {
  it('does not send while logged out', () => {
    assert.equal(canSendPrompt({ user: null, llmKey: 'sk-test' }), false);
  });

  it('does not send after login until an LLM key exists', () => {
    assert.equal(canSendPrompt({ user: { id: '1' }, llmKey: null }), false);
  });

  it('allows send when session and key exist', () => {
    assert.equal(canSendPrompt({ user: { id: '1' }, llmKey: 'sk-test' }), true);
  });

  it('does not bootstrap logged out even if location is ready', () => {
    assert.equal(
      shouldBootstrap({
        user: null,
        llmKey: 'sk',
        hasBootstrapped: false,
        currentLocation: '1,2',
      }),
      false
    );
  });
});
