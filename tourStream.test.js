const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { startTourStream } = require('./tourStream');

// Minimal XMLHttpRequest stand-in: tests push response text and finish it.
class FakeXhr {
  constructor() {
    FakeXhr.last = this;
    this.readyState = 0;
    this.status = 0;
    this.responseText = '';
    this.headers = {};
    this.aborted = false;
  }
  open(method, url) {
    this.method = method;
    this.url = url;
    this.readyState = 1;
  }
  setRequestHeader(name, value) {
    this.headers[name] = value;
  }
  send(body) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
  }
  push(text) {
    this.readyState = 3;
    this.status = this.status || 200;
    this.responseText += text;
    this.onprogress?.();
  }
  finish(status = this.status || 200, text = '') {
    this.status = status;
    this.responseText += text;
    this.readyState = 4;
    this.onreadystatechange?.();
  }
}

function record() {
  const calls = [];
  const handlers = {};
  for (const name of ['onTour', 'onToken', 'onReply', 'onMoveMap', 'onEnd', 'onFailure', 'onSuccess', 'onNetworkError']) {
    handlers[name] = (arg) => calls.push(arg === undefined ? [name] : [name, arg]);
  }
  return { calls, handlers };
}

function start(handlers, extra = {}) {
  startTourStream({
    XHR: FakeXhr,
    url: 'https://api.example/stream/',
    headers: { Authorization: 'Bearer t' },
    body: { content: 'hi' },
    handlers,
    ...extra,
  });
  return FakeXhr.last;
}

describe('startTourStream', () => {
  it('POSTs the JSON body with headers', () => {
    const xhr = start({});
    assert.equal(xhr.method, 'POST');
    assert.equal(xhr.url, 'https://api.example/stream/');
    assert.equal(xhr.headers.Authorization, 'Bearer t');
    assert.deepEqual(JSON.parse(xhr.body), { content: 'hi' });
  });

  it('accumulates chat_stream tokens across chunks, keeping leading spaces', () => {
    const { calls, handlers } = record();
    const xhr = start(handlers);
    xhr.push('event: chat_stream\ndata: Hello\n\nevent: chat_st');
    xhr.push('ream\ndata:  world\n\n');
    assert.deepEqual(calls, [
      ['onToken', 'Hello'],
      ['onToken', ' world'],
    ]);
  });

  it('chat_stop delivers its data as the reply and suppresses the end fallback', () => {
    const { calls, handlers } = record();
    const xhr = start(handlers);
    xhr.push('event: chat_stream\ndata: Hel\n\nevent: chat_stop\ndata: Hello there\n\n');
    xhr.finish(200);
    assert.deepEqual(calls, [['onToken', 'Hel'], ['onReply', 'Hello there'], ['onEnd'], ['onSuccess']]);
  });

  it('empty chat_stop falls back to the streamed text', () => {
    const { calls, handlers } = record();
    const xhr = start(handlers);
    xhr.push('event: chat_stream\ndata: Hi\n\nevent: chat_stop\ndata:\n\n');
    xhr.finish(200);
    assert.deepEqual(
      calls.filter(([n]) => n === 'onReply'),
      [['onReply', 'Hi']]
    );
  });

  it('stream end without chat_stop still delivers the streamed reply', () => {
    const { calls, handlers } = record();
    const xhr = start(handlers);
    xhr.push('event: chat_stream\ndata: Partial\n\nevent: chat_stream\ndata:  answer');
    // Last event has no blank line; parser.end() flushes it on DONE.
    xhr.finish(200);
    assert.deepEqual(calls, [
      ['onToken', 'Partial'],
      ['onToken', ' answer'],
      ['onReply', 'Partial answer'],
      ['onEnd'],
      ['onSuccess'],
    ]);
  });

  it('stream end with only whitespace streamed sends no reply', () => {
    const { calls, handlers } = record();
    const xhr = start(handlers);
    xhr.push('event: chat_stream\ndata:  \n\n');
    xhr.finish(200);
    assert.equal(calls.some(([n]) => n === 'onReply'), false);
  });

  it('move_map parses the payload', () => {
    const { calls, handlers } = record();
    const xhr = start(handlers);
    xhr.push(`event: move_map\ndata: {'lat': '38.5', 'lng': '-121.5', 'label': 'Folsom Dam'}\n\n`);
    assert.deepEqual(calls, [['onMoveMap', { lat: 38.5, lng: -121.5, label: 'Folsom Dam' }]]);
  });

  it('tour event reports the tour id before any tokens', () => {
    const { calls, handlers } = record();
    const xhr = start(handlers);
    xhr.push('event: tour\ndata: 7f3c2a\n\nevent: chat_stream\ndata: Hi\n\n');
    assert.deepEqual(calls, [['onTour', '7f3c2a'], ['onToken', 'Hi']]);
  });

  it('tour event split across chunks still reports the id once', () => {
    const { calls, handlers } = record();
    const xhr = start(handlers);
    xhr.push('event: tour\nda');
    xhr.push('ta: 7f3c2a\n\n');
    assert.deepEqual(calls, [['onTour', '7f3c2a']]);
  });

  it('empty tour event is ignored', () => {
    const { calls, handlers } = record();
    const xhr = start(handlers);
    xhr.push('event: tour\ndata:\n\n');
    assert.deepEqual(calls, []);
  });

  it('move_map with an unparseable payload is ignored', () => {
    const { calls, handlers } = record();
    const xhr = start(handlers);
    xhr.push('event: move_map\ndata: nowhere\n\n');
    assert.deepEqual(calls, []);
  });

  it('401 llm_key_required reports keyRequired', () => {
    const { calls, handlers } = record();
    const xhr = start(handlers);
    xhr.finish(401, JSON.stringify({ error: 'llm_key_required' }));
    assert.deepEqual(calls, [['onEnd'], ['onFailure', { status: 401, keyRequired: true }]]);
  });

  it('other errors report a plain failure, even with a non-JSON body', () => {
    const { calls, handlers } = record();
    const xhr = start(handlers);
    xhr.finish(500, '<html>oops</html>');
    assert.deepEqual(calls, [['onEnd'], ['onFailure', { status: 500, keyRequired: false }]]);
  });

  it('network errors call onNetworkError', () => {
    const { calls, handlers } = record();
    const xhr = start(handlers);
    xhr.onerror();
    assert.deepEqual(calls, [['onNetworkError']]);
  });

  it('abort detaches handlers before aborting', () => {
    const { calls, handlers } = record();
    const controller = startTourStream({ XHR: FakeXhr, url: 'u', body: {}, handlers });
    const xhr = FakeXhr.last;
    controller.abort();
    assert.equal(xhr.aborted, true);
    assert.equal(xhr.onreadystatechange, null);
    assert.equal(xhr.onprogress, null);
    assert.equal(xhr.onerror, null);
    assert.deepEqual(calls, []);
  });
});
