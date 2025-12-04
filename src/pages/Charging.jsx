import { useEffect, useState } from "react";
import AdminLayout from "../components/layout/AdminLayout";
import { fetchChargingPoints } from "../api/charging";

export default function Charging() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchChargingPoints();
        setPoints(data || []);
      } catch (err) {
        console.error("fetchChargingPoints error", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AdminLayout>
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-100">
            Charging Points
          </h2>
          <p className="text-xs text-slate-500">
            Static list of available charging stations.
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-xs text-slate-400">Loading...</div>
          ) : points.length === 0 ? (
            <div className="text-xs text-slate-500">No charging points.</div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-2">Name</th>
                  <th className="py-2 pr-2">Latitude</th>
                  <th className="py-2 pr-2">Longitude</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-900 hover:bg-slate-900/50"
                  >
                    <td className="py-2 pr-2 text-slate-100">{p.name}</td>
                    <td className="py-2 pr-2 text-slate-300">
                      {p.lat != null ? p.lat.toFixed(5) : "-"}
                    </td>
                    <td className="py-2 pr-2 text-slate-300">
                      {p.lng != null ? p.lng.toFixed(5) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
