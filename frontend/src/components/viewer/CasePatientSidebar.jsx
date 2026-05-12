import { useState, useMemo } from 'react';
import { Search, Plus, ChevronDown, ArrowRight, Database } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────
   Left patient sidebar in the case workspace. Compact patient list
   with avatar + thumbnail, filter tabs, storage indicator at the
   bottom. Matches the Dentaverse reference.

   Self-contained — receives a flat patients array + active id.
─────────────────────────────────────────────────────────────────────── */

const AVATAR_COLORS = [
  'from-sky-500 to-cyan-500',
  'from-orange-400 to-pink-500',
  'from-emerald-400 to-teal-500',
  'from-purple-500 to-indigo-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-fuchsia-500',
];
const FILTER_TABS = ['All', 'Recent', 'Favorites'];

export default function CasePatientSidebar({
  patients = [],
  activePatientId,
  onPickPatient,
  storageUsedGB = 68,
  storageTotalGB = 100,
}) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter((p) => {
      if (!q) return true;
      const name = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      return name.includes(q);
    });
  }, [patients, search]);

  const storagePct = Math.min(100, (storageUsedGB / storageTotalGB) * 100);

  return (
    <aside className="w-64 bg-surface-1 border-r border-white/5 flex flex-col">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <button className="flex items-center gap-1.5 text-sm font-semibold text-white">
          All Patients
          <ChevronDown size={14} className="text-gray-500" />
        </button>
        <button
          className="w-7 h-7 rounded-lg bg-teal-500 hover:bg-teal-400 text-black flex items-center justify-center transition"
          aria-label="Add new patient"
        >
          <Plus size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient..."
            className="w-full bg-surface-2 border border-white/5 rounded-md pl-8 pr-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-teal-400/30"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-3 pb-2 flex items-center gap-1">
        {FILTER_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`flex-1 text-[11px] py-1.5 rounded-md transition ${
              filter === t
                ? 'bg-surface-3 text-white font-semibold'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Patient list */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="space-y-1.5">
          {filtered.map((p, i) => {
            const active = p.id === activePatientId;
            const initials = `${(p.first_name?.[0] || '?')}${(p.last_name?.[0] || '')}`.toUpperCase();
            const grad = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const dateLabel = p.created_at
              ? new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              : '';
            return (
              <button
                key={p.id}
                onClick={() => onPickPatient?.(p.id)}
                className={`w-full flex items-center gap-2.5 p-2 rounded-lg border transition text-left ${
                  active
                    ? 'bg-teal-500/10 border-teal-400/30'
                    : 'border-transparent hover:bg-white/5'
                }`}
              >
                <div className={`w-9 h-9 flex-shrink-0 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-[11px] font-bold text-white`}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-semibold truncate ${active ? 'text-teal-200' : 'text-white'}`}>
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="text-[10px] text-gray-500">{dateLabel}</div>
                </div>
                <div className="w-10 h-7 flex-shrink-0 rounded-md bg-surface-3 flex items-center justify-center">
                  <MiniTeethThumb />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* View all */}
      <button className="mx-3 my-2 py-2 rounded-md bg-surface-2 hover:bg-surface-3 text-xs text-gray-300 flex items-center justify-center gap-2 transition">
        View All Patients
        <ArrowRight size={12} />
      </button>

      {/* Storage indicator */}
      <div className="mx-3 mb-3 px-3 py-2.5 rounded-lg bg-surface-2 border border-white/5">
        <div className="flex items-center gap-2 mb-1.5">
          <Database size={12} className="text-gray-500" />
          <span className="text-[11px] font-semibold text-gray-300">Storage</span>
        </div>
        <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-400 to-lume-400 rounded-full"
            style={{ width: `${storagePct}%` }}
          />
        </div>
        <div className="text-[10px] text-gray-500 mt-1.5">
          {storageUsedGB} GB / {storageTotalGB} GB
        </div>
      </div>
    </aside>
  );
}

function MiniTeethThumb() {
  return (
    <svg viewBox="0 0 36 18" className="w-full h-full">
      {/* Tiny row of stylized teeth */}
      {[3, 8, 13, 18, 23, 28].map((x, i) => (
        <ellipse
          key={i}
          cx={x}
          cy={9}
          rx={2.4}
          ry={4.5}
          fill="#e8d8c2"
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="0.3"
        />
      ))}
    </svg>
  );
}
