import { useMemo } from 'react';

/**
 * PathologyPicker — clinical lesion / restoration selector following
 * G.V. Black's classification.
 *
 * Output shape: { classification, surfaces[], depth, kind }
 *   classification: 'I'..'VI' or 'periodontal' / 'fracture' / etc.
 *   surfaces: subset of ['M','O','D','B','L','I'] (Mesial, Occlusal, Distal,
 *             Buccal, Lingual, Incisal). Only surfaces valid for the picked
 *             tooth + class are enabled.
 *   depth: 'incipient' | 'enamel' | 'dentin' | 'deep_dentin' | 'pulp_exposure'
 *   kind:  'caries' | 'composite_filling' | 'amalgam' | 'inlay' |
 *          'all_ceramic_crown' | 'pfm_crown' | 'metal_crown' |
 *          'rct' | 'extraction' | 'sealant' | 'veneer'
 *
 * The component knows which surface/class combinations are valid for the
 * tooth that's currently picked (anterior vs posterior).
 */
export default function PathologyPicker({ fdi, value, onChange }) {
  const isAnterior = useMemo(() => {
    if (!fdi) return false;
    const pos = fdi % 10;
    return pos <= 3; // 1, 2, 3 = central, lateral, canine
  }, [fdi]);

  const isPosterior = !isAnterior && fdi;

  // Black's classification options — disabled if not anatomically valid
  const classOptions = useMemo(
    () => [
      { v: 'I',   label: 'Class I',   desc: 'Pits & fissures (occlusal/lingual pits)', valid: !!fdi },
      { v: 'II',  label: 'Class II',  desc: 'Proximal of posteriors (M/D + O)', valid: isPosterior },
      { v: 'III', label: 'Class III', desc: 'Proximal of anteriors (no incisal edge)', valid: isAnterior },
      { v: 'IV',  label: 'Class IV',  desc: 'Proximal of anteriors involving incisal edge', valid: isAnterior },
      { v: 'V',   label: 'Class V',   desc: 'Cervical third (gingival)', valid: !!fdi },
      { v: 'VI',  label: 'Class VI',  desc: 'Cusp tip / incisal edge', valid: !!fdi },
    ],
    [fdi, isAnterior, isPosterior]
  );

  // Available surfaces depend on tooth + class
  const availableSurfaces = useMemo(() => {
    if (!fdi || !value?.classification) return [];
    const cls = value.classification;
    if (cls === 'I')   return isPosterior ? ['O', 'B', 'L'] : ['L'];
    if (cls === 'II')  return ['M', 'O', 'D'];
    if (cls === 'III') return ['M', 'D', 'L'];
    if (cls === 'IV')  return ['M', 'D', 'I'];
    if (cls === 'V')   return ['B', 'L'];
    if (cls === 'VI')  return isPosterior ? ['O'] : ['I'];
    return [];
  }, [fdi, value?.classification, isPosterior]);

  const depthOptions = [
    { v: 'incipient',     label: 'Incipient',     color: '#fef3c7', clinical: 'White spot lesion, enamel only' },
    { v: 'enamel',        label: 'Enamel',        color: '#fbbf24', clinical: 'Cavitated, enamel only' },
    { v: 'dentin',        label: 'Dentin',        color: '#d97706', clinical: 'Into dentin, no pulp' },
    { v: 'deep_dentin',   label: 'Deep Dentin',   color: '#b45309', clinical: 'Close to pulp, indirect pulp cap likely' },
    { v: 'pulp_exposure', label: 'Pulp Exposure', color: '#dc2626', clinical: 'Frank pulp exposure → RCT' },
  ];

  const kindOptions = [
    { group: 'Disease', items: [
      { v: 'caries',       label: 'Caries (Cavity)' },
    ]},
    { group: 'Restoration', items: [
      { v: 'composite_filling', label: 'Composite Filling' },
      { v: 'amalgam',           label: 'Amalgam Filling' },
      { v: 'inlay',             label: 'Inlay/Onlay' },
      { v: 'sealant',           label: 'Sealant' },
      { v: 'veneer',            label: 'Veneer' },
    ]},
    { group: 'Crown', items: [
      { v: 'all_ceramic_crown', label: 'All-Ceramic Crown (Zirconia/E.max)' },
      { v: 'pfm_crown',         label: 'PFM Crown' },
      { v: 'metal_crown',       label: 'Full Metal Crown' },
    ]},
    { group: 'Endo / Surgical', items: [
      { v: 'rct',         label: 'Root Canal Treatment' },
      { v: 'extraction',  label: 'Extraction' },
    ]},
  ];

  const update = (patch) => onChange({ ...value, ...patch });

  const toggleSurface = (s) => {
    const current = value?.surfaces || [];
    const next = current.includes(s) ? current.filter((x) => x !== s) : [...current, s];
    update({ surfaces: next });
  };

  if (!fdi) {
    return (
      <div className="bg-surface-1 border border-white/5 rounded-lg p-3 text-center">
        <div className="text-[11px] text-gray-600 uppercase tracking-wider">Pathology / Treatment</div>
        <div className="text-xs text-gray-500 mt-2">Pick a tooth above to begin</div>
      </div>
    );
  }

  return (
    <div className="bg-surface-1 border border-white/5 rounded-lg p-3 space-y-3">
      <h3 className="text-[11px] text-gray-500 uppercase tracking-wider">Pathology / Treatment</h3>

      {/* Black's classification */}
      <div>
        <div className="text-[10px] text-gray-600 mb-1.5">G.V. Black Classification</div>
        <div className="grid grid-cols-3 gap-1">
          {classOptions.map((c) => (
            <button
              key={c.v}
              disabled={!c.valid}
              onClick={() => update({ classification: c.v, surfaces: [] })}
              title={c.desc}
              className={`text-[10px] py-1.5 rounded border transition ${
                value?.classification === c.v
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-200'
                  : c.valid
                  ? 'border-white/10 text-gray-400 hover:bg-white/5'
                  : 'border-white/5 text-gray-700 cursor-not-allowed opacity-40'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {value?.classification && (
          <div className="text-[10px] text-gray-500 mt-1.5 italic">
            {classOptions.find((c) => c.v === value.classification)?.desc}
          </div>
        )}
      </div>

      {/* Surfaces */}
      {value?.classification && availableSurfaces.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-600 mb-1.5">Surfaces involved</div>
          <div className="flex gap-1 flex-wrap">
            {['M', 'O', 'D', 'B', 'L', 'I'].map((s) => {
              const enabled = availableSurfaces.includes(s);
              const active = (value?.surfaces || []).includes(s);
              return (
                <button
                  key={s}
                  disabled={!enabled}
                  onClick={() => toggleSurface(s)}
                  title={surfaceName(s)}
                  className={`w-9 h-9 rounded-md text-[11px] font-bold border transition ${
                    active
                      ? 'bg-amber-500/30 border-amber-400 text-amber-100'
                      : enabled
                      ? 'border-white/10 text-gray-400 hover:bg-white/5'
                      : 'border-white/5 text-gray-700 cursor-not-allowed opacity-30'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {(value?.surfaces || []).length > 0 && (
            <div className="text-[10px] text-amber-300 mt-1.5">
              Combined: {value.surfaces.join('')} — {value.surfaces.map(surfaceName).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Depth */}
      {value?.classification && (
        <div>
          <div className="text-[10px] text-gray-600 mb-1.5">Depth / Extent</div>
          <div className="grid grid-cols-5 gap-1">
            {depthOptions.map((d) => (
              <button
                key={d.v}
                onClick={() => update({ depth: d.v })}
                title={d.clinical}
                className={`text-[9px] py-1.5 rounded border transition flex flex-col items-center gap-1 ${
                  value?.depth === d.v
                    ? 'bg-white/10 border-white/30 text-white'
                    : 'border-white/10 text-gray-400 hover:bg-white/5'
                }`}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                {d.label}
              </button>
            ))}
          </div>
          {value?.depth && (
            <div className="text-[10px] text-gray-500 mt-1.5 italic">
              {depthOptions.find((d) => d.v === value.depth)?.clinical}
            </div>
          )}
        </div>
      )}

      {/* Kind (lesion or restoration) */}
      {value?.classification && (
        <div>
          <div className="text-[10px] text-gray-600 mb-1.5">Lesion or Treatment</div>
          <div className="space-y-1">
            {kindOptions.map((g) => (
              <div key={g.group}>
                <div className="text-[9px] text-gray-700 uppercase tracking-wider mb-0.5">{g.group}</div>
                <div className="grid grid-cols-2 gap-1 mb-1.5">
                  {g.items.map((k) => (
                    <button
                      key={k.v}
                      onClick={() => update({ kind: k.v })}
                      className={`text-[10px] py-1 px-1.5 rounded border transition text-left ${
                        value?.kind === k.v
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                          : 'border-white/10 text-gray-400 hover:bg-white/5'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {value?.classification && value?.kind && (
        <div className="pt-2 border-t border-white/5">
          <button
            onClick={() => onChange({})}
            className="w-full text-[10px] text-gray-500 hover:text-white py-1.5 rounded border border-white/10 hover:bg-white/5 transition"
          >
            Reset Pathology
          </button>
        </div>
      )}
    </div>
  );
}

function surfaceName(s) {
  return {
    M: 'Mesial',
    O: 'Occlusal',
    D: 'Distal',
    B: 'Buccal',
    L: 'Lingual',
    I: 'Incisal',
  }[s] || s;
}
