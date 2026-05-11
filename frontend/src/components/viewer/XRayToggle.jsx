import { ScanLine } from 'lucide-react';

/**
 * XRayToggle — minimalist toggle for X-Ray vision on the 3D scan view.
 * Styled to match the existing LumeDental dark UI (matches the Clinical
 * Tools tab buttons and the Treatment Plan Entry chip).
 *
 * Pure presentational — owned state lives in the parent (SimulationView).
 */
export default function XRayToggle({ active, onToggle, disabled }) {
  return (
    <div className="bg-surface-2 border border-white/5 rounded-lg p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ScanLine
            size={14}
            className={active ? 'text-cyan-300' : 'text-gray-500'}
          />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-white tracking-tight">
              X-Ray Vision
            </div>
            <div className="text-[10px] text-gray-500 leading-tight mt-0.5">
              {active
                ? 'Bone & overlapping teeth visible through scan'
                : 'See through the scan to underlying pathology'}
            </div>
          </div>
        </div>
        <button
          onClick={onToggle}
          disabled={disabled}
          aria-pressed={active}
          aria-label={active ? 'Turn X-Ray vision off' : 'Turn X-Ray vision on'}
          title={active ? 'Turn off X-Ray view' : 'Turn on X-Ray view'}
          className={`
            flex-shrink-0 px-3 py-1.5 text-[10px] font-semibold rounded-md border transition
            ${active
              ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}
            ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {active ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}
