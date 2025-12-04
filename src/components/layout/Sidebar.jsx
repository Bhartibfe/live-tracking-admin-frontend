import { NavLink } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function Sidebar() {
  const logout = useAuthStore((s) => s.logout);

  const linkClasses = ({ isActive }) =>
    "block px-4 py-2 rounded-lg text-sm font-medium transition " +
    (isActive
      ? "bg-sky-500 text-white"
      : "text-slate-300 hover:bg-slate-800 hover:text-white");

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <h1 className="text-xl font-semibold text-white">
          Live Tracking Admin
        </h1>
        <p className="text-xs text-slate-400 mt-1">Gurugram · Sector 69</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <NavLink to="/dashboard" className={linkClasses}>
          Dashboard
        </NavLink>
        <NavLink to="/users" className={linkClasses}>
          Users
        </NavLink>
        <NavLink to="/charging" className={linkClasses}>
          Charging Points
        </NavLink>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={logout}
          className="w-full py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
