const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createToursApi, mapTourMessage, shouldSkipBootstrapOnResume } = require('./toursApi');

describe('tour resume', () => {
  it('maps assistant messages into native ai bubbles', () => {
    assert.deepEqual(mapTourMessage({ role: 'assistant', content: 'Hello river' }), {
      role: 'ai',
      content: 'Hello river',
    });
  });

  it('skips bootstrap intro when resuming a tour', () => {
    assert.equal(shouldSkipBootstrapOnResume('tour-1'), true);
    assert.equal(shouldSkipBootstrapOnResume(null), false);
  });

  it('lists tours with bearer token', async () => {
    const calls = [];
    const api = createToursApi(async (url, opts) => {
      calls.push({ url, opts });
      return {
        ok: true,
        status: 200,
        json: async () => [{ id: 't1', title: 'Folsom', lat: 38.5, lng: -121.5 }],
      };
    }, 'https://tourapi.torb.uk');
    const result = await api.list('gg_u_abc');
    assert.equal(result.ok, true);
    assert.equal(calls[0].url, 'https://tourapi.torb.uk/tours/');
    assert.equal(calls[0].opts.headers.Authorization, 'Bearer gg_u_abc');
  });

  it('PATCH /me sends tone=kid', async () => {
    const calls = [];
    const api = createToursApi(async (url, opts) => {
      calls.push({ url, opts });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: '1',
          email: 'a@b.com',
          display_name: 'Mylo',
          guide_prefs: { tone: 'kid' },
        }),
      };
    }, 'https://tourapi.torb.uk');
    const result = await api.patchMe('gg_u_abc', {
      display_name: 'Mylo',
      guide_prefs: { tone: 'kid', length: 'short', language: 'en', interests: ['dinosaurs'] },
    });
    assert.equal(result.ok, true);
    assert.equal(calls[0].url, 'https://tourapi.torb.uk/me');
    assert.equal(calls[0].opts.method, 'PATCH');
    assert.match(calls[0].opts.body, /kid/);
  });
});
