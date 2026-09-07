const { apiBase } = require('./config');

function mapTourMessage(message) {
  const role = message.role === 'assistant' || message.role === 'ai' ? 'ai' : 'human';
  return { role, content: message.content || '' };
}

function shouldSkipBootstrapOnResume(tourId) {
  return Boolean(tourId);
}

function createToursApi(fetchImpl, baseUrl) {
  const fetchFn = fetchImpl || fetch;
  const root = (baseUrl || apiBase()).replace(/\/$/, '');

  async function request(path, { method = 'GET', token, body } = {}) {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetchFn(`${root}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { ok: res.ok, status: res.status, data };
  }

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
