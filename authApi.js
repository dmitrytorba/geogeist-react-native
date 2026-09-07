const { apiBase } = require('./config');

function mapAuthError(status, body) {
  const code = body && body.error;
  if (status === 409 || code === 'email_taken') {
    return 'That email is already registered.';
  }
  if (status === 401 || code === 'auth_required') {
    return 'Incorrect email or password.';
  }
  if (code === 'password_too_short') {
    return 'Password must be at least 8 characters.';
  }
  if (code === 'invalid_email') {
    return 'Enter a valid email address.';
  }
  return 'Could not sign in. Try again.';
}

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function createAuthApi(fetchImpl, baseUrl) {
  const fetchFn = fetchImpl || fetch;
  const root = (baseUrl || apiBase()).replace(/\/$/, '');

  async function request(path, { method = 'GET', token, body } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetchFn(`${root}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await parseJson(res);
    return { ok: res.ok, status: res.status, data };
  }

  return {
    async signup(email, password) {
      const result = await request('/auth/signup', {
        method: 'POST',
        body: { email, password },
      });
      if (!result.ok) {
        return { ok: false, error: mapAuthError(result.status, result.data) };
      }
      return { ok: true, token: result.data.token, user: result.data.user };
    },
    async login(email, password) {
      const result = await request('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      if (!result.ok) {
        return { ok: false, error: mapAuthError(result.status, result.data) };
      }
      return { ok: true, token: result.data.token, user: result.data.user };
    },
    async logout(token) {
      await request('/auth/logout', { method: 'POST', token });
      return { ok: true };
    },
    async me(token) {
      const result = await request('/me', { token });
      if (!result.ok) {
        return { ok: false, error: mapAuthError(result.status, result.data) };
      }
      return { ok: true, user: result.data };
    },
    mapAuthError,
  };
}

module.exports = { createAuthApi, mapAuthError };
