import { AlertTriangle, ArrowRight, Play } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────
   Diagnosis tab content — the 5-stage Disease Progression strip, the
   stage description card, the 8-tile Treatment Options grid, and the
   primary "Show Treatment Simulation" CTA. Designed to drop into the
   existing simulation page's right-side panel as a new tab body, so
   the original LumeDental layout stays clean and uncluttered.

   Owns no state — all selections bubble up.
─────────────────────────────────────────────────────────────────────── */

const PROGRESSION = [
  { id: 'enamel',    label: 'Enamel\nDecay',         desc: 'Initial decay confined to enamel. No symptoms. Early treatment can prevent further progression.' },
  { id: 'dentin',    label: 'Dentin\nInvolvement',   desc: 'Decay reaches the softer dentin. Mild sensitivity to cold and sweet may appear.' },
  { id: 'pulp',      label: 'Pulp\nExposure',        desc: 'Bacteria reach the pulp chamber. Severe pain. Endodontic treatment becomes necessary.' },
  { id: 'periapex',  label: 'Periapical\nInfection', desc: 'Infection breaches the apex. Bone destruction begins around the root tip. Abscess may form.' },
  { id: 'loss',      label: 'Tooth\nLoss',           desc: 'Without treatment, the tooth becomes non-restorable and is lost — extraction or implant follows.' },
];

const TREATMENT_OPTIONS = [
  { id: 'filling',     label: 'Filling' },
  { id: 'inlay',       label: 'Inlay / Onlay' },
  { id: 'crown',       label: 'Crown' },
  { id: 'rct',         label: 'Root Canal' },
  { id: 'extraction',  label: 'Extraction' },
  { id: 'implant',     label: 'Implant' },
  { id: 'veneer',      label: 'Veneer' },
  { id: 'no_treatment',label: 'No Treatment', danger: true },
];

