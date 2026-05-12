import { Search, UploadCloud, Plus, Bell, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../contexts/authStore';

/* ──────────────────────────────────────────────────────────────────────
   Top header bar across the case workspace — search field + Import
   Scan + New Case + notifications + user profile. Matches the
   Dentaverse reference. Pure presentational; actions bubble up.
─────────────────────────────────────────────────────────────────────── */

export default function CaseTopBar({ onImportScan, onNewCase }) {
  const user = useAuthStore((s) => s.user);
  const initial = (user?.first_name?.[0] || 'D').toUpperCase();

  return (
    <header className="h-16 bg-surface-1 border-b border-white/5 px-5 flex items-center gap-4">
      {/* Search */}
      <div className="flex-1 max-w-xl relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search Patients or Cases"
          className="w-full bg-surface-2 border border-white/5 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-teal-400/30 focus:ring-1 focus:ring-teal-400/20"
        />
      </div>

      {/* Actions */}
      <button
        onClick={onImportScan}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-lume-500 hover:bg-lume-400 text-white text-sm font-semibold transition shadow-[0_4px_14px_rgba(12,140,233,0.25)]"
      >
        <UploadCloud size={15} />
        Import Scan
      </button>
      <button
        onClick={onNewCase}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-black text-sm font-semibold transition shadow-[0_4px_14px_rgba(20,184,166,0.30)]"
      >
        <Plus size={15} strokeWidth={2.5} />
        New Case
      </button>

      {/* Notifications */}
      <button
        className="relative w-10 h-10 rounded-lg border border-white/8 bg-surface-2 hover:bg-surface-3 flex items-center justify-center text-gray-400 hover:text-white transition"
        aria-label="Notifications"
      >
        <Bell size={16} />
        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-teal-400" />
      </button>

      {/* User */}
      <div className="flex items-center gap-2.5 pl-3 border-l border-white/8">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-lume-500 flex items-center justify-center text-sm font-bold text-black">
          {initial}
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">
            Dr. {user?.first_name || 'Demo'} {user?.last_name || 'User'}
          </div>
          <div className="text-[10px] text-gray-500 capitalize">{user?.role || 'Dentist'}</div>
        </div>
        <ChevronDown size={14} className="text-gray-500" />
      </div>
    </header>
  );
}
