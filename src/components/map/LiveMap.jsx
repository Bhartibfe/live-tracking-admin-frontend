import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { MAPBOX_TOKEN } from "../../config";

// SVG Icons (keep your actual SVG content here)
const STATION_ICON_SVG = (isDestination = false) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${
    isDestination ? "#FACC15" : "#FF4D4D"
  }">
    <path d="M11.5 2L6.5 14h4l-1 8 7-12h-4l3-8z" />
  </svg>
`;

const USER_ICON_SVG = (isSource = false) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${
    isSource ? "#06B6D4" : "#64748B"
  }">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 
      1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2
      c0-2.66-5.33-4-8-4z"/>
  </svg>
`;

// Smooth interpolation
const interpolatePoints = (coords, numPointsBetween = 20) => {
  const interpolated = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];

    interpolated.push([lng1, lat1]);

    for (let j = 1; j <= numPointsBetween; j++) {
      const ratio = j / (numPointsBetween + 1);
      const interpolatedLng = lng1 + ratio * (lng2 - lng1);
      const interpolatedLat = lat1 + ratio * (lat2 - lat1);
      interpolated.push([interpolatedLng, interpolatedLat]);
    }
  }
  interpolated.push(coords[coords.length - 1]);
  return interpolated;
};

// Route colors
const ROUTE_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
];

