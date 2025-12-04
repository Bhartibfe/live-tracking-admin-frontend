import { useAuthStore } from "../../store/authStore";

export default function Topbar() {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-4">
      <h2 className="text-sm font-semibold text-slate-200">
        Real-time Fleet Dashboard
      </h2>
      <div className="flex items-center gap-3 text-xs text-slate-300">
        <span className="px-2 py-1 rounded-full bg-slate-800 border border-slate-700">
          Role: <span className="font-semibold">{user?.role}</span>
        </span>
        <span className="text-slate-400">{user?.email}</span>
      </div>
    </header>
  );
}
