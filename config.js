function apiBase() {
  const raw = process.env.EXPO_PUBLIC_API_BASE || 'https://tourapi.torb.uk';
  return String(raw).replace(/\/$/, '');
}

module.exports = { apiBase };
