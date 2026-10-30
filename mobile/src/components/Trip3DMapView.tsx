import { MAPTILER_STYLE_URL } from "@/constants/map";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { Colors, Radius } from "@/constants/theme";
import type { SystemTrailDetail } from "@/features/leaders/services/leader-public-trips.api";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Trip3DMapViewProps {
  /** Pre-fetched trail data. Pass either this OR trailCode. */
  trailData?: SystemTrailDetail | null;
  /**
   * Trail code used to load the trail info from the API.
   * Only used if trailData is not provided. The parent is responsible
   * for fetching and passing trailData instead.
   */
  trailCode?: string;
  height?: number;
  /** Show the map full-height (modal mode) */
  fullScreen?: boolean;
}

// ─── HTML Template ────────────────────────────────────────────────────────────

function buildMapHtml(trail: SystemTrailDetail): string {
  const center = trail.initialCamera?.center ?? [106.1712, 11.3789];
  const zoom = trail.initialCamera?.zoom ?? 13.5;
  const pitch = trail.initialCamera?.pitch ?? 60;
  const bearing = trail.initialCamera?.bearing ?? -20;

  const routeCoords = trail.routeGeojson?.features?.[0]?.geometry?.coordinates ?? [];
  const checkpoints = trail.checkpoints ?? [];

  const checkpointMarkersJs = checkpoints
    .map(
      (cp) => `
    new maplibregl.Marker({
      element: createCpMarker(${cp.sequence}, '${cp.name.replace(/'/g, "\\'")}')
    }).setLngLat([${cp.longitude}, ${cp.latitude}]).addTo(map);
  `,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
<title>TrekGo 3D Trail</title>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body, #map { width:100%; height:100%; overflow:hidden; background:#141d13; }

  .cp-marker {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: #FF3D00;
    border: 2.5px solid #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, sans-serif;
    font-size: 12px;
    font-weight: 900;
    color: #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5), 0 0 12px rgba(255,61,0,0.6);
    cursor: pointer;
  }

  .cp-tooltip {
    position: absolute;
    bottom: 36px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(14,15,12,0.9);
    color: #fff;
    font-size: 10px;
    white-space: nowrap;
    padding: 3px 7px;
    border-radius: 6px;
    pointer-events: none;
    display: none;
  }
  .cp-marker:hover .cp-tooltip { display: block; }

</style>
</head>
<body>
<div id="map"></div>
<script>
(function() {
  var trailName = '${trail.name.replace(/'/g, "\\'")}';
  var routeCoords = ${JSON.stringify(routeCoords)};

  function createCpMarker(seq, name) {
    var el = document.createElement('div');
    el.className = 'cp-marker';
    el.innerHTML = seq + '<span class="cp-tooltip">' + name + '</span>';
    return el;
  }

  var map = new maplibregl.Map({
    container: 'map',
      style: ${JSON.stringify(MAPTILER_STYLE_URL)},
      center: ${JSON.stringify(center)},
    zoom: ${zoom},
    pitch: ${pitch},
    bearing: ${bearing},
    antialias: true,
    maxPitch: 85
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

  map.on('load', function() {
    map.addSource('terrain-dem', {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      encoding: 'terrarium',
      maxzoom: 15
    });
    map.setTerrain({ source: 'terrain-dem', exaggeration: 2.0 });

    if (routeCoords.length > 0) {
      // Glow / halo layer underneath
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: routeCoords }
          }]
        }
      });

      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#FF3D00',
          'line-width': 10,
          'line-blur': 6,
          'line-opacity': 0.4
        }
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#FF3D00',
          'line-width': 3,
          'line-opacity': 0.95
        }
      });

      // Start & end markers
      if (routeCoords.length > 0) {
        var startEl = document.createElement('div');
        startEl.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#9fe870;border:2px solid #fff;box-shadow:0 0 8px rgba(159,232,112,0.8)';
        new maplibregl.Marker({ element: startEl }).setLngLat(routeCoords[0]).addTo(map);

        var endEl = document.createElement('div');
        endEl.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#fed018;border:2px solid #fff;box-shadow:0 0 8px rgba(254,208,24,0.8)';
        new maplibregl.Marker({ element: endEl }).setLngLat(routeCoords[routeCoords.length - 1]).addTo(map);
      }
    }

    // Checkpoints
    ${checkpointMarkersJs}

    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  });
})();
</script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Trip3DMapView({
  trailData,
  height = 350,
  fullScreen = false,
}: Trip3DMapViewProps) {

  const html = useMemo(() => {
    if (!trailData) return null;
    return buildMapHtml(trailData);
  }, [trailData]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") {
        // Map loaded successfully
      }
    } catch {
      // ignore
    }
  }, []);

  const containerStyle = [
    styles.container,
    fullScreen ? styles.fullScreen : { height },
  ];

  if (!trailData) {
    return (
      <View style={[containerStyle, styles.placeholder]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.placeholderText}>Đang tải bản đồ 3D...</Text>
      </View>
    );
  }

  // On web platform, WebView is not available; show a fallback
  if (Platform.OS === "web") {
    return (
      <View style={[containerStyle, styles.placeholder]}>
        <Text style={styles.placeholderText}>
          🗺 Bản đồ 3D khả dụng trên iOS / Android
        </Text>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: html! }}
        style={styles.webview}
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.placeholderText}>Đang khởi tạo bản đồ 3D...</Text>
          </View>
        )}
        renderError={() => (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.placeholderText}>
              Không thể tải bản đồ. Kiểm tra kết nối mạng.
            </Text>
          </View>
        )}
      />
      {/* Trail name badge */}
      <View style={styles.trailBadge}>
        <View style={styles.trailBadgeDot} />
        <Text style={styles.trailBadgeText} numberOfLines={1}>
          {trailData.name}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: "#141d13",
  },
  fullScreen: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: "#141d13",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  placeholderText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  errorIcon: {
    fontSize: 28,
  },
  trailBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(14,15,12,0.85)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    maxWidth: "80%",
  },
  trailBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF3D00",
  },
  trailBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
});
