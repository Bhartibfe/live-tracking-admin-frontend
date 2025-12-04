import { useEffect, useState } from "react";
import AdminLayout from "../components/layout/AdminLayout";
import { useAuthStore } from "../store/authStore";
import { useSocketLiveLocations } from "../hooks/useSocket";
import { fetchChargingPoints } from "../api/charging";
import { fetchAllLocations } from "../api/location";
import LiveMap from "../components/map/LiveMap";

export default function Dashboard() {
  const { usersMap } = useSocketLiveLocations();
  const [charging, setCharging] = useState([]);
  const [initialUsersMap, setInitialUsersMap] = useState({});
  const [focusUser, setFocusUser] = useState(null); 
  const user = useAuthStore((s) => s.user);

  // Load initial users + charging points
  useEffect(() => {
    (async () => {
      try {
        const locRes = await fetchAllLocations();
        const m = {};
        locRes.forEach((u) => {
          m[u.id] = {
            lat: u.lastLat,
            lng: u.lastLng,
            name: u.name
          };
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

  // Choose live WS or fallback initial locations
  const effectiveUsersMap =
    Object.keys(usersMap).length > 0 ? usersMap : initialUsersMap;

  return (
    <AdminLayout>
      <div className="flex h-full">
        {/* ============================
            MAP SECTION 
        ============================ */}
        <div className="flex-1 min-w-0">
          <LiveMap
            usersMap={effectiveUsersMap}
            chargingPoints={charging || []}
            focusUser={focusUser} // ⭐ pass selected user to map
          />
        </div>

        {/* ============================
            RIGHT SIDEBAR : USERS LIST
        ============================ */}
        <div className="w-80 border-l border-slate-800 bg-slate-950/90 backdrop-blur flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100">
              Live Users
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Viewing locations for all active users as admin.
            </p>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-2">
            {Object.entries(effectiveUsersMap).length === 0 && (
              <div className="text-xs text-slate-500">
                No users found yet. Seed DB or enable AUTO_MOVE/SPOOF.
              </div>
            )}

            {Object.entries(effectiveUsersMap).map(([id, u]) => {
              const isSelected = id === focusUser;

              return (
                <div
                  key={id}
                  onClick={() => setFocusUser(id)} 
                  className={`border rounded-lg p-3 text-xs cursor-pointer transition
                    ${
                      isSelected
                        ? "border-sky-500 bg-sky-500/10"
                        : "border-slate-800 hover:border-sky-500"
                    }
                  `}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-100">
                      {u.name || "User"}
                    </span>

                    <span
                      className={`px-2 py-0.5 text-[10px] rounded-full border
                      ${
                        isSelected
                          ? "bg-sky-500/30 text-sky-300 border-sky-500/50"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      }`}
                    >
                      Live
                    </span>
                  </div>

                  <div className="mt-1 text-slate-400 break-all">
                    <span className="text-slate-500">ID:</span> {id}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <div>
                      <span className="text-slate-500 block">Lat</span>
                      <span className="font-mono">
                        {u.lat != null ? u.lat.toFixed(5) : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Lng</span>
                      <span className="font-mono">
                        {u.lng != null ? u.lng.toFixed(5) : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500">
            Logged in as <span className="text-slate-200">{user?.email}</span>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
