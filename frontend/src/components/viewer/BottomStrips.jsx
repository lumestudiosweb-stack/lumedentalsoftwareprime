import { Play, ArrowRight } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────
   Bottom strips below the 3D viewer — Disease Progression Timeline +
   Treatment Simulation thumbnails. Each thumbnail is a tiny inline SVG
   tooth illustration matching the stage / treatment step.

   Pure presentational; clicks bubble up to set the active phase on the
   existing popup simulation system.
─────────────────────────────────────────────────────────────────────── */

const DISEASE_STEPS = [
  { id: 'enamel',   label: '1. Enamel Decay' },
  { id: 'dentin',   label: '2. Dentin Involvement' },
  { id: 'pulp',     label: '3. Pulp Exposure' },
  { id: 'periapex', label: '4. Periapical Infection' },
  { id: 'loss',     label: '5. Tooth Loss' },
];

const TREATMENT_STEPS = [
  { id: 'access',   label: '1. Access Opening' },
  { id: 'shape',    label: '2. Cleaning & Shaping' },
  { id: 'filling',  label: '3. Filling & Sealing' },
  { id: 'core',     label: '4. Post & Core' },
  { id: 'crown',    label: '5. Crown Placement' },
];

export default function BottomStrips({
  activeDiseaseStep,
  onDiseaseStepClick,
  activeTreatmentStep,
  onTreatmentStepClick,
  treatmentLabel = 'Root Canal + Crown',
}) {
  return (
    <div className="grid grid-cols-2 gap-3 px-4 pb-4">
      <Strip
        title="Disease Progression Timeline"
        steps={DISEASE_STEPS}
        activeId={activeDiseaseStep}
        onClick={onDiseaseStepClick}
        kind="disease"
      />
      <Strip
        title="Treatment Simulation"
        subtitle={`(${treatmentLabel})`}
        steps={TREATMENT_STEPS}
        activeId={activeTreatmentStep}
        onClick={onTreatmentStepClick}
        kind="treatment"
      />
    </div>
  );
}

function Strip({ title, subtitle, steps, activeId, onClick, kind }) {
  return (
    <div className="bg-surface-1 border border-white/5 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[12px] font-semibold text-white">{title}</span>
        {subtitle && (
          <span className="text-[11px] text-gray-500">{subtitle}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => {
          const active = activeId === s.id;
          return (
            <div key={s.id} className="flex-1 flex items-center">
              <button
                onClick={() => onClick?.(s.id)}
                className={`relative flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border transition ${
                  active
                    ? 'bg-teal-500/10 border-teal-400/40 shadow-[0_0_12px_rgba(20,184,166,0.25)]'
                    : 'bg-surface-2 border-white/5 hover:border-white/10'
                }`}
              >
                {/* First step gets a play badge */}
                {i === 0 && (
                  <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-teal-500 flex items-center justify-center">
                    <Play size={8} className="text-black ml-[1px]" fill="currentColor" />
                  </div>
                )}
                <StepIcon kind={kind} step={i} active={active} />
                <span className={`text-[9px] leading-tight text-center ${
                  active ? 'text-teal-200' : 'text-gray-400'
                }`}>
                  {s.label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <ArrowRight size={12} className="text-gray-700 flex-shrink-0 mx-0.5" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepIcon({ kind, step, active }) {
  // Disease: 5 progressively decayed teeth (tints from the panel)
  // Treatment: 5 progressively-restored teeth with instrument cues
  if (kind === 'disease') {
    const tints = ['#e8d8c2', '#d6b88e', '#a8753c', '#623724', '#3a2417'];
    const isLoss = step === 4;
    return (
      <svg viewBox="0 0 64 72" className="w-full h-12" fill="none">
        {!isLoss ? (
          <>
            <path
              d="M14 14 C 14 6, 26 4, 32 8 C 38 4, 50 6, 50 14 L 48 28 C 48 38, 44 60, 36 64 L 28 64 C 20 60, 16 38, 16 28 Z"
              fill={tints[step]}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth="0.7"
            />
            {step > 0 && (
              <ellipse cx="32" cy="22" rx={3 + step * 1.6} ry={2 + step} fill={`rgba(20,8,2,${0.3 + step * 0.18})`} />
            )}
            {step >= 2 && (
              <circle cx="32" cy="34" r={2 + step * 0.9} fill="rgba(190,28,28,0.42)" />
            )}
            {step >= 3 && (
              <path d="M 30 30 L 28 50 M 34 30 L 35 50" stroke="rgba(10,4,2,0.85)" strokeWidth="0.7" fill="none" strokeLinecap="round" />
            )}
          </>
        ) : (
          <path
            d="M14 14 C 14 6, 26 4, 32 8 C 38 4, 50 6, 50 14 L 48 28 C 48 38, 44 60, 36 64 L 28 64 C 20 60, 16 38, 16 28 Z"
            fill="none"
            stroke="rgba(180,180,200,0.45)"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
        )}
      </svg>
    );
  }
  // Treatment steps
  return (
    <svg viewBox="0 0 64 72" className="w-full h-12" fill="none">
      <path
        d="M14 14 C 14 6, 26 4, 32 8 C 38 4, 50 6, 50 14 L 48 28 C 48 38, 44 60, 36 64 L 28 64 C 20 60, 16 38, 16 28 Z"
        fill={step >= 4 ? '#f5ecd8' : '#e8d8b8'}
        stroke="rgba(0,0,0,0.4)"
        strokeWidth="0.7"
      />
      {/* Access opening — step 0 */}
      {step === 0 && (
        <circle cx="32" cy="20" r="5" fill="#0a0604" />
      )}
      {/* Cleaning & shaping — step 1: file going down */}
      {step === 1 && (
        <>
          <circle cx="32" cy="20" r="3.5" fill="#0a0604" />
          <line x1="32" y1="6" x2="32" y2="40" stroke="#cccccc" strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}
      {/* Filling — step 2: orange gutta-percha cone */}
      {step === 2 && (
        <>
          <circle cx="32" cy="20" r="3.5" fill="#0a0604" />
          <path d="M 32 22 L 30 50 L 34 50 Z" fill="#c95818" />
        </>
      )}
      {/* Post & core — step 3: orange + post */}
      {step === 3 && (
        <>
          <rect x="30" y="14" width="4" height="14" fill="#d4a878" />
          <path d="M 32 22 L 30 50 L 34 50 Z" fill="#c95818" />
        </>
      )}
      {/* Crown placement — step 4: top crown cap */}
      {step === 4 && (
        <path
          d="M6 11 L 10 6 L 14 9 L 16 5 L 18 9 L 22 6 L 26 11 L 24 16 L 8 16 Z"
          fill="#fdf7e8"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth="0.7"
        />
      )}
    </svg>
  );
}
