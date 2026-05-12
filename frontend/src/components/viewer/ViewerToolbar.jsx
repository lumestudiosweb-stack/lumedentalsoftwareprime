import { Move3d, Move, ZoomIn, Scissors, Eye, Ruler, MessageSquarePlus } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────
   Vertical toolbar overlaid on the left of the 3D viewer. Mirrors the
   Dentaverse reference: Rotate · Pan · Zoom · Section · Transparency ·
   Measure · Annotation. Pure presentational — clicks bubble to parent
   which forwards them to the existing OrbitControls / camera helpers.
─────────────────────────────────────────────────────────────────────── */

const TOOLS = [
  { id: 'rotate',       label: 'Rotate',       icon: Move3d },
  { id: 'pan',          label: 'Pan',          icon: Move },
  { id: 'zoom',         label: 'Zoom',         icon: ZoomIn },
  { id: 'section',      label: 'Section',      icon: Scissors },
  { id: 'transparency', label: 'Transparency', icon: Eye },
  { id: 'measure',      label: 'Measure',      icon: Ruler },
  { id: 'annotation',   label: 'Annotation',   icon: MessageSquarePlus },
];

export default function ViewerToolbar({ activeTool = 'rotate', onToolChange }) {
  return (
    <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5">
      {TOOLS.map(({ id, label, icon: Icon }) => {
        const active = activeTool === id;
        return (
          <button
            key={id}
            onClick={() => onToolChange?.(id)}
            title={label}
            aria-label={label}
            className={`group relative w-14 h-14 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition backdrop-blur ${
              active
                ? 'bg-teal-500/15 border-teal-400/40 text-teal-200 shadow-[0_0_14px_rgba(20,184,166,0.20)]'
                : 'bg-black/40 border-white/8 text-gray-400 hover:text-white hover:border-white/15'
            }`}
          >
            <Icon size={18} strokeWidth={active ? 2 : 1.7} />
            <span className="text-[9px] font-medium tracking-tight">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
