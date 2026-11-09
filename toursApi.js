const { createJsonClient } = require('./httpClient');

function mapTourMessage(message) {
  const role = message.role === 'assistant' || message.role === 'ai' ? 'ai' : 'human';
  return { role, content: message.content || '' };
}

// Tours saved before the server stopped persisting the bootstrap prompt open
// with a bare human 'hi'. Drop it so a resumed tour starts with the greeting.
const BOOTSTRAP_PROMPT = 'hi';

function mapTourMessages(messages) {
  const mapped = (messages || []).map(mapTourMessage);
  const first = mapped[0];
  if (first && first.role === 'human' && first.content.trim().toLowerCase() === BOOTSTRAP_PROMPT) {
    return mapped.slice(1);
  }
  return mapped;
}

function shouldSkipBootstrapOnResume(tourId) {
  return Boolean(tourId);
}

function createToursApi(fetchImpl, baseUrl) {
  const request = createJsonClient(fetchImpl, baseUrl);

  return {
    async list(token) {
      return request('/tours/', { token });
    },
    async get(token, tourId) {
      return request(`/tours/${tourId}`, { token });
    },
    async patch(token, tourId, title) {
      return request(`/tours/${tourId}`, { method: 'PATCH', token, body: { title } });
    },
    async remove(token, tourId) {
      return request(`/tours/${tourId}`, { method: 'DELETE', token });
    },
    async patchMe(token, payload) {
      return request('/me', { method: 'PATCH', token, body: payload });
    },
    mapTourMessage,
  };
}

module.exports = { createToursApi, mapTourMessage, mapTourMessages, shouldSkipBootstrapOnResume, BOOTSTRAP_PROMPT };
