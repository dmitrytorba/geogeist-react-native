const { createJsonClient } = require('./httpClient');

function mapTourMessage(message) {
  const role = message.role === 'assistant' || message.role === 'ai' ? 'ai' : 'human';
  return { role, content: message.content || '' };
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

module.exports = { createToursApi, mapTourMessage, shouldSkipBootstrapOnResume };
