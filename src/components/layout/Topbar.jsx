import { useAuthStore } from "../../store/authStore";
import { Bell, ShieldCheck, Menu } from "lucide-react";

export default function Topbar() {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="h-20 border-b border-slate-800/60 bg-slate-950 flex items-center justify-between px-8 z-10">
      {/* Left side spacer (Search removed) */}
      <div className="flex items-center gap-4 text-slate-400">
        {/* Optional: Add a breadcrumb or title here if desired in future */}
        <span className="text-xs font-medium tracking-widest uppercase text-slate-500">
          System Status: <span className="text-emerald-400">Online</span>
        </span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-6">
        <button className="group p-2 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded-full transition-all relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-sky-500 rounded-full border-2 border-slate-950 shadow-[0_0_8px_rgba(14,165,233,0.6)]"></span>
        </button>

        <div className="h-8 w-px bg-slate-800"></div>

        <div className="flex items-center gap-4 pl-2">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-slate-100">
              {user?.email}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1.5 uppercase tracking-wider font-medium">
              <ShieldCheck className="w-3 h-3 text-sky-500" />
              {user?.role}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 p-[2px] shadow-lg shadow-sky-900/20">
            <div className="w-full h-full rounded-full bg-slate-900 border-2 border-transparent flex items-center justify-center text-xs font-bold text-sky-400">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