export default function LiveMap({
  usersMap = {},
  chargingPoints = [],
  focusUser,
  calculatedRoutes = {},
  selectedUserIds = [],
  onUserMovementStart,
  onUserPositionUpdate,
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const stationMarkersRef = useRef({});
  const movementIntervalsRef = useRef({});

  const [animatedUserPositions, setAnimatedUserPositions] = useState({});
  const [finalUserPositions, setFinalUserPositions] = useState({});

  const activeRouteLayersRef = useRef(new Set());

  const DEFAULT_CENTER = [77.04179, 28.412942];

  // Start movement for one user
  const startUserMovement = (userId, routeCoordinates) => {
    if (movementIntervalsRef.current[userId]) {
      clearInterval(movementIntervalsRef.current[userId]);
      delete movementIntervalsRef.current[userId];
    }

    if (!routeCoordinates || routeCoordinates.length === 0) {
      console.error("No route coordinates provided");
      return;
    }

    const smoothCoordinates = interpolatePoints(routeCoordinates, 60);
    console.log(
      `🎯 User ${userId}: Interpolated to ${smoothCoordinates.length} points`
    );

    let i = 0;

    movementIntervalsRef.current[userId] = setInterval(() => {
      const coord = smoothCoordinates[i];

      if (!coord || i >= smoothCoordinates.length) {
        clearInterval(movementIntervalsRef.current[userId]);
        delete movementIntervalsRef.current[userId];

        const finalCoord = smoothCoordinates[smoothCoordinates.length - 1];

        setFinalUserPositions((prev) => ({
          ...prev,
          [userId]: { lng: finalCoord[0], lat: finalCoord[1] },
        }));

        setAnimatedUserPositions((prev) => {
          const newPositions = { ...prev };
          delete newPositions[userId];
          return newPositions;
        });

        console.log(`✅ User ${userId} animation completed`);
        return;
      }

      setAnimatedUserPositions((prev) => ({
        ...prev,
        [userId]: { lng: coord[0], lat: coord[1] },
      }));

      if (markersRef.current[userId]) {
        markersRef.current[userId].setLngLat([coord[0], coord[1]]);
      }

      i++;
    }, 200);
  };

  // Stop movement for one user (stop at current coordinate)
  const stopUserMovement = (userId) => {
    const interval = movementIntervalsRef.current[userId];
    if (interval) {
      clearInterval(interval);
      delete movementIntervalsRef.current[userId];
    }
    // Do NOT clear animatedUserPositions / finalUserPositions here,
    // so the last coordinate remains as the new "starting point".
  };

  // Expose controls to parent
  useEffect(() => {
    if (onUserMovementStart) {
      onUserMovementStart({
        start: startUserMovement,
        stop: stopUserMovement,
      });
    }
  }, [onUserMovementStart]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(movementIntervalsRef.current).forEach((interval) =>
        clearInterval(interval)
      );
    };
  }, []);

  // Init map
  useEffect(() => {
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: DEFAULT_CENTER,
      zoom: 10,
      attributionControl: false,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    return () => {
      map.remove();
    };
  }, []);

  // Render route lines
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;

    const updateRouteLayers = () => {
      const currentRouteIds = new Set(Object.keys(calculatedRoutes));

      // Remove unused routes
      activeRouteLayersRef.current.forEach((userId) => {
        if (!currentRouteIds.has(userId)) {
          const layerId = `route-line-${userId}`;
          const sourceId = `route-${userId}`;

          if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
            console.log(`🗑️ Removed layer: ${layerId}`);
          }
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
            console.log(`🗑️ Removed source: ${sourceId}`);
          }
          activeRouteLayersRef.current.delete(userId);
        }
      });

      // Add or update routes
      Object.entries(calculatedRoutes).forEach(([userId, routeData], index) => {
        const sourceId = `route-${userId}`;
        const layerId = `route-line-${userId}`;
        const color = ROUTE_COLORS[index % ROUTE_COLORS.length];

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: "geojson",
            data: routeData,
          });

          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": color,
              "line-width": 4,
              "line-opacity": 0.7,
            },
          });

          activeRouteLayersRef.current.add(userId);
          console.log(`✅ Added route layer for user: ${userId}`);
        } else {
          const source = map.getSource(sourceId);
          source.setData(routeData);
        }
      });
    };

    if (map.loaded()) {
      updateRouteLayers();
    } else {
      map.once("load", updateRouteLayers);
    }
  }, [calculatedRoutes]);

  // Trim route lines as user moves
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.entries(animatedUserPositions).forEach(([userId, position]) => {
      const sourceId = `route-${userId}`;
      const source = map.getSource(sourceId);
      const routeData = calculatedRoutes[userId];

      if (!source || !routeData) return;

      const allCoordinates = routeData.features[0].geometry.coordinates;

      let closestIndex = 0;
      let minDistance = Infinity;

      allCoordinates.forEach((coord, index) => {
        const distance = Math.sqrt(
          Math.pow(coord[0] - position.lng, 2) +
            Math.pow(coord[1] - position.lat, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });

      const remainingCoordinates = allCoordinates.slice(closestIndex);

      if (remainingCoordinates.length > 0) {
        source.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: remainingCoordinates,
              },
            },
          ],
        });
      }
    });
  }, [animatedUserPositions, calculatedRoutes]);
  // AUTO-FIT BOUNDS
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Only block auto-fit when focusing a specific user ID, not CENTER_*
    const isManualTracking =
      focusUser && !String(focusUser).startsWith("CENTER_");
    if (isManualTracking) return;

    if (Object.keys(animatedUserPositions).length > 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    let shouldFit = false;

    if (Object.keys(calculatedRoutes).length > 0) {
      Object.values(calculatedRoutes).forEach((routeData) => {
        const routeCoords = routeData.features[0].geometry.coordinates;
        routeCoords.forEach((coord) => {
          bounds.extend(coord);
          shouldFit = true;
        });
      });

      if (shouldFit && !bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: { top: 100, bottom: 100, left: 100, right: 100 },
          maxZoom: 14,
          duration: 1500,
        });
      }
    } else {
      Object.values(usersMap).forEach((u) => {
        if (u?.lat != null && u?.lng != null) {
          bounds.extend([u.lng, u.lat]);
          shouldFit = true;
        }
      });
      chargingPoints.forEach((cp) => {
        if (cp?.lat != null && cp?.lng != null) {
          bounds.extend([cp.lng, cp.lat]);
          shouldFit = true;
        }
      });

      if (shouldFit && !bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: { top: 80, bottom: 80, left: 80, right: 80 },
          maxZoom: 13,
          duration: 1200,
        });
      }
    }
  }, [
    usersMap,
    chargingPoints,
    focusUser,
    calculatedRoutes,
    animatedUserPositions,
  ]);

  // Report current logical positions to parent
  useEffect(() => {
    if (!onUserPositionUpdate) return;

    const merged = {};

    Object.entries(usersMap).forEach(([userId, u]) => {
      let pos = null;
      if (animatedUserPositions[userId]) {
        pos = animatedUserPositions[userId];
      } else if (finalUserPositions[userId]) {
        pos = finalUserPositions[userId];
      } else if (u?.lat != null && u?.lng != null) {
        pos = { lng: u.lng, lat: u.lat };
      }
      if (pos) {
        merged[userId] = { ...u, ...pos };
      }
    });

    onUserPositionUpdate(merged);
  }, [
    usersMap,
    animatedUserPositions,
    finalUserPositions,
    onUserPositionUpdate,
  ]);

  // Station markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(stationMarkersRef.current).forEach((m) => m.remove());
    stationMarkersRef.current = {};

    if (!chargingPoints) return;

    const destinationStationIds = Object.values(calculatedRoutes)
      .map((route) => route.destinationStation?.id)
      .filter(Boolean);

    chargingPoints.forEach((cp) => {
      if (!cp || typeof cp !== "object" || cp.lat == null || cp.lng == null)
        return;

      const isDestination = destinationStationIds.includes(cp.id);

      const el = document.createElement("div");
      el.className = "marker-station";
      el.innerHTML = STATION_ICON_SVG(isDestination);
      el.style.width = "42px";
      el.style.height = "42px";
      el.style.cursor = "pointer";
      el.style.filter = `drop-shadow(0 0 6px ${
        isDestination ? "#FACC15" : "#FF4D4D"
      })`;

      const popup = new mapboxgl.Popup({
        offset: 20,
        closeButton: false,
        className: "custom-popup-dark",
      }).setHTML(`
        <div style="background:#0f172a;padding:12px 16px;border-radius:12px;border:1px solid ${
          isDestination ? "#FACC15" : "#FF4D4D"
        };box-shadow:0 8px 24px rgba(0,0,0,0.6);min-width:180px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:20px;">⚡</span>
            <div style="font-weight:700;color:#ffffff;font-size:14px;">${
              cp.name
            }</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="display:inline-block;width:6px;height:6px;background:${
              isDestination ? "#FACC15" : "#FF4D4D"
            };border-radius:50%;"></span>
            <span style="color:#94a3b8;font-size:12px;">Charging Station</span>
          </div>
          ${
            isDestination
              ? `<div style="background:rgba(250,204,21,0.1);border:1px solid rgba(250,204,21,0.3);padding:6px 10px;border-radius:8px;margin-top:8px;">
                  <span style="color:#FACC15;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
                    Destination
                  </span>
                 </div>`
              : ""
          }
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(148,163,184,0.2);color:#64748b;font-size:11px;">
            <strong style="color:#94a3b8;">ID</strong> ${cp.id}
          </div>
        </div>
      `);

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([cp.lng, cp.lat])
        .setPopup(popup)
        .addTo(map);

      stationMarkersRef.current[cp.id] = marker;
    });
  }, [chargingPoints, calculatedRoutes]);

  // User markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    if (!usersMap) return;

    Object.entries(usersMap).forEach(([userId, u]) => {
      if (!u || u.lat == null || u.lng == null) return;

      let pos;
      if (animatedUserPositions[userId]) {
        pos = animatedUserPositions[userId];
      } else if (finalUserPositions[userId]) {
        pos = finalUserPositions[userId];
      } else {
        pos = { lng: u.lng, lat: u.lat };
      }

      const isSource = selectedUserIds.includes(userId);

      const el = document.createElement("div");
      el.className = "marker-user";
      el.innerHTML = USER_ICON_SVG(isSource);
      el.style.width = "36px";
      el.style.height = "36px";
      el.style.cursor = "pointer";
      el.style.filter = `drop-shadow(0 0 6px ${
        isSource ? "#06B6D4" : "#64748B"
      })`;

      const popup = new mapboxgl.Popup({
        offset: 20,
        closeButton: false,
        className: "custom-popup-dark",
      }).setHTML(`
        <div style="background:#0f172a;padding:12px 16px;border-radius:12px;border:1px solid ${
          isSource ? "#06B6D4" : "#64748B"
        };box-shadow:0 8px 24px rgba(0,0,0,0.6);min-width:200px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:20px;">🚗</span>
            <div style="font-weight:700;color:#ffffff;font-size:14px;">
              ${u.name || `User ${userId.slice(0, 6)}`}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="display:inline-block;width:6px;height:6px;background:${
              isSource ? "#06B6D4" : "#64748B"
            };border-radius:50%;"></span>
            <span style="color:#94a3b8;font-size:12px;">Active Vehicle</span>
          </div>
          ${
            isSource
              ? `<div style="background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.3);padding:6px 10px;border-radius:8px;margin-bottom:8px;">
                  <span style="color:#06B6D4;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
                    Assigned
                  </span>
                 </div>`
              : ""
          }
          <div style="background:rgba(30,41,59,0.5);padding:8px;border-radius:8px;margin-top:8px;">
            <div style="font-family:'Courier New',monospace;font-size:11px;color:#94a3b8;line-height:1.6;">
              <div><strong style="color:#cbd5e1;">Lat</strong> ${pos.lat.toFixed(
                6
              )}</div>
              <div><strong style="color:#cbd5e1;">Lng</strong> ${pos.lng.toFixed(
                6
              )}</div>
            </div>
          </div>
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(148,163,184,0.2);color:#64748b;font-size:11px;">
            <strong style="color:#94a3b8;">ID</strong> ${userId.slice(0, 8)}
          </div>
        </div>
      `);

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([pos.lng, pos.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current[userId] = marker;
    });
  }, [usersMap, selectedUserIds, animatedUserPositions, finalUserPositions]);

  // Focus user
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusUser) return;

    const isCenter = String(focusUser).startsWith("CENTER_");
    const targetId = isCenter ? focusUser.replace("CENTER_", "") : focusUser;
    const user = usersMap[targetId];

    if (!user || user.lat == null || user.lng == null) return;

    let pos;
    if (finalUserPositions[targetId]) {
      pos = finalUserPositions[targetId];
    } else if (animatedUserPositions[targetId]) {
      pos = animatedUserPositions[targetId];
    } else {
      pos = { lng: user.lng, lat: user.lat };
    }

    map.flyTo({
      center: [pos.lng, pos.lat],
      zoom: 14,
      duration: 1000,
    });

    if (!isCenter) {
      const marker = markersRef.current[targetId];
      if (marker) marker.togglePopup();
    }
  }, [focusUser, usersMap, finalUserPositions, animatedUserPositions]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full rounded-lg shadow-2xl"
      style={{ minHeight: "500px" }}
    />
  );
}
