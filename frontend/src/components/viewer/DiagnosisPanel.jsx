import { useState } from 'react';
import { Activity, Stethoscope, Wrench, FileText, AlertTriangle, ArrowRight } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────
   DiagnosisPanel — right-side workspace panel matching the
   Dentaverse layout. Has 4 tabs (Diagnosis · Simulation · Treatment ·
   Report); the Simulation tab shows a 5-stage disease progression
   strip + stage description + 8 treatment-option tiles + a primary
   "Show Treatment Simulation" CTA.

   Owns local UI state only. Pathway selection callbacks bubble up
   to the parent so the existing simulation logic stays untouched.
─────────────────────────────────────────────────────────────────────── */

const TAB_LIST = [
  { id: 'diagnosis',  label: 'Diagnosis',  icon: Stethoscope },
  { id: 'simulation', label: 'Simulation', icon: Activity },
  { id: 'treatment',  label: 'Treatment',  icon: Wrench },
  { id: 'report',     label: 'Report',     icon: FileText },
];

const PROGRESSION = [
  { id: 'enamel',    label: 'Enamel\nDecay',         desc: 'Initial decay confined to enamel. No symptoms. Early treatment can prevent further progression.' },
  { id: 'dentin',    label: 'Dentin\nInvolvement',   desc: 'Decay reaches the softer dentin. Mild sensitivity to cold and sweet may appear.' },
  { id: 'pulp',      label: 'Pulp\nExposure',        desc: 'Bacteria reach the pulp chamber. Severe pain. Endodontic treatment becomes necessary.' },
  { id: 'periapex',  label: 'Periapical\nInfection', desc: 'Infection breaches the apex. Bone destruction begins around the root tip. Abscess may form.' },
  { id: 'loss',      label: 'Tooth\nLoss',           desc: 'Without treatment, the tooth becomes non-restorable and is lost — extraction or implant follows.' },
];

const TREATMENT_OPTIONS = [
  { id: 'filling',     label: 'Filling',      icon: ToothFilling },
  { id: 'inlay',       label: 'Inlay / Onlay', icon: ToothInlay },
  { id: 'crown',       label: 'Crown',        icon: ToothCrown },
  { id: 'rct',         label: 'Root Canal',   icon: ToothRCT },
  { id: 'extraction',  label: 'Extraction',   icon: ToothExtraction },
  { id: 'implant',     label: 'Implant',      icon: ToothImplant },
  { id: 'veneer',      label: 'Veneer',       icon: ToothVeneer },
  { id: 'no_treatment',label: 'No Treatment', icon: WarningIcon, danger: true },
];

