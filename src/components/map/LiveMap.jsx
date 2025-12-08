import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { MAPBOX_TOKEN } from "../../config";

// ---------------------------------------------------------
// UPDATED COLORS (Professional Dark UI)
// ---------------------------------------------------------

// ⚡ Station Zap Icon — Soft Neon Red + Glow
const STATION_ICON_SVG = (isDestination = false) => `
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 4px ${
  isDestination ? "#FACC15" : "#FF4D4D"
});">
  <path 
    d="M22 6L10 20h9l-1 14 12-14h-9l1-14z"
    fill="none"
    stroke="${isDestination ? "#FACC15" : "#FF4D4D"}"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
`;

// 🧍 User Icon — Electric Cyan + Glow
const USER_ICON_SVG = (isSource = false) => `
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 4px ${
  isSource ? "#00FF00" : "#3BE6FF"
});">
  <g transform="translate(8, 8)"
     stroke="${isSource ? "#00FF00" : "#3BE6FF"}"
     stroke-width="3"
     stroke-linecap="round"
     stroke-linejoin="round"
     fill="none">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </g>
</svg>
`;

export default function LiveMap({
  usersMap = {},
  chargingPoints = [],
  focusUser,
  calculatedRoute, // Prop for GeoJSON route data
  sourceUser, // Prop for highlighting the source user
  destinationStation, // Prop for highlighting the destination station
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const stationMarkersRef = useRef({});

  // Default center
  const DEFAULT_CENTER = [77.04179, 28.412942];

  // ---------------------------------------------------------
  // INIT MAP
  // ---------------------------------------------------------
  useEffect(() => {
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: DEFAULT_CENTER,
      zoom: 11,
      attributionControl: false,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    return () => {
      map.remove();
    };
  }, []);

  // ---------------------------------------------------------
  // RENDER ROUTE LINE
  // ---------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Function to add source and layer once the map style is loaded
    const addRouteLayer = () => {
      if (!map.getSource("route")) {
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#3B82F6", // Tailwind blue-500
            "line-width": 5,
            "line-opacity": 0.8,
          },
        });
      }
    };

    // Ensure map is loaded before adding layers/sources
    if (map.loaded()) {
      addRouteLayer();
    } else {
      map.on("load", addRouteLayer);
    }

    // Update the route data whenever calculatedRoute changes
    const source = map.getSource("route");
    if (source) {
      if (calculatedRoute) {
        source.setData(calculatedRoute);
      } else {
        // Clear the route if null
        source.setData({ type: "FeatureCollection", features: [] });
      }
    }

    // Cleanup function for the load listener
    return () => {
      map.off("load", addRouteLayer);
    };
  }, [calculatedRoute]);

  // ---------------------------------------------------------
  // AUTO-FIT BOUNDS
  // ---------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (focusUser) return; // Skip if tracking a specific user

    const bounds = new mapboxgl.LngLatBounds();
    let shouldFit = false;

    if (calculatedRoute && sourceUser && destinationStation) {
      // If a route is calculated, focus only on the start/end points
      if (sourceUser.lat != null && sourceUser.lng != null) {
        bounds.extend([sourceUser.lng, sourceUser.lat]);
        shouldFit = true;
      }
      if (destinationStation.lat != null && destinationStation.lng != null) {
        bounds.extend([destinationStation.lng, destinationStation.lat]);
        shouldFit = true;
      }
    } else {
      // Otherwise, fit all users and stations
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
    }

    if (shouldFit && !bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: 80,
        maxZoom: 15,
        duration: 1200,
      });
    }
  }, [
    usersMap,
    chargingPoints,
    focusUser,
    calculatedRoute,
    sourceUser,
    destinationStation,
  ]);

  // ---------------------------------------------------------
  // RENDER STATION MARKERS (RED/YELLOW)
  // ---------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove all previous markers
    Object.values(stationMarkersRef.current).forEach((m) => m.remove());
    stationMarkersRef.current = {};

    if (!chargingPoints) return;

    chargingPoints.forEach((cp) => {
      if (!cp || typeof cp !== "object" || cp.lat == null || cp.lng == null)
        return;

      const isDestination =
        destinationStation && destinationStation.id === cp.id;

      const el = document.createElement("div");
      el.className = "marker-station";
      el.innerHTML = STATION_ICON_SVG(isDestination);
      el.style.width = "42px";
      el.style.height = "42px";
      el.style.cursor = "pointer";

      // Set different glow based on selection
      el.style.filter = `drop-shadow(0 0 6px ${
        isDestination ? "#FACC15" : "#FF4D4D"
      })`;

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([cp.lng, cp.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(
            `<div style="font-family: sans-serif; min-width: 140px;">
               <div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-bottom: 4px;">
                 ${cp.name || "Charging Station"} ${
              isDestination ? "(DESTINATION)" : ""
            }
               </div>
               <div style="font-size: 11px; color: #64748b; line-height: 1.4;">
                 <span style="display:inline-block; width: 6px; height: 6px; background: ${
                   isDestination ? "#FACC15" : "#FF4D4D"
                 }; border-radius: 50%; margin-right: 4px;"></span>
                 Charging Point<br/>
                 <strong style="color: #334155;">ID:</strong> ${
                   cp.id || "-"
                 }<br/>
               </div>
             </div>`
          )
        )
        .addTo(map);

      stationMarkersRef.current[cp.id] = marker;
    });
  }, [chargingPoints, destinationStation]); // Re-run when destination changes

  // ---------------------------------------------------------
  // RENDER USER MARKERS (CYAN/GREEN)
  // ---------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existing = markersRef.current;
    const updatedMarkers = {};

    Object.entries(usersMap).forEach(([id, u]) => {
      if (!u || typeof u !== "object" || u.lat == null || u.lng == null) return;

      const lngLat = [u.lng, u.lat];
      const isSource = sourceUser && sourceUser.id === id;

      if (!existing[id]) {
        // Marker needs to be created
        const el = document.createElement("div");
        el.className = "marker-user";
        el.style.width = "42px";
        el.style.height = "42px";
        el.style.cursor = "pointer";

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat(lngLat)
          .addTo(map);

        existing[id] = marker;
      }

      // Update marker content, position, and glow
      const marker = existing[id];
      const el = marker.getElement();
      el.innerHTML = USER_ICON_SVG(isSource);
      el.style.filter = `drop-shadow(0 0 6px ${
        isSource ? "#00FF00" : "#3BE6FF"
      })`;

      marker.setLngLat(lngLat).setPopup(
        new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(
          `<div style="font-family: sans-serif; min-width: 140px;">
             <div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-bottom: 4px;">
               ${u.name || "Unknown Driver"} ${isSource ? "(SOURCE)" : ""}
             </div>
             <div style="font-size: 11px; color: #64748b; line-height: 1.4;">
               <span style="display:inline-block; width: 6px; height: 6px; background: ${
                 isSource ? "#00FF00" : "#3BE6FF"
               }; border-radius: 50%; margin-right: 4px;"></span>
               Active Vehicle<br/>
               <strong style="color: #334155;">ID:</strong> ${id.slice(
                 0,
                 6
               )}...<br/>
               <div style="margin-top:4px; font-mono; font-size:10px; color: #94a3b8;">
                 ${u.lat.toFixed(4)}, ${u.lng.toFixed(4)}
               </div>
             </div>
           </div>`
        )
      );

      updatedMarkers[id] = marker;
    });

    // Clean up markers that are no longer in usersMap
    Object.keys(existing).forEach((id) => {
      if (!updatedMarkers[id]) {
        existing[id].remove();
        delete existing[id];
      }
    });

    markersRef.current = updatedMarkers;
  }, [usersMap, sourceUser]); // Re-run when source changes

  // ---------------------------------------------------------
  // FOCUS USER WHEN SELECTED
  // ---------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusUser || !usersMap) return;

    const u = usersMap[focusUser];
    if (!u || typeof u !== "object" || u.lat == null || u.lng == null) return;

    map.flyTo({
      center: [u.lng, u.lat],
      zoom: 15,
      essential: true,
    });

    if (markersRef.current[focusUser]) {
      markersRef.current[focusUser].togglePopup();
    }
  }, [focusUser, usersMap]);

  return (
    <div className="w-full h-full">
      <div
        ref={mapContainer}
        className="map-container w-full h-full rounded-2xl overflow-hidden"
      />
    </div>
  );
}
