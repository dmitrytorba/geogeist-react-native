const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseMoveMapPayload } = require('./mapPayload');

describe('parseMoveMapPayload', () => {
  it('parses a Python dict repr with string coords', () => {
    assert.deepEqual(parseMoveMapPayload("{'lat': '38.5', 'lng': '-121.5', 'label': 'Folsom Dam'}"), {
      lat: 38.5,
      lng: -121.5,
      label: 'Folsom Dam',
    });
  });

  it('keeps apostrophes in double-quoted labels', () => {
    assert.deepEqual(parseMoveMapPayload(`{'lat': '37.79', 'lng': '-122.4', 'label': "St. Mary's Cathedral"}`), {
      lat: 37.79,
      lng: -122.4,
      label: "St. Mary's Cathedral",
    });
  });

  it('parses JSON and numeric coords', () => {
    assert.deepEqual(parseMoveMapPayload('{"lat": 1.5, "lng": 2, "label": "A"}'), { lat: 1.5, lng: 2, label: 'A' });
  });

  it('defaults the label and rejects bad coords', () => {
    assert.equal(parseMoveMapPayload("{'lat': '1', 'lng': '2'}").label, 'Point of interest');
    assert.equal(parseMoveMapPayload("{'lat': 'north', 'lng': '2'}"), null);
    assert.equal(parseMoveMapPayload(''), null);
    assert.equal(parseMoveMapPayload(null), null);
  });
});
