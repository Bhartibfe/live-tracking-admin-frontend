import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { MAPBOX_TOKEN } from "../../config";

/**
 * props:
 *  usersMap: { userId: { lat, lng, name } }
 *  chargingPoints: [{ id, name, lat, lng }]
 *  focusUser: userId selected from sidebar
 */
export default function LiveMap({ usersMap, chargingPoints, focusUser }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const stationMarkersRef = useRef([]);

  const DEFAULT_CENTER = [77.04179, 28.412942]; // Gurugram Sector-69

  // ---------------------------------------------------------
  // INIT MAP (STABLE, NON-CLIPPING, FIXED RESIZE)
  // ---------------------------------------------------------
  useEffect(() => {
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: DEFAULT_CENTER,
      zoom: 14
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Fix map clipping on initial load
    setTimeout(() => map.resize(), 200);

    return () => map.remove();
  }, []);

  // ---------------------------------------------------------
  // USER MARKERS (NO DRIFTING, NO SHIFTING)
  // ---------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove markers that no longer exist
    Object.keys(markersRef.current).forEach((id) => {
      if (!usersMap[id]) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Create/update markers
    Object.entries(usersMap).forEach(([id, u]) => {
      if (u.lat == null || u.lng == null) return;

      const lat = Number(u.lat);
      const lng = Number(u.lng);

      // Strict validation to prevent map jumps
      if (isNaN(lat) || isNaN(lng)) return;
      if (lat > 90 || lat < -90) return;
      if (lng > 180 || lng < -180) return;

      const lngLat = [lng, lat];

      if (!markersRef.current[id]) {
        const el = document.createElement("div");
        el.style.width = "20px";
        el.style.height = "20px";
        el.style.borderRadius = "50%";
        el.style.background = "#22c55e";
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 0 6px rgba(0,0,0,0.7)";

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: "center",
          pitchAlignment: "viewport",
          rotationAlignment: "viewport",
        })
          .setLngLat(lngLat)
          .addTo(map);

        marker.setPopup(
          new mapboxgl.Popup({ offset: 10 }).setHTML(`
            <div style="font-size:12px;">
              <strong>${u.name || "User"}</strong><br/>
              <span style="color:#777">${id}</span>
            </div>
          `)
        );

        markersRef.current[id] = marker;
      } else {
        markersRef.current[id].setLngLat(lngLat);
      }
    });
  }, [usersMap]);

  // ---------------------------------------------------------
  // CHARGING POINT MARKERS (STABLE)
  // ---------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    stationMarkersRef.current.forEach((m) => m.remove());
    stationMarkersRef.current = [];

    chargingPoints.forEach((cp) => {
      if (cp.lat == null || cp.lng == null) return;

      const lat = Number(cp.lat);
      const lng = Number(cp.lng);

      if (isNaN(lat) || isNaN(lng)) return;
      if (lat > 90 || lat < -90) return;
      if (lng > 180 || lng < -180) return;

      const lngLat = [lng, lat];

      const el = document.createElement("div");
      el.style.width = "22px";
      el.style.height = "22px";
      el.style.borderRadius = "50%";
      el.style.background = "#facc15";
      el.style.border = "2px solid black";
      el.style.boxShadow = "0 0 8px rgba(0,0,0,0.7)";

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "center",
        pitchAlignment: "viewport",
        rotationAlignment: "viewport",
      })
        .setLngLat(lngLat)
        .setPopup(
          new mapboxgl.Popup({ offset: 10 }).setHTML(`
            <div style="font-size:12px;">
              <strong>${cp.name}</strong>
            </div>
          `)
        )
        .addTo(map);

      stationMarkersRef.current.push(marker);
    });
  }, [chargingPoints]);

  // ---------------------------------------------------------
  // FOCUS USER (Sidebar Click → FlyTo Smoothly)
  // ---------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusUser) return;

    const u = usersMap[focusUser];
    if (!u) return;

    const lat = Number(u.lat);
    const lng = Number(u.lng);

    if (isNaN(lat) || isNaN(lng)) return;

    // Delay flyTo to avoid clipping during sidebar reflow
    setTimeout(() => {
      map.flyTo({
        center: [lng, lat],
        zoom: 17,
        speed: 1.6,
        curve: 1.2,
        essential: true,
      });
    }, 50);
  }, [focusUser]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