export default function DiagnosisPanel({
  stageId = 'enamel',
  onStageChange,
  treatmentId = 'rct',
  onTreatmentChange,
  onShowSimulation,
}) {
  const [tab, setTab] = useState('simulation');
  const currentStage = PROGRESSION.find((s) => s.id === stageId) || PROGRESSION[0];
  const currentStageIndex = PROGRESSION.findIndex((s) => s.id === stageId);

  return (
    <div className="flex flex-col h-full bg-surface-1 border-l border-white/5">
      {/* Tab bar */}
      <div className="flex border-b border-white/5 bg-black/30">
        {TAB_LIST.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-3 text-xs font-semibold transition relative ${
              tab === id
                ? 'text-teal-300'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
            {tab === id && (
              <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-teal-400 rounded-t" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'simulation' && (
          <div className="p-4 space-y-4">
            {/* Disease Progression header */}
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                Disease Progression
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {PROGRESSION.map((s, i) => {
                  const active = s.id === stageId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => onStageChange?.(s.id)}
                      className={`relative rounded-md p-2 transition border ${
                        active
                          ? 'bg-teal-500/10 border-teal-400/40 shadow-[0_0_14px_rgba(20,184,166,0.18)]'
                          : 'bg-surface-2 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <ToothStageIcon
                        stage={i}
                        active={active}
                        className="w-full h-12 mb-1.5"
                      />
                      <div className={`text-[9px] leading-tight font-medium whitespace-pre-line ${
                        active ? 'text-teal-200' : 'text-gray-400'
                      }`}>
                        {`${i + 1}. ${s.label}`}
                      </div>
                      {i < PROGRESSION.length - 1 && (
                        <ArrowRight
                          size={10}
                          className="absolute -right-1 top-1/2 -translate-y-1/2 text-gray-700"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stage description card */}
            <div className="bg-surface-2 border border-white/5 rounded-lg p-3.5">
              <div className="text-xs font-semibold text-white mb-1">
                Stage {currentStageIndex + 1}: {currentStage.label.replace('\n', ' ')}
              </div>
              <div className="text-[11px] text-gray-400 leading-relaxed">
                {currentStage.desc}
              </div>
            </div>

            {/* Treatment Options */}
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                Treatment Options
              </div>
              <div className="grid grid-cols-4 gap-2">
                {TREATMENT_OPTIONS.map((opt) => {
                  const active = opt.id === treatmentId;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => onTreatmentChange?.(opt.id)}
                      className={`flex flex-col items-center gap-1 py-3 rounded-lg border transition ${
                        active
                          ? 'bg-teal-500/10 border-teal-400/40 shadow-[0_0_12px_rgba(20,184,166,0.22)]'
                          : opt.danger
                            ? 'bg-surface-2 border-red-500/15 hover:border-red-500/30'
                            : 'bg-surface-2 border-white/5 hover:border-white/15'
                      }`}
                    >
                      <Icon
                        size={28}
                        className={
                          active
                            ? 'text-teal-200'
                            : opt.danger
                              ? 'text-red-400'
                              : 'text-gray-300'
                        }
                      />
                      <span className={`text-[10px] font-medium ${
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
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-teal-500 hover:bg-teal-400 text-black font-semibold text-sm transition shadow-[0_4px_20px_rgba(20,184,166,0.35)]"
            >
              Show Treatment Simulation
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {tab === 'diagnosis' && (
          <EmptyTab
            label="Diagnosis"
            text="AI-assisted diagnosis is computed from the scan + clinical metrics. Open Simulation to see the disease progression and treatment plan."
          />
        )}
        {tab === 'treatment' && (
          <EmptyTab
            label="Treatment Plan"
            text="Confirm the treatment selected in Simulation, schedule the appointment, and generate the consent form."
          />
        )}
        {tab === 'report' && (
          <EmptyTab
            label="Case Report"
            text="Generate a patient-facing PDF report including the disease progression visuals and treatment recommendation."
          />
        )}
      </div>
    </div>
  );
}

function EmptyTab({ label, text }) {
  return (
    <div className="p-6">
      <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">{label}</div>
      <div className="text-xs text-gray-400 leading-relaxed">{text}</div>
    </div>
  );
}

/* ── Inline SVG tooth icons (tiny so they ship inline) ─────── */

function ToothStageIcon({ stage, active, className }) {
  // 5 stages — progressively more discoloured/cracked/missing.
  const tints = ['#e8d8c2', '#d6b88e', '#a8753c', '#623724', '#3a2417'];
  const crackOpacity = [0, 0.3, 0.55, 0.85, 1];
  const isLoss = stage === 4;
  return (
    <svg viewBox="0 0 64 72" className={className} fill="none">
      <defs>
        <linearGradient id={`tg${stage}-${active ? 'a' : 'b'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={tints[stage]} />
          <stop offset="100%" stopColor="#5e3818" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {!isLoss ? (
        <>
          <path
            d="M14 14 C 14 6, 26 4, 32 8 C 38 4, 50 6, 50 14 L 48 28 C 48 38, 44 60, 36 64 L 28 64 C 20 60, 16 38, 16 28 Z"
            fill={`url(#tg${stage}-${active ? 'a' : 'b'})`}
            stroke="rgba(0,0,0,0.4)"
            strokeWidth="0.7"
          />
          {/* Surface cavity that grows with stage */}
          {stage > 0 && (
            <ellipse cx="32" cy="22" rx={3 + stage * 1.5} ry={2 + stage} fill={`rgba(20,8,2,${crackOpacity[stage]})`} />
          )}
          {/* Pulp glow inside crown for late stages */}
          {stage >= 2 && (
            <circle cx="32" cy="34" r={2 + stage * 0.8} fill="rgba(190,28,28,0.45)" />
          )}
          {/* Cracks down the side */}
          {stage >= 3 && (
            <path d="M 30 30 L 28 50 M 34 30 L 35 50" stroke="rgba(10,4,2,0.85)" strokeWidth="0.7" fill="none" strokeLinecap="round" />
          )}
        </>
      ) : (
        // Tooth-loss state — dashed silhouette of where tooth used to be
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

function ToothFilling({ size = 28, className }) {
  return (
    <svg viewBox="0 0 32 36" width={size} height={size} className={className} fill="none">
      <path d="M7 7C7 3 14 2 16 4C18 2 25 3 25 7L24 14C24 19 21 31 17 33L15 33C11 31 8 19 8 14Z"
        fill="#e8e0d0" stroke="currentColor" strokeOpacity="0.6" strokeWidth="0.8" />
      <rect x="13" y="11" width="6" height="4" rx="1" fill="#9ca3af" />
    </svg>
  );
}
function ToothInlay({ size = 28, className }) {
  return (
    <svg viewBox="0 0 32 36" width={size} height={size} className={className} fill="none">
      <path d="M7 7C7 3 14 2 16 4C18 2 25 3 25 7L24 14C24 19 21 31 17 33L15 33C11 31 8 19 8 14Z"
        fill="#e8e0d0" stroke="currentColor" strokeOpacity="0.6" strokeWidth="0.8" />
      <path d="M11 11 L 21 11 L 19 15 L 13 15 Z" fill="#d4a878" />
    </svg>
  );
}
function ToothCrown({ size = 28, className }) {
  return (
    <svg viewBox="0 0 32 36" width={size} height={size} className={className} fill="none">
      <path d="M6 8 L 10 4 L 14 7 L 16 4 L 18 7 L 22 4 L 26 8 L 24 14 C 24 19 21 31 17 33 L 15 33 C 11 31 8 19 8 14 Z"
        fill="#f5ecd8" stroke="currentColor" strokeOpacity="0.6" strokeWidth="0.8" />
    </svg>
  );
}
function ToothRCT({ size = 28, className }) {
  return (
    <svg viewBox="0 0 32 36" width={size} height={size} className={className} fill="none">
      <path d="M7 7C7 3 14 2 16 4C18 2 25 3 25 7L24 14C24 19 21 31 17 33L15 33C11 31 8 19 8 14Z"
        fill="#e8d8b8" stroke="currentColor" strokeOpacity="0.6" strokeWidth="0.8" />
      <path d="M 16 12 L 16 28" stroke="#c95818" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="11" r="1.5" fill="#444" />
    </svg>
  );
}
function ToothExtraction({ size = 28, className }) {
  return (
    <svg viewBox="0 0 32 36" width={size} height={size} className={className} fill="none">
      <path d="M7 7C7 3 14 2 16 4C18 2 25 3 25 7L24 14C24 19 21 31 17 33L15 33C11 31 8 19 8 14Z"
        fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="0.8" strokeDasharray="2 1.5" />
      <path d="M 11 11 L 21 21 M 21 11 L 11 21" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.8" />
    </svg>
  );
}
function ToothImplant({ size = 28, className }) {
  return (
    <svg viewBox="0 0 32 36" width={size} height={size} className={className} fill="none">
      <path d="M9 5 L 23 5 L 22 11 L 10 11 Z" fill="currentColor" fillOpacity="0.9" />
      <rect x="14" y="11" width="4" height="4" fill="currentColor" fillOpacity="0.7" />
      <path d="M 13 15 L 19 15 L 18 28 L 14 28 Z" fill="currentColor" fillOpacity="0.8" />
      <path d="M 15 17 L 17 17 M 15 19 L 17 19 M 15 21 L 17 21 M 15 23 L 17 23 M 15 25 L 17 25"
        stroke="#0a0a0a" strokeWidth="0.5" />
    </svg>
  );
}
function ToothVeneer({ size = 28, className }) {
  return (
    <svg viewBox="0 0 32 36" width={size} height={size} className={className} fill="none">
      <path d="M7 7C7 3 14 2 16 4C18 2 25 3 25 7L24 14C24 19 21 31 17 33L15 33C11 31 8 19 8 14Z"
        fill="#e8e0d0" stroke="currentColor" strokeOpacity="0.6" strokeWidth="0.8" />
      <path d="M9 8C 9 5 15 4 16 6C 17 4 23 5 23 8 L 22 16 L 10 16 Z" fill="#fefdfb" stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.5" />
    </svg>
  );
}
function WarningIcon({ size = 28, className }) {
  return (
    <AlertTriangle size={size} className={className} strokeWidth={1.8} />
  );
}
