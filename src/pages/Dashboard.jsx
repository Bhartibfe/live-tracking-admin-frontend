import { useEffect, useState, useMemo, useRef } from "react";
import AdminLayout from "../components/layout/AdminLayout";
import { useSocketLiveLocations } from "../hooks/useSocket";
import { fetchChargingPoints } from "../api/charging";
import { fetchAllLocations } from "../api/location";
import LiveMap from "../components/map/LiveMap";
import { Car, Zap, Route, Loader2, Navigation } from "lucide-react";
import { MAPBOX_TOKEN } from "../config";

export default function Dashboard() {
  const { usersMap: liveUsersMap } = useSocketLiveLocations();
  const [charging, setCharging] = useState([]);
  const [initialUsersMap, setInitialUsersMap] = useState({});
  const [focusUser, setFocusUser] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Store user-destination pairs: { userId: stationId }
  const [userDestinations, setUserDestinations] = useState({});

  // Store calculated routes: { userId: routeGeoJSON }
  const [calculatedRoutes, setCalculatedRoutes] = useState({});

  // Last known logical positions from LiveMap
  const [logicalUsersMap, setLogicalUsersMap] = useState({});

  // Movement controls from LiveMap: { start, stop }
  const movementControlRef = useRef({ start: null, stop: null });

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

  // Users with assigned destinations
  const selectedUserIds = Object.keys(userDestinations);

  const selectedUsersWithDestinations = useMemo(() => {
    return selectedUserIds
      .map((userId) => {
        const user =
          logicalUsersMap[userId] || effectiveUsersMap[userId] || null;
        const stationId = userDestinations[userId];
        const station = charging.find((s) => s.id === stationId);
        return {
          userId,
          user,
          station,
        };
      })
      .filter((item) => item.user && item.station);
  }, [
    selectedUserIds,
    effectiveUsersMap,
    logicalUsersMap,
    userDestinations,
    charging,
  ]);

  // Receive movement controls from LiveMap
  const handleUserMovementStart = (controls) => {
    movementControlRef.current = controls; // { start, stop }
  };

  // Add user-destination pair
  const addUserDestination = (userId, stationId) => {
    setUserDestinations((prev) => ({
      ...prev,
      [userId]: stationId,
    }));
  };

  // Remove user-destination pair and stop movement immediately
  const removeUserDestination = (userId) => {
    if (movementControlRef.current.stop) {
      movementControlRef.current.stop(userId);
    }

    // Clear focus when deselecting so auto-zoom can use all users/routes
    setFocusUser(null);

    setUserDestinations((prev) => {
      const newDestinations = { ...prev };
      delete newDestinations[userId];
      return newDestinations;
    });

    setCalculatedRoutes((prev) => {
      const newRoutes = { ...prev };
      delete newRoutes[userId];
      return newRoutes;
    });
  };

  // Calculate routes for all selected users
  const calculateAllRoutes = async () => {
    if (selectedUsersWithDestinations.length === 0) {
      console.error("Please assign at least one user to a destination.");
      return;
    }

    setIsCalculating(true);
    const newRoutes = {};

    try {
      for (const { userId, user, station } of selectedUsersWithDestinations) {
        const originUser = logicalUsersMap[userId] || user;
        const origin = `${originUser.lng},${originUser.lat}`;
        const destination = `${station.lng},${station.lat}`;

        const routeUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin};${destination}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;

        const response = await fetch(routeUrl);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const routeGeometry = data.routes[0].geometry;

          newRoutes[userId] = {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: routeGeometry,
              },
            ],
            destinationStation: station,
          };

          console.log(
            `🔵 Route calculated for user ${userId} to station ${station.name}`
          );

          if (movementControlRef.current.start) {
            const routeCoordinates = routeGeometry.coordinates;
            movementControlRef.current.start(userId, routeCoordinates);
          }
        }
      }

      setCalculatedRoutes(newRoutes);
    } catch (error) {
      console.error("Error fetching routes from Mapbox API:", error);
    } finally {
      setIsCalculating(false);
    }
  };

  // Clean routes when destinations change
  useEffect(() => {
    setCalculatedRoutes((prev) => {
      const newRoutes = { ...prev };
      Object.keys(newRoutes).forEach((userId) => {
        if (!userDestinations[userId]) {
          delete newRoutes[userId];
        }
      });
      return newRoutes;
    });
  }, [userDestinations]);

  return (
    <AdminLayout>
      <div className="grid gap-6 h-[calc(100vh-8rem)] grid-cols-1 xl:grid-cols-[1fr,320px]">
        {/* LEFT: Map */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden relative shadow-2xl flex flex-col">
          {/* Calculate All Routes Button */}
          {selectedUsersWithDestinations.length > 0 && (
            <div className="absolute top-5 left-5 z-10">
              <button
                onClick={calculateAllRoutes}
                disabled={isCalculating}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-sky-500 text-white text-sm font-semibold hover:from-blue-600 hover:to-sky-600 disabled:opacity-60 disabled:cursor-not-allowed shadow-2xl border border-blue-400/30"
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4" />
                    Calculate All Routes ({selectedUsersWithDestinations.length}
                    )
                  </>
                )}
              </button>
            </div>
          )}

          {/* Floating stats card */}
          <div className="absolute bottom-5 left-5 z-10 bg-slate-950/80 backdrop-blur-md rounded-2xl p-1.5 flex gap-1 border border-slate-700/50 shadow-xl">
            <div className="px-5 py-3 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col justify-center min-w-[100px]">
              <div className="flex items-center gap-2 mb-1">
                <Route className="w-3.5 h-3.5 text-sky-400" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Active Routes
                </p>
              </div>
              <p className="text-2xl font-bold text-white">
                {selectedUsersWithDestinations.length}
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

          {/* Map */}
          <div className="w-full h-full">
            <LiveMap
              usersMap={effectiveUsersMap}
              chargingPoints={charging}
              focusUser={focusUser}
              calculatedRoutes={calculatedRoutes}
              selectedUserIds={selectedUserIds}
              onUserMovementStart={handleUserMovementStart}
              onUserPositionUpdate={setLogicalUsersMap}
            />
          </div>
        </div>

        {/* RIGHT: Live fleet list */}
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
              Assign destinations to vehicles for route planning.
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
              const hasDestination = !!userDestinations[id];
              const assignedStation = hasDestination
                ? charging.find((s) => s.id === userDestinations[id])
                : null;

              const handleCardClick = () => {
                if (hasDestination) {
                  removeUserDestination(id); // stop + clear route
                } else {
                  setFocusUser(`CENTER_${id}`);
                }
              };

              return (
                <div
                  key={id}
                  onClick={handleCardClick}
                  className={`relative p-3 rounded-2xl transition-all duration-300 border ${
                    hasDestination
                      ? "bg-sky-500/10 border-sky-500/40"
                      : "bg-slate-950/40 border-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-sm font-semibold ${
                        hasDestination ? "text-sky-300" : "text-slate-200"
                      }`}
                    >
                      {u.name || "Unknown Driver"}
                    </span>
                    {hasDestination && (
                      <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider bg-sky-950/50 px-2 py-0.5 rounded-full border border-sky-500/50">
                        ASSIGNED
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-mono text-slate-500">
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

                  {/* Destination selector */}
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={userDestinations[id] || ""}
                      onChange={(e) => {
                        const stationId = Number(e.target.value);
                        if (stationId) {
                          addUserDestination(id, stationId);
                        } else {
                          removeUserDestination(id);
                        }
                      }}
                      className="w-full bg-slate-800/80 text-xs text-slate-200 px-2 py-1.5 rounded-lg border border-slate-700 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    >
                      <option value="">Assign Destination...</option>
                      {charging.map((station) => (
                        <option key={station.id} value={station.id}>
                          ⚡ {station.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {assignedStation && (
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                      <Zap className="w-3 h-3" />
                      <span className="truncate">{assignedStation.name}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </AdminLayout>
  );
}
