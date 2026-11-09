const { apiBase } = require('./config');

// JSON request helper shared by the auth and tours clients. Network failures
// resolve to { ok: false, status: 0 } so UI callers never see a rejection.
function createJsonClient(fetchImpl, baseUrl) {
  const fetchFn = fetchImpl || fetch;
  const root = (baseUrl || apiBase()).replace(/\/$/, '');

  return async function request(path, { method = 'GET', token, body } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetchFn(`${root}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      return { ok: false, status: 0, data: { error: 'network_error' } };
    }
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { ok: res.ok, status: res.status, data };
  };
}

module.exports = { createJsonClient };
