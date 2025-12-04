import { useEffect, useState } from "react";
import AdminLayout from "../components/layout/AdminLayout";
import { fetchAllUsers } from "../api/users";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchAllUsers();
        setUsers(data);
      } catch (err) {
        console.error("fetchAllUsers error", err);
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
            Users Directory
          </h2>
          <p className="text-xs text-slate-500">
            All registered users with profile types & roles.
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-xs text-slate-400">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-xs text-slate-500">No users found.</div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-2">Name</th>
                  <th className="py-2 pr-2">Email</th>
                  <th className="py-2 pr-2">Role</th>
                  <th className="py-2 pr-2">Profile</th>
                  <th className="py-2 pr-2">Phone</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-slate-900 hover:bg-slate-900/50"
                  >
                    <td className="py-2 pr-2 text-slate-100">{u.name}</td>
                    <td className="py-2 pr-2 text-slate-300">{u.email}</td>
                    <td className="py-2 pr-2">
                      <span
                        className={
                          "px-2 py-0.5 rounded-full border text-[10px] " +
                          (u.role === "admin"
                            ? "border-amber-500/50 text-amber-300 bg-amber-500/10"
                            : "border-sky-500/40 text-sky-300 bg-sky-500/10")
                        }
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-slate-300">
                      {u.profileType || "-"}
                    </td>
                    <td className="py-2 pr-2 text-slate-300">
                      {u.phone || "-"}
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