export default function DiagnosisTabContent({
  stageId = 'enamel',
  onStageChange,
  treatmentId = 'rct',
  onTreatmentChange,
  onShowSimulation,
}) {
  const currentStage = PROGRESSION.find((s) => s.id === stageId) || PROGRESSION[0];
  const currentStageIndex = PROGRESSION.findIndex((s) => s.id === stageId);

  return (
    <div className="p-3 space-y-3">
      {/* Disease Progression */}
      <div>
        <div className="text-[11px] text-gray-600 uppercase tracking-wider mb-2 font-semibold">
          Disease Progression
        </div>
        <div className="grid grid-cols-5 gap-1">
          {PROGRESSION.map((s, i) => {
            const active = s.id === stageId;
            return (
              <button
                key={s.id}
                onClick={() => onStageChange?.(s.id)}
                className={`relative rounded-md p-1.5 transition border ${
                  active
                    ? 'bg-teal-500/10 border-teal-400/40 shadow-[0_0_10px_rgba(20,184,166,0.15)]'
                    : 'bg-surface-2 border-white/5 hover:border-white/10'
                }`}
              >
                <ToothStageIcon stage={i} active={active} className="w-full h-9 mb-1" />
                <div className={`text-[8.5px] leading-tight font-medium whitespace-pre-line ${
                  active ? 'text-teal-200' : 'text-gray-400'
                }`}>
                  {`${i + 1}. ${s.label}`}
                </div>
                {i < PROGRESSION.length - 1 && (
                  <ArrowRight size={9} className="absolute -right-1 top-1/2 -translate-y-1/2 text-gray-700 z-10" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stage description card */}
      <div className="bg-surface-2 border border-white/5 rounded-md p-3">
        <div className="text-[11px] font-semibold text-white mb-1">
          Stage {currentStageIndex + 1}: {currentStage.label.replace('\n', ' ')}
        </div>
        <div className="text-[10.5px] text-gray-400 leading-relaxed">
          {currentStage.desc}
        </div>
      </div>

      {/* Treatment Options */}
      <div>
        <div className="text-[11px] text-gray-600 uppercase tracking-wider mb-2 font-semibold">
          Treatment Options
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {TREATMENT_OPTIONS.map((opt) => {
            const active = opt.id === treatmentId;
            return (
              <button
                key={opt.id}
                onClick={() => onTreatmentChange?.(opt.id)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-md border transition ${
                  active
                    ? 'bg-teal-500/10 border-teal-400/40'
                    : opt.danger
                      ? 'bg-surface-2 border-red-500/15 hover:border-red-500/30'
                      : 'bg-surface-2 border-white/5 hover:border-white/15'
                }`}
              >
                <TreatmentIcon
                  id={opt.id}
                  active={active}
                  danger={opt.danger}
                />
                <span className={`text-[9px] font-medium leading-tight text-center ${
                  active
                    ? 'text-teal-200'
                    : opt.danger
                      ? 'text-red-400'
                      : 'text-gray-300'
                }`}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onShowSimulation}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-teal-500 hover:bg-teal-400 text-black font-semibold text-xs transition"
      >
        Show Treatment Simulation
        <ArrowRight size={14} />
      </button>

      {/* Disease Progression Timeline strip */}
      <div className="bg-surface-2 border border-white/5 rounded-md p-2.5">
        <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 font-semibold">
          Progression Timeline
        </div>
        <div className="flex items-center gap-1">
          {PROGRESSION.map((s, i) => (
            <div key={s.id} className="flex-1 flex items-center">
              <button
                onClick={() => onStageChange?.(s.id)}
                className={`relative flex-1 flex flex-col items-center p-1 rounded-md border transition ${
                  s.id === stageId
                    ? 'bg-teal-500/10 border-teal-400/40'
                    : 'bg-surface-3 border-white/5'
                }`}
              >
                {i === 0 && (
                  <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-teal-500 flex items-center justify-center">
                    <Play size={6} className="text-black ml-[0.5px]" fill="currentColor" />
                  </div>
                )}
                <ToothStageIcon stage={i} active={s.id === stageId} className="w-full h-7" />
              </button>
              {i < PROGRESSION.length - 1 && (
                <ArrowRight size={9} className="text-gray-700 flex-shrink-0 mx-0.5" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Inline SVG icons ─────────────────────────────────────── */

function ToothStageIcon({ stage, active, className }) {
  const tints = ['#e8d8c2', '#d6b88e', '#a8753c', '#623724', '#3a2417'];
  const isLoss = stage === 4;
  return (
    <svg viewBox="0 0 64 72" className={className} fill="none">
      {!isLoss ? (
        <>
          <path
            d="M14 14 C 14 6, 26 4, 32 8 C 38 4, 50 6, 50 14 L 48 28 C 48 38, 44 60, 36 64 L 28 64 C 20 60, 16 38, 16 28 Z"
            fill={tints[stage]}
            stroke="rgba(0,0,0,0.4)"
            strokeWidth="0.7"
          />
          {stage > 0 && (
            <ellipse cx="32" cy="22" rx={3 + stage * 1.5} ry={2 + stage} fill={`rgba(20,8,2,${0.3 + stage * 0.18})`} />
          )}
          {stage >= 2 && (
            <circle cx="32" cy="34" r={2 + stage * 0.8} fill="rgba(190,28,28,0.42)" />
          )}
          {stage >= 3 && (
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

function TreatmentIcon({ id, active, danger }) {
  const color = active ? '#5ad9c4' : danger ? '#ef4444' : '#d1d5db';
  const stroke = 'rgba(0,0,0,0.4)';
  if (id === 'no_treatment') {
    return <AlertTriangle size={22} color={color} strokeWidth={1.8} />;
  }
  return (
    <svg viewBox="0 0 32 36" width={22} height={22} fill="none">
      {/* Base tooth silhouette */}
      <path
        d={id === 'extraction' ? '' : 'M7 7C7 3 14 2 16 4C18 2 25 3 25 7L24 14C24 19 21 31 17 33L15 33C11 31 8 19 8 14Z'}
        fill={id === 'extraction' ? 'none' : (active ? '#5ad9c4' : '#e8e0d0')}
        stroke={stroke}
        strokeWidth="0.7"
      />
      {id === 'filling' && <rect x="13" y="11" width="6" height="4" rx="1" fill={active ? '#0e8a7a' : '#9ca3af'} />}
      {id === 'inlay' && <path d="M11 11 L 21 11 L 19 15 L 13 15 Z" fill={active ? '#0e8a7a' : '#d4a878'} />}
      {id === 'crown' && (
        <path
          d="M6 8 L 10 4 L 14 7 L 16 4 L 18 7 L 22 4 L 26 8 L 24 14 L 8 14 Z"
          fill={active ? '#5ad9c4' : '#f5ecd8'}
          stroke={stroke}
          strokeWidth="0.7"
        />
      )}
      {id === 'rct' && (
        <>
          <path d="M 16 12 L 16 28" stroke={active ? '#0e8a7a' : '#c95818'} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="16" cy="11" r="1.5" fill="#444" />
        </>
      )}
      {id === 'extraction' && (
        <>
          <path
            d="M7 7C7 3 14 2 16 4C18 2 25 3 25 7L24 14C24 19 21 31 17 33L15 33C11 31 8 19 8 14Z"
            fill="none"
            stroke={color}
            strokeWidth="1"
            strokeDasharray="2 1.5"
          />
          <path d="M 11 11 L 21 21 M 21 11 L 11 21" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {id === 'implant' && (
        <>
          <path d="M9 5 L 23 5 L 22 11 L 10 11 Z" fill={active ? '#5ad9c4' : '#d1d5db'} />
          <rect x="14" y="11" width="4" height="4" fill={active ? '#0e8a7a' : '#9ca3af'} />
          <path d="M 13 15 L 19 15 L 18 28 L 14 28 Z" fill={active ? '#0e8a7a' : '#b0b0b0'} />
          <path
            d="M 15 17 L 17 17 M 15 19 L 17 19 M 15 21 L 17 21 M 15 23 L 17 23 M 15 25 L 17 25"
            stroke="#0a0a0a"
            strokeWidth="0.5"
          />
        </>
      )}
      {id === 'veneer' && (
        <path
          d="M9 8 C 9 5 15 4 16 6 C 17 4 23 5 23 8 L 22 16 L 10 16 Z"
          fill={active ? '#5ad9c4' : '#fefdfb'}
          stroke={stroke}
          strokeWidth="0.5"
        />
      )}
    </svg>
  );
}
