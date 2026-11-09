// move_map SSE data is a Python dict repr from the backend, e.g.
// {'lat': '38.5', 'lng': '-121.5', 'label': "St. Mary's"}. Python switches to
// double quotes when the string holds an apostrophe, so a blanket ' -> "
// swap breaks those labels. Parse JSON first, then pull fields by pattern.
function pyField(raw, name) {
  const re = new RegExp(`['"]${name}['"]\\s*:\\s*(?:'((?:[^'\\\\]|\\\\.)*)'|"((?:[^"\\\\]|\\\\.)*)"|([^,}\\s]+))`);
  const match = re.exec(raw);
  if (!match) return undefined;
  const value = match[1] ?? match[2] ?? match[3];
  return value.replace(/\\(.)/g, '$1');
}

function parseMoveMapPayload(raw) {
  const text = String(raw || '');
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { lat: pyField(text, 'lat'), lng: pyField(text, 'lng'), label: pyField(text, 'label') };
  }
  if (!data || typeof data !== 'object') return null;
  const lat = Number.parseFloat(data.lat);
  const lng = Number.parseFloat(data.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: data.label || 'Point of interest' };
}

module.exports = { parseMoveMapPayload };
