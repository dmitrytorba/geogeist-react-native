const { createSseParser } = require('./sseParser');
const { isLlmKeyRequired } = require('./keyStore');
const { parseMoveMapPayload } = require('./mapPayload');

const XHR_DONE = 4;

// One POST /stream/ request. The backend answers with SSE events:
// tour (the tour id, sent first), chat_stream (a token), chat_stop (the full
// reply), move_map (a place).
// Handlers:
//   onTour(id)               the tour this request belongs to
//   onToken(text)            each chat_stream token
//   onReply(text)            a finished AI reply (chat_stop, or the streamed
//                            text if the stream ended without chat_stop)
//   onMoveMap({lat,lng,label})
//   onEnd()                  request finished, before onFailure/onSuccess
//   onFailure({status, keyRequired})  HTTP status >= 400
//   onSuccess()              HTTP 2xx/3xx
//   onNetworkError()         xhr.onerror
function startTourStream({ XHR, url, headers = {}, body, handlers = {} }) {
  const Xhr = XHR || globalThis.XMLHttpRequest;
  const xhr = new Xhr();
  const parser = createSseParser();
  let cursor = 0;
  let streamedText = '';
  let receivedChatStop = false;

  const handleEvent = (sseEvent) => {
    const data = sseEvent.data;
    if (sseEvent.event === 'tour') {
      if (data.trim()) handlers.onTour?.(data.trim());
    } else if (sseEvent.event === 'chat_stream') {
      streamedText += data;
      handlers.onToken?.(data);
    } else if (sseEvent.event === 'chat_stop') {
      receivedChatStop = true;
      handlers.onReply?.(data || streamedText);
      streamedText = '';
    } else if (sseEvent.event === 'move_map') {
      const payload = parseMoveMapPayload(data);
      if (payload) handlers.onMoveMap?.(payload);
    }
  };

  xhr.onreadystatechange = () => {
    if (xhr.readyState !== XHR_DONE) return;
    for (const sseEvent of parser.end()) handleEvent(sseEvent);

    if (!receivedChatStop && streamedText.trim()) handlers.onReply?.(streamedText);
    handlers.onEnd?.();

    if (xhr.status >= 400) {
      let parsed = {};
      try {
        parsed = JSON.parse(xhr.responseText || '{}');
      } catch {
        parsed = {};
      }
      handlers.onFailure?.({ status: xhr.status, keyRequired: Boolean(isLlmKeyRequired(xhr.status, parsed)) });
    } else if (xhr.status >= 200) {
      handlers.onSuccess?.();
    }
  };

  xhr.onerror = () => handlers.onNetworkError?.();

  xhr.onprogress = () => {
    const chunk = xhr.responseText.slice(cursor);
    cursor = xhr.responseText.length;
    if (!chunk) return;
    for (const sseEvent of parser.push(chunk)) handleEvent(sseEvent);
  };

  xhr.open('POST', url);
  Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
  xhr.send(JSON.stringify(body));

  return {
    xhr,
    // Detach handlers first so an abort-triggered DONE can't touch state.
    abort() {
      xhr.onreadystatechange = null;
      xhr.onprogress = null;
      xhr.onerror = null;
      xhr.abort();
    },
  };
}

module.exports = { startTourStream };
