import { useEffect, useState, useMemo, useRef } from "react"; // 👈 Added useRef
import AdminLayout from "../components/layout/AdminLayout";
import { useSocketLiveLocations } from "../hooks/useSocket";
import { fetchChargingPoints } from "../api/charging";
import { fetchAllLocations } from "../api/location";
import LiveMap from "../components/map/LiveMap";
import { Car, Zap, Locate, MapPinned, Route, Loader2 } from "lucide-react";
import { MAPBOX_TOKEN } from "../config";

export default function Dashboard() {
  const { usersMap: liveUsersMap } = useSocketLiveLocations();
  const [charging, setCharging] = useState([]);
  const [initialUsersMap, setInitialUsersMap] = useState({});
  const [focusUser, setFocusUser] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [sourceUserId, setSourceUserId] = useState("");
  const [destinationStationId, setDestinationStationId] = useState("");
  const [calculatedRoute, setCalculatedRoute] = useState(null);
  const routeTimeoutRef = useRef(null);
  const [visibleUserId, setVisibleUserId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const locRes = await fetchAllLocations();
        const m = {};
        locRes.forEach((u) => {
          m[u.id] = { lat: u.lastLat, lng: u.lastLng, name: u.name };
        });
        setInitialUsersMap(m);
      } catch (e) {
        console.error("fetchAllLocations error", e);
      }
      try {
        const cp = await fetchChargingPoints();
        setCharging(cp || []);
      } catch (e) {
        console.error("fetchChargingPoints error", e);
      }
    })();
  }, []);

  const effectiveUsersMap =
    Object.keys(liveUsersMap).length > 0 ? liveUsersMap : initialUsersMap;

  // Find the selected source and destination objects
  const sourceUser = useMemo(() => {
    const user = effectiveUsersMap[sourceUserId] || null;
    return user ? { ...user, id: sourceUserId } : null;
  }, [sourceUserId, effectiveUsersMap]);

  const destinationStation = useMemo(() => {
    const stationId = destinationStationId
      ? Number(destinationStationId)
      : null;
    return charging.find((c) => c.id === stationId) || null;
  }, [destinationStationId, charging]);

  // Function to perform the actual route calculation API call
  const calculateOptimalRoute = async () => {
    setCalculatedRoute(null);

    if (!sourceUser || !destinationStation) {
      console.error(
        "Please select both a Source Vehicle and a Destination Station."
      );
      return;
    }

    setIsCalculating(true);

    try {
      const origin = `${sourceUser.lng},${sourceUser.lat}`;
      const destination = `${destinationStation.lng},${destinationStation.lat}`;

      const routeUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin};${destination}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;

      const response = await fetch(routeUrl);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const routeGeometry = data.routes[0].geometry;
        const routeGeoJSON = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: routeGeometry,
            },
          ],
        };

        setCalculatedRoute(routeGeoJSON);
        console.log("🔵 routeGeometry:", routeGeometry);
        console.log("🔵 routeGeoJSON:", routeGeoJSON);
      } else {
        console.error("No routes found between the selected points.", data);
        setCalculatedRoute(null);
      }
    } catch (error) {
      console.error("Error fetching route from Mapbox API:", error);
      setCalculatedRoute(null);
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    if (
      sourceUserId &&
      destinationStationId &&
      sourceUser &&
      destinationStation
    ) {
      // Only set timeout if no recent timeout exists OR it's been cleared
      if (!routeTimeoutRef.current) {
        console.log("🔄 Setting 5s timeout (first time or cleared)");

        routeTimeoutRef.current = setTimeout(() => {
          console.log("✅ 5s FIRED - recalculating route!");
          calculateOptimalRoute();
          routeTimeoutRef.current = null;
        }, 1000);
      }
    }

    return () => {
      // Don't clear during position updates - only on unmount
      if (!sourceUser?.lat && !sourceUser?.lng) {
        if (routeTimeoutRef.current) {
          clearTimeout(routeTimeoutRef.current);
          routeTimeoutRef.current = null;
        }
      }
    };
  }, [sourceUser?.lat, sourceUser?.lng]);

  return (
    <AdminLayout>
      {/* Your existing JSX remains exactly the same */}
      <div className="grid gap-6 h-[calc(100vh-8rem)] grid-cols-1 xl:grid-cols-[1fr,320px]">
        {/* LEFT: Map + Route Planner */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden relative shadow-2xl flex flex-col">
          {/* Top Route Planning Bar (Google Maps style) */}
          <div className="absolute top-0 left-0 right-0 z-10 p-5">
            <div className="bg-slate-950/90 backdrop-blur-md rounded-2xl p-4 flex flex-col gap-3 border border-slate-700/50 shadow-xl">
              <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                <Route className="w-4 h-4" /> Optimal Route Planner
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                {/* User Selector */}
                <div className="flex-1 flex items-center gap-2 bg-slate-800/50 p-2 rounded-xl border border-slate-700">
                  <Locate className="w-5 h-5 text-sky-300" />
                  <select
                    value={sourceUserId}
                    onChange={(e) => {
                      const id = e.target.value;

                      if (id === sourceUserId) {
                        // 👈 Same user selected again → unselect
                        setSourceUserId("");
                        setVisibleUserId(null);
                        setFocusUser(null); // ensure popup stays closed
                      } else {
                        // 👈 New selection
                        setSourceUserId(id);
                        setVisibleUserId(id);

                        // Center map WITHOUT opening popup
                        setFocusUser("CENTER_" + id);
                      }
                    }}
                    className="w-full bg-transparent text-sm text-slate-200 focus:ring-0 focus:outline-none"
                  >
                    <option value="" className="bg-slate-900 text-slate-500">
                      Select Source Vehicle (User)
                    </option>
                    {Object.entries(effectiveUsersMap).map(([id, u]) => (
                      <option key={id} value={id} className="bg-slate-900">
                        {u.name || `User ID: ${id.slice(0, 6)}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Charging Station Selector */}
                <div className="flex-1 flex items-center gap-2 bg-slate-800/50 p-2 rounded-xl border border-slate-700">
                  <Zap className="w-5 h-5 text-amber-300" />
                  <select
                    value={destinationStationId}
                    onChange={(e) =>
                      setDestinationStationId(Number(e.target.value))
                    }
                    className="w-full bg-transparent text-sm text-slate-200 focus:ring-0 focus:outline-none"
                  >
                    <option value="">Select Destination Station</option>
                    {charging.map((station) => (
                      <option key={station.id} value={station.id}>
                        {station.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Calculate Button */}
                <button
                  onClick={calculateOptimalRoute}
                  disabled={isCalculating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-sky-500 text-white text-sm font-medium hover:from-blue-600 hover:to-sky-600 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
                >
                  <Route className="w-4 h-4" />
                  Calculate Path
                </button>
              </div>
            </div>
          </div>

          {/* Floating stats card - kept lower */}
          <div className="absolute bottom-5 left-5 z-10 bg-slate-950/80 backdrop-blur-md rounded-2xl p-1.5 flex gap-1 border border-slate-700/50 shadow-xl">
            <div className="px-5 py-3 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col justify-center min-w-[100px]">
              <div className="flex items-center gap-2 mb-1">
                <Car className="w-3.5 h-3.5 text-sky-400" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Vehicles
                </p>
              </div>
              <p className="text-2xl font-bold text-white">
                {Object.keys(effectiveUsersMap).length}
              </p>
            </div>
            <div className="px-5 py-3 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col justify-center min-w-[100px]">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Stations
                </p>
              </div>
              <p className="text-2xl font-bold text-white">{charging.length}</p>
            </div>
          </div>

          {/* Map Component */}
          <div className="w-full h-full pt-[130px] sm:pt-[135px]">
            <LiveMap
              usersMap={
                visibleUserId
                  ? { [visibleUserId]: effectiveUsersMap[visibleUserId] } // show only one user
                  : effectiveUsersMap // show all
              }
              chargingPoints={charging}
              focusUser={focusUser}
              calculatedRoute={calculatedRoute}
              sourceUser={sourceUser}
              destinationStation={destinationStation}
            />
          </div>
        </div>

        {/* RIGHT: Live fleet list - unchanged */}
        <aside className="bg-slate-900 border border-slate-800 rounded-3xl flex flex-col overflow-hidden shadow-xl">
          <header className="p-5 border-b border-slate-800 bg-slate-900/50">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold tracking-wide text-white">
                LIVE FLEET
              </h2>
              <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-semibold text-emerald-400">
                  LIVE
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Click a vehicle to track or set as route source.
            </p>
          </header>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {Object.entries(effectiveUsersMap).length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                <Car className="w-8 h-8 mb-2" />
                <p className="text-xs">No active vehicles</p>
              </div>
            )}

            {Object.entries(effectiveUsersMap).map(([id, u]) => {
              const isTracking = id === focusUser;
              const isSource = id === sourceUserId;

              return (
                <button
                  key={id}
                  onClick={() => {
                    if (visibleUserId === id) {
                      setVisibleUserId(null);
                      setSourceUserId("");
                      setFocusUser(null); // hides info box if open
                    } else {
                      setVisibleUserId(id);
                      setSourceUserId(id);
                      setFocusUser("CENTER_" + id);
                    }
                  }}
                  className={`w-full text-left relative p-4 rounded-2xl cursor-pointer transition-all duration-300 border group
                    ${
                      isTracking
                        ? "bg-sky-500/10 border-sky-500/40 shadow-[0_0_15px_-5px_rgba(14,165,233,0.3)]"
                        : "bg-slate-950/40 border-slate-800/60 hover:bg-slate-800 hover:border-slate-700"
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-sm font-semibold transition-colors ${
                        isTracking ? "text-sky-300" : "text-slate-200"
                      }`}
                    >
                      {u.name || "Unknown Driver"}
                    </span>
                    <div className="flex items-center gap-2">
                      {isSource && (
                        <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider bg-sky-950/50 px-2 py-0.5 rounded-full border border-sky-500/50">
                          SOURCE
                        </span>
                      )}
                      {isTracking && (
                        <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                          Tracking
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-mono text-slate-500 group-hover:text-slate-400">
                      ID: {id.slice(0, 6)}
                    </p>
                    <div className="flex gap-2 text-[10px] font-mono text-slate-500">
                      <span className="bg-slate-950 px-1.5 py-0.5 rounded text-slate-400">
                        Lat: {u.lat?.toFixed(3)}
                      </span>
                      <span className="bg-slate-950 px-1.5 py-0.5 rounded text-slate-400">
                        Lng: {u.lng?.toFixed(3)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </AdminLayout>
  );
}
