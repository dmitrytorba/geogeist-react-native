const { DEFAULT_REGION } = require('./mapConfig');

function buildCesiumHtml(apiKey, center) {
  const startLat = Number(center?.latitude) || DEFAULT_REGION.latitude;
  const startLng = Number(center?.longitude) || DEFAULT_REGION.longitude;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link href="https://cesium.com/downloads/cesiumjs/releases/1.127/Build/Cesium/Widgets/widgets.css" rel="stylesheet" />
    <style>
      html, body, #cesiumContainer { margin: 0; width: 100%; height: 100%; background: #020617; overflow: hidden; }
      .cesium-viewer-bottom, .cesium-credit-textContainer { display: none !important; }
    </style>
  </head>
  <body>
    <div id="cesiumContainer"></div>
    <script src="https://cesium.com/downloads/cesiumjs/releases/1.127/Build/Cesium/Cesium.js"></script>
    <script>
      (async function () {
        try {
          const viewer = new Cesium.Viewer('cesiumContainer', {
            animation: false,
            timeline: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,
            fullscreenButton: false,
            infoBox: false,
            selectionIndicator: false,
            shouldAnimate: true,
            globe: false,
          });

          const tileset = await Cesium.createGooglePhotorealistic3DTileset({ key: '${apiKey}' });
          viewer.scene.primitives.add(tileset);

          function addMarker(lat, lng, label) {
            viewer.entities.add({
              position: Cesium.Cartesian3.fromDegrees(lng, lat, 40),
              point: {
                pixelSize: 10,
                color: Cesium.Color.fromCssColorString('#22d3ee'),
                outlineColor: Cesium.Color.fromCssColorString('#082f49'),
                outlineWidth: 2,
              },
              label: {
                text: label || 'Point of interest',
                fillColor: Cesium.Color.WHITE,
                showBackground: true,
                backgroundColor: Cesium.Color.fromCssColorString('rgba(15,23,42,0.75)'),
                font: '14px sans-serif',
                pixelOffset: new Cesium.Cartesian2(0, -18),
              },
            });
          }

          function flyTo(lat, lng) {
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(lng, lat, 2200),
              orientation: {
                heading: 0,
                pitch: Cesium.Math.toRadians(-55),
                roll: 0,
              },
              duration: 1.3,
            });
          }

          flyTo(${startLat}, ${startLng});

          // react-native-webview posts on document (Android) or window (iOS).
          // Listen on both; skip the same event if it reaches both.
          let lastEvent = null;
          function onMessage(event) {
            if (event === lastEvent) return;
            lastEvent = event;
            try {
              const msg = JSON.parse(event.data || '{}');
              if ((msg?.type === 'move_map' || msg?.type === 'you_are_here') && Number.isFinite(msg.lat) && Number.isFinite(msg.lng)) {
                addMarker(msg.lat, msg.lng, msg.label);
                flyTo(msg.lat, msg.lng);
              }
            } catch {}
          }
          document.addEventListener('message', onMessage);
          window.addEventListener('message', onMessage);

          window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'ready' }));
        } catch (error) {
          window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', message: String(error?.message || error) }));
        }
      })();
    </script>
  </body>
</html>`;
}

module.exports = { buildCesiumHtml };
