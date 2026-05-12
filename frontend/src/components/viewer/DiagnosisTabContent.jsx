import { AlertTriangle, ArrowRight, Play } from 'lucide-react';
import {
  StageEnamelDecay, StageDentinInvolvement, StagePulpExposure,
  StagePeriapicalInfection, StageToothLoss,
  TreatmentFilling, TreatmentInlay, TreatmentCrown, TreatmentRootCanal,
  TreatmentExtraction, TreatmentImplant, TreatmentVeneer,
} from './ToothIllustrations';

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
                className={`relative rounded-md p-1 pb-1.5 transition border ${
                  active
                    ? 'bg-teal-500/10 border-teal-400/40 shadow-[0_0_10px_rgba(20,184,166,0.15)]'
                    : 'bg-surface-2 border-white/5 hover:border-white/10'
                }`}
              >
                <ToothStageIcon stage={i} size={42} />
                <div className={`text-[8.5px] leading-tight font-medium whitespace-pre-line mt-0.5 ${
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
                className={`flex flex-col items-center gap-0.5 pt-2 pb-2 px-1 rounded-md border transition ${
                  active
                    ? 'bg-teal-500/10 border-teal-400/40 shadow-[0_0_10px_rgba(20,184,166,0.18)]'
                    : opt.danger
                      ? 'bg-surface-2 border-red-500/15 hover:border-red-500/30'
                      : 'bg-surface-2 border-white/5 hover:border-white/15'
                }`}
              >
                <TreatmentIcon
                  id={opt.id}
                  danger={opt.danger}
                  size={42}
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
                <ToothStageIcon stage={i} size={26} />
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

/* ── Stage + treatment thumbnails — detailed inline-SVG illustrations
       defined in ToothIllustrations.jsx ───────────────────────────── */

const STAGE_COMPONENTS = {
  enamel:   StageEnamelDecay,
  dentin:   StageDentinInvolvement,
  pulp:     StagePulpExposure,
  periapex: StagePeriapicalInfection,
  loss:     StageToothLoss,
};
const TREATMENT_COMPONENTS = {
  filling:    TreatmentFilling,
  inlay:      TreatmentInlay,
  crown:      TreatmentCrown,
  rct:        TreatmentRootCanal,
  extraction: TreatmentExtraction,
  implant:    TreatmentImplant,
  veneer:     TreatmentVeneer,
};

function ToothStageIcon({ stage, size = 36 }) {
  const stageId = PROGRESSION[stage]?.id;
  const Comp = STAGE_COMPONENTS[stageId];
  if (!Comp) return null;
  return (
    <div className="w-full flex items-center justify-center">
      <Comp size={size} />
    </div>
  );
}

function TreatmentIcon({ id, danger, size = 38 }) {
  if (id === 'no_treatment') {
    return <AlertTriangle size={size * 0.8} className={danger ? 'text-red-400' : 'text-gray-300'} strokeWidth={1.8} />;
  }
  const Comp = TREATMENT_COMPONENTS[id];
  if (!Comp) return null;
  return <Comp size={size} />;
}
