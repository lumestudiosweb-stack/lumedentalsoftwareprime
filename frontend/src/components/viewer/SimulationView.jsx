import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { simulationAPI, patientAPI, scanAPI } from '../../services/mockApi';
import DentalViewer from './DentalViewer';
import XRayToggle from './XRayToggle';
import DiagnosisPanel from './DiagnosisPanel';
import BottomStrips from './BottomStrips';
import ViewerToolbar from './ViewerToolbar';
import CaseTopBar from './CaseTopBar';
import CasePatientSidebar from './CasePatientSidebar';
import CaseHeader from './CaseHeader';
import { Loader2, Maximize2, ChevronLeft, ChevronRight, Play, Pause, Image as ImageIcon, Info } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────
   Case workspace — the main 3D simulation page, restructured to the
   Dentaverse three-column layout:

     [ CaseTopBar (search + Import Scan + New Case + user)              ]
     ┌───────────────┬─────────────────────────────────────┬───────────┐
     │ Patient list  │  Case header + viewer (DentalViewer) │ Diagnosis │
     │ sidebar       │  ViewerToolbar overlaid              │ Panel     │
     │               │  Tooth-row + 3D toggle               │           │
     ├───────────────┴─────────────────────────────────────┴───────────┤
     │ Bottom strips: Disease Progression + Treatment Simulation       │
     └─────────────────────────────────────────────────────────────────┘

   Existing functionality preserved verbatim:
     • Three.js mesh loading (STL/PLY/OBJ)
     • JPEG texture drop-to-apply
     • X-Ray toggle hook
     • Auto-play + timeline scrubber
     • Tooth picker + pathology picker still available via the right
       panel's stage / treatment selection
─────────────────────────────────────────────────────────────────────── */

// Mapping between the right-panel stage IDs (visual) and the engine's
// clinical-pathology depth / kind values (drives the existing DentalViewer
// decals and the ToothProgressionPopup).
const STAGE_TO_PATHOLOGY = {
  enamel:   { kind: 'caries', depth: 'enamel' },
  dentin:   { kind: 'caries', depth: 'dentin' },
  pulp:     { kind: 'caries', depth: 'pulp_exposure' },
  periapex: { kind: 'caries', depth: 'pulp_exposure' },
  loss:     { kind: 'extraction' },
};
const TREATMENT_TO_PATHOLOGY = {
  filling:    { kind: 'composite_filling',  depth: 'dentin' },
  inlay:      { kind: 'inlay',              depth: 'dentin' },
  crown:      { kind: 'all_ceramic_crown' },
  rct:        { kind: 'rct',                depth: 'pulp_exposure' },
  extraction: { kind: 'extraction' },
  implant:    { kind: 'all_ceramic_crown' },     // implant crown looks similar
  veneer:     { kind: 'veneer',             depth: 'enamel' },
  no_treatment: null,
};

const TREATMENT_LABEL = {
  filling: 'Filling',
  inlay: 'Inlay / Onlay',
  crown: 'Crown',
  rct: 'Root Canal + Crown',
  extraction: 'Extraction',
  implant: 'Implant',
  veneer: 'Veneer',
  no_treatment: 'No Treatment',
};

