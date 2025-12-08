import { NavLink } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { LayoutDashboard, Users, Zap, LogOut, MapPin } from "lucide-react";

export default function Sidebar() {
  const logout = useAuthStore((s) => s.logout);

  const navItemClass = ({ isActive }) =>
    `group flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-300 border ${
      isActive
        ? "bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-[0_0_20px_-5px_rgba(14,165,233,0.3)]"
        : "text-slate-400 border-transparent hover:bg-slate-800/50 hover:text-slate-100"
    }`;

  return (
    <aside className="w-72 bg-slate-950 border-r border-slate-800/60 flex flex-col z-20 shadow-2xl">
      {/* Brand Header */}
      <div className="p-6 pb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight leading-none">
              Fleet<span className="text-sky-400">Track</span>
            </h1>
            <p className="text-[10px] text-sky-500/60 font-medium tracking-wider uppercase mt-1">
              Admin Console
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
        <div className="mb-4 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Main Menu
        </div>

        <NavLink to="/dashboard" className={navItemClass}>
          <LayoutDashboard className="w-4 h-4" />
          Live Dashboard
        </NavLink>
        <NavLink to="/users" className={navItemClass}>
          <Users className="w-4 h-4" />
          User Directory
        </NavLink>
        <NavLink to="/charging" className={navItemClass}>
          <Zap className="w-4 h-4" />
          Charging Stations
        </NavLink>
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-slate-800/60 bg-slate-950">
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium text-slate-400 hover:text-white bg-slate-900 hover:bg-red-500/10 hover:border-red-500/20 border border-slate-800 rounded-xl transition-all duration-300 group"
        >
          <LogOut className="w-4 h-4 group-hover:text-red-400 transition-colors" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
