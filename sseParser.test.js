const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createSseParser } = require('./sseParser');

function feed(text) {
  const parser = createSseParser();
  const events = parser.push(text);
  events.push(...parser.end());
  return events;
}

function streamedText(text) {
  return feed(text)
    .filter((event) => event.event === 'chat_stream')
    .map((event) => event.data)
    .join('');
}

describe('SSE chat_stream parsing', () => {
  it('keeps a single leading space on LLM tokens after the data: separator', () => {
    const sse = [
      'event: chat_stream',
      'data: You\'re',
      '',
      'event: chat_stream',
      'data:  currently',
      '',
      'event: chat_stream',
      'data:  in',
      '',
      'event: chat_stream',
      'data:  the',
      '',
      'event: chat_stream',
      'data:  lovely',
      '',
      'event: chat_stream',
      'data:  area',
      '',
      'event: chat_stream',
      'data:  of',
      '',
      'event: chat_stream',
      'data:  Orangevale',
      '',
      'event: chat_stream',
      'data:  ',
      '',
      'event: chat_stream',
      'data: ,',
      '',
      'event: chat_stream',
      'data: California',
      '',
      '',
    ].join('\n');

    assert.equal(
      streamedText(sse),
      "You're currently in the lovely area of Orangevale ,California"
    );
  });

  it('does not strip interior spaces from a full chat_stop payload', () => {
    const sse = [
      'event: chat_stop',
      'data: Hello! Welcome to our virtual tour. Right now, you\'re in a beautiful area.',
      '',
      '',
    ].join('\n');

    const events = feed(sse);
    assert.equal(events.length, 1);
    assert.equal(events[0].event, 'chat_stop');
    assert.equal(
      events[0].data,
      "Hello! Welcome to our virtual tour. Right now, you're in a beautiful area."
    );
  });

  it('preserves a payload that is only spaces after the SSE separator space', () => {
    const sse = ['event: chat_stream', 'data:  ', '', ''].join('\n');
    assert.equal(streamedText(sse), ' ');
  });

  it('flushes a trailing event when the stream ends without a blank line', () => {
    const parser = createSseParser();
    parser.push('event: chat_stream\ndata:  currently');
    const events = parser.end();
    assert.deepEqual(events, [{ event: 'chat_stream', data: ' currently' }]);
  });

  it('keeps leading spaces when chunks split mid-line', () => {
    const parser = createSseParser();
    const events = [];
    events.push(...parser.push('event: chat_stream\ndata: You'));
    events.push(...parser.push("'re\n\nevent: chat_stream\ndata:  cur"));
    events.push(...parser.push('rently\n\n'));
    events.push(...parser.end());
    assert.equal(
      events
        .filter((event) => event.event === 'chat_stream')
        .map((event) => event.data)
        .join(''),
      "You're currently"
    );
  });
});
