function sseFieldValue(line, prefix) {
  if (!line.startsWith(prefix)) return null;
  // SSE spec: drop at most one space after the colon. Extra leading spaces
  // belong to the payload (LLM tokens often start with a space).
  let value = line.slice(prefix.length);
  if (value.startsWith(' ')) value = value.slice(1);
  return value;
}

function createSseParser() {
  let pendingLineBuffer = '';
  let eventName = null;
  let eventData = '';

  const flushEvent = () => {
    if (!eventName) {
      eventData = '';
      return null;
    }
    const data = eventData.replace(/\n$/, '');
    const event = { event: eventName, data };
    eventName = null;
    eventData = '';
    return event;
  };

  const ingestLine = (line) => {
    if (line.startsWith('event:')) {
      eventName = sseFieldValue(line, 'event:');
      return null;
    }
    if (line.startsWith('data:')) {
      eventData += sseFieldValue(line, 'data:') + '\n';
      return null;
    }
    if (line.trim() === '') {
      return flushEvent();
    }
    return null;
  };

  return {
    push(chunk) {
      const events = [];
      pendingLineBuffer += chunk;
      const lines = pendingLineBuffer.split(/\r?\n/);
      pendingLineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const event = ingestLine(line);
        if (event) events.push(event);
      }
      return events;
    },
    end() {
      const events = [];
      if (pendingLineBuffer.trim() || eventName || eventData) {
        const residual = pendingLineBuffer;
        pendingLineBuffer = '';
        const event = ingestLine(residual) || flushEvent();
        if (event) events.push(event);
      }
      return events;
    },
  };
}

module.exports = { createSseParser, sseFieldValue };