export default function SimulationView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [simulation, setSimulation] = useState(null);
  const [patient, setPatient] = useState(null);
  const [allPatients, setAllPatients] = useState([]);
  const [activeState, setActiveState] = useState(0);
  const [loading, setLoading] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);

  const [scanUrl, setScanUrl] = useState(null);
  const [scanFormat, setScanFormat] = useState('stl');
  const [textureUrl, setTextureUrl] = useState(null);
  const [textureName, setTextureName] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const [stageId, setStageId] = useState('enamel');
  const [treatmentId, setTreatmentId] = useState('rct');
  const [pickedTooth, setPickedTooth] = useState(null);
  const [pathology, setPathology] = useState({});
  const [xRayMode, setXRayMode] = useState(false);
  const [activeTool, setActiveTool] = useState('rotate');
  const [caseTab, setCaseTab] = useState('overview');

  const fileInputRef = useRef(null);
  const textureInputRef = useRef(null);

  // ── Data load ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await simulationAPI.get(id);
        if (cancelled) return;
        setSimulation(data);
        if (data?.patient_id) {
          const { data: p } = await patientAPI.get(data.patient_id);
          if (cancelled) return;
          setPatient(p);
          // Default the right-panel tooth to the first target tooth on the sim
          if (data.target_teeth?.length) setPickedTooth(data.target_teeth[0]);
        }
        if (data?.parent_scan_id) {
          const { data: scan } = await scanAPI.get(data.parent_scan_id);
          if (!cancelled && scan?.storage_path?.startsWith('blob:')) {
            setScanUrl(scan.storage_path);
            setScanFormat(scan.file_format || 'stl');
          }
        }
      } catch { /* tolerate missing data */ }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  // ── Patient list for sidebar ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await patientAPI.list();
        if (!cancelled) setAllPatients(Array.isArray(data) ? data : []);
      } catch { /* */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Sync the right-panel stage selection back into the existing
  //    clinical-pathology state so the DentalViewer decals + popup react ──
  useEffect(() => {
    const next = STAGE_TO_PATHOLOGY[stageId] || null;
    setPathology(next || {});
  }, [stageId]);

  // ── Direct file uploads ──
  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['stl', 'ply', 'obj'].includes(ext)) return;
    setScanUrl(URL.createObjectURL(file));
    setScanFormat(ext);
  }, []);

  const applyTextureFile = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return;
    setTextureUrl(URL.createObjectURL(file));
    setTextureName(file.name);
  }, []);
  const handleTextureUpload = useCallback((e) => {
    applyTextureFile(e.target.files?.[0]);
  }, [applyTextureFile]);

  // Window-level drag-drop for textures
  useEffect(() => {
    const onDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
    const onDragLeave = (e) => { if (e.clientX === 0 && e.clientY === 0) setDragOver(false); };
    const onDrop      = (e) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const ext = file.name.split('.').pop().toLowerCase();
      if (['jpg','jpeg','png','webp'].includes(ext)) applyTextureFile(file);
      else if (['stl','ply','obj'].includes(ext)) {
        setScanUrl(URL.createObjectURL(file));
        setScanFormat(ext);
      }
    };
    window.addEventListener('dragover',  onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop',      onDrop);
    return () => {
      window.removeEventListener('dragover',  onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop',      onDrop);
    };
  }, [applyTextureFile]);

  // ── Timeline autoplay ──
  useEffect(() => {
    if (!autoPlay || !simulation?.states?.length) return;
    const t = setInterval(() => {
      setActiveState((s) => {
        if (s >= simulation.states.length - 1) { setAutoPlay(false); return s; }
        return s + 1;
      });
    }, 3000);
    return () => clearInterval(t);
  }, [autoPlay, simulation]);

  const states = simulation?.states || [];
  const currentState = states[activeState] || null;
  const treatmentLabel = TREATMENT_LABEL[treatmentId] || 'Treatment';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-0">
        <Loader2 className="animate-spin text-teal-400" size={32} />
      </div>
    );
  }
  if (!simulation) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-0">
        <p className="text-red-400">Simulation not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Drag-drop hint overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 border-2 border-dashed border-teal-400 pointer-events-none">
          <ImageIcon size={40} className="text-teal-400 mb-3" />
          <p className="text-white font-semibold text-base">Drop colour JPEG to apply</p>
          <p className="text-gray-400 text-sm mt-1">Texture atlas from your scanner</p>
        </div>
      )}

      {/* Top header */}
      <CaseTopBar
        onImportScan={() => fileInputRef.current?.click()}
        onNewCase={() => navigate(patient ? `/patients/${patient.id}` : '/')}
      />

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept=".stl,.ply,.obj" className="hidden" onChange={handleFileUpload} />
      <input ref={textureInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleTextureUpload} />

      {/* Main 3-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: patient sidebar */}
        <CasePatientSidebar
          patients={allPatients}
          activePatientId={patient?.id}
          onPickPatient={(pid) => navigate(`/patients/${pid}`)}
        />

        {/* Center: case header + viewer */}
        <div className="flex flex-col flex-1 min-w-0">
          <CaseHeader
            patient={patient}
            caseId={`DV-${(simulation.id || '0').toString().slice(-4).toUpperCase()}`}
            isFavorite={true}
            activeTab={caseTab}
            onTabChange={setCaseTab}
          />

          {/* Viewer area */}
          <div className="flex-1 relative bg-black min-h-0">
            <DentalViewer
              simulation={simulation}
              activeStateIndex={activeState}
              scanUrl={scanUrl}
              scanFormat={scanFormat}
              textureUrl={textureUrl}
              clinicalPathology={pathology}
              pickedTooth={pickedTooth}
              xRayMode={xRayMode}
            />

            {/* Viewer left toolbar */}
            <ViewerToolbar activeTool={activeTool} onToolChange={setActiveTool} />

            {/* Top-right HUD: AI Detection + scale + info */}
            <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2 pointer-events-none">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur border border-white/8 rounded-lg px-3 py-1.5 pointer-events-auto">
                <div className="w-4 h-4 rounded bg-teal-400 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-black">AI</span>
                </div>
                <span className="text-[11px] font-medium text-gray-200">AI Detection</span>
                <button
                  onClick={() => setXRayMode((v) => !v)}
                  role="switch"
                  aria-checked={xRayMode}
                  className={`relative w-8 h-4 rounded-full transition ${xRayMode ? 'bg-teal-500' : 'bg-surface-3'}`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition ${xRayMode ? 'left-4' : 'left-0.5'}`} />
                </button>
                <Info size={11} className="text-gray-500" />
              </div>
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur border border-white/8 rounded-lg px-3 py-1.5 pointer-events-auto">
                <div className="w-4 h-4 rounded bg-surface-3 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-gray-300">T</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-gray-400 font-mono">
                  <span>0</span>
                  <span className="inline-block w-20 h-1.5 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400" />
                  <span>9</span>
                </div>
                <Info size={11} className="text-gray-500" />
              </div>
            </div>

            {/* Bottom-center tooth-row + 3D toggle + fullscreen */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-black/60 backdrop-blur border border-white/8 rounded-xl px-2 py-1.5">
              {['11','12','13','14','15','16'].map((fdi) => (
                <button
                  key={fdi}
                  onClick={() => setPickedTooth(parseInt(fdi, 10))}
                  className={`w-9 h-9 rounded-md flex items-center justify-center transition ${
                    pickedTooth === parseInt(fdi, 10)
                      ? 'bg-teal-500/20 text-teal-200 border border-teal-400/40'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <MiniTooth />
                </button>
              ))}
              <button
                onClick={() => {/* 3D already active */}}
                className="px-3 h-9 rounded-md bg-teal-500/20 border border-teal-400/40 text-teal-200 text-xs font-bold"
              >
                3D
              </button>
            </div>
            <button
              className="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-lg bg-black/60 backdrop-blur border border-white/8 text-gray-300 hover:text-white flex items-center justify-center"
              aria-label="Fullscreen"
              onClick={() => document.documentElement.requestFullscreen?.()}
            >
              <Maximize2 size={14} />
            </button>
          </div>

          {/* Timeline scrubber */}
          {states.length > 1 && (
            <div className="bg-surface-1 border-t border-white/5 px-5 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveState((s) => Math.max(0, s - 1))}
                  disabled={activeState === 0}
                  className="p-2 rounded-lg border border-white/8 disabled:opacity-20 hover:bg-white/5 text-gray-400"
                  aria-label="Previous milestone"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => { if (activeState >= states.length - 1) setActiveState(0); setAutoPlay(!autoPlay); }}
                  className={`p-2 rounded-lg border transition ${autoPlay ? 'bg-teal-500/15 border-teal-400/30 text-teal-200' : 'border-white/8 hover:bg-white/5 text-gray-400'}`}
                  aria-label={autoPlay ? 'Pause' : 'Play'}
                >
                  {autoPlay ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <div className="flex-1">
                  <input
                    type="range"
                    min={0}
                    max={states.length - 1}
                    value={activeState}
                    onChange={(e) => { setActiveState(parseInt(e.target.value, 10)); setAutoPlay(false); }}
                    className="w-full accent-teal-400"
                  />
                  <div className="flex justify-between mt-1">
                    {states.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => { setActiveState(i); setAutoPlay(false); }}
                        className={`text-[10px] px-2 py-0.5 rounded transition ${
                          i === activeState ? 'bg-teal-400 text-black font-semibold' : 'text-gray-600 hover:text-gray-300'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setActiveState((s) => Math.min(states.length - 1, s + 1))}
                  disabled={activeState === states.length - 1}
                  className="p-2 rounded-lg border border-white/8 disabled:opacity-20 hover:bg-white/5 text-gray-400"
                  aria-label="Next milestone"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: diagnosis / simulation / treatment panel */}
        <div className="w-[380px] flex-shrink-0 flex flex-col min-h-0">
          <DiagnosisPanel
            stageId={stageId}
            onStageChange={setStageId}
            treatmentId={treatmentId}
            onTreatmentChange={setTreatmentId}
            onShowSimulation={() => {
              // Apply the treatment as the active pathology — DentalViewer
              // decals + the ToothProgressionPopup react to this change.
              const next = TREATMENT_TO_PATHOLOGY[treatmentId];
              if (next) setPathology(next); else setPathology({});
            }}
          />
        </div>
      </div>

      {/* Bottom strips */}
      <div className="bg-surface-0 border-t border-white/5">
        <BottomStrips
          activeDiseaseStep={stageId}
          onDiseaseStepClick={setStageId}
          activeTreatmentStep={null}
          onTreatmentStepClick={() => {/* drives popup phase in future */}}
          treatmentLabel={treatmentLabel}
        />
      </div>
    </div>
  );
}

/* Tiny tooth icon for the bottom-center selector strip. */
function MiniTooth() {
  return (
    <svg viewBox="0 0 24 28" className="w-5 h-5">
      <path
        d="M5 6 C 5 2 10 1 12 3 C 14 1 19 2 19 6 L 18 11 C 18 17 16 24 13 26 L 11 26 C 8 24 6 17 6 11 Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}
