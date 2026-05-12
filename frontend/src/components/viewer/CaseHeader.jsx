import { Star, Home, Image, ScanLine, Box, StickyNote, FileText } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────
   Patient header row above the 3D viewer + tab nav for the case
   sections (Overview · Photos · X-Rays · Scans · Notes · Reports).
   Matches Dentaverse reference. Pure presentational.
─────────────────────────────────────────────────────────────────────── */

const TABS = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'photos',   label: 'Photos',   icon: Image },
  { id: 'xrays',    label: 'X-Rays',   icon: ScanLine },
  { id: 'scans',    label: 'Scans',    icon: Box },
  { id: 'notes',    label: 'Notes',    icon: StickyNote },
  { id: 'reports',  label: 'Reports',  icon: FileText },
];

export default function CaseHeader({
  patient,
  caseId = 'DV-5487',
  isFavorite = true,
  onToggleFavorite,
  activeTab = 'overview',
  onTabChange,
}) {
  const initials = `${(patient?.first_name?.[0] || '?')}${(patient?.last_name?.[0] || '')}`.toUpperCase();
  const ageStr = patient?.age != null ? `${patient.age} Y` : (
    patient?.date_of_birth ? `${Math.max(0, new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear())} Y` : ''
  );
  const gender = patient?.gender || 'Male';

  return (
    <div className="h-16 bg-surface-1 border-b border-white/5 flex items-center px-5 gap-4">
      {/* Patient identity */}
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-lume-500 to-teal-500 flex items-center justify-center text-base font-bold text-black flex-shrink-0">
        {initials}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-white truncate">
            {patient ? `${patient.first_name || ''} ${patient.last_name || ''}` : 'No patient selected'}
          </span>
          <button
            onClick={onToggleFavorite}
            aria-label={isFavorite ? 'Unfavorite patient' : 'Favorite patient'}
            className="text-amber-300 hover:scale-110 transition"
          >
            <Star size={15} fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={1.5} />
          </button>
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          {gender}{ageStr ? `, ${ageStr}` : ''}
          <span className="mx-1.5 text-gray-700">·</span>
          Case ID: <span className="text-gray-400">{caseId}</span>
        </div>
      </div>

      {/* Tab nav */}
      <nav className="ml-auto flex items-center gap-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange?.(id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 px-3.5 py-2 rounded-md transition ${
                active
                  ? 'text-teal-300'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.7} />
              <span className="text-[10px] font-medium">{label}</span>
              {active && (
                <span className="absolute -bottom-1 left-3 right-3 h-[2px] bg-teal-400 rounded-t" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
