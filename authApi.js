const { createJsonClient } = require('./httpClient');

function waitText(seconds) {
  const minutes = Math.ceil((Number(seconds) || 0) / 60);
  if (minutes <= 1) return 'a minute';
  return `${minutes} minutes`;
}

function mapAuthError(status, body) {
  const code = body && body.error;
  if (status === 429 || code === 'too_many_attempts') {
    return `Too many sign-in attempts. Try again in ${waitText(body && body.retry_after)}.`;
  }
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
  if (status === 0 || code === 'network_error') {
    return 'Could not reach the server. Check your connection.';
  }
  return 'Could not sign in. Try again.';
}

function createAuthApi(fetchImpl, baseUrl) {
  const request = createJsonClient(fetchImpl, baseUrl);

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
        return { ok: false, status: result.status, error: mapAuthError(result.status, result.data) };
      }
      return { ok: true, user: result.data };
    },
    mapAuthError,
  };
}

module.exports = { createAuthApi, mapAuthError };
