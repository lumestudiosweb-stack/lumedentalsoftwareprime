import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { simulationAPI, patientAPI, scanAPI } from '../../services/mockApi';
import DentalViewer from './DentalViewer';
import ToothPicker from './ToothPicker';
import PathologyPicker from './PathologyPicker';
import ToothAnatomyPanel from './ToothAnatomyPanel';
import { ChevronLeft, ChevronRight, Loader2, ArrowLeft, Play, Pause, Upload, Image as ImageIcon, Activity, Layers } from 'lucide-react';

export default function SimulationView() {
  const { id } = useParams();
  const [simulation, setSimulation] = useState(null);
  const [patient, setPatient] = useState(null);
  const [activeState, setActiveState] = useState(0);
  const [loading, setLoading] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [scanUrl, setScanUrl] = useState(null);
  const [scanFormat, setScanFormat] = useState('stl');
  const [textureUrl, setTextureUrl] = useState(null);
  const [textureName, setTextureName] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Clinical tools side panel — dentist picks a tooth + assigns pathology
  const [sideTab, setSideTab] = useState('timeline'); // 'timeline' | 'clinical'
  const [pickedTooth, setPickedTooth] = useState(null);
  const [pathology, setPathology] = useState({});
  const fileInputRef = useRef(null);
  const textureInputRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await simulationAPI.get(id);
        setSimulation(data);
        if (data?.patient_id) {
          const { data: p } = await patientAPI.get(data.patient_id);
          setPatient(p);
        }
        // Try to load the associated scan
        if (data?.parent_scan_id) {
          const { data: scan } = await scanAPI.get(data.parent_scan_id);
          if (scan?.storage_path && scan.storage_path.startsWith('blob:')) {
            setScanUrl(scan.storage_path);
            setScanFormat(scan.file_format || 'stl');
          }
        }
      } catch {
        // handle
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Direct STL/PLY upload on the simulation page
  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['stl', 'ply', 'obj'].includes(ext)) return;
    const url = URL.createObjectURL(file);
    setScanUrl(url);
    setScanFormat(ext);
  }, []);

  const applyTextureFile = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return;
    setTextureUrl(URL.createObjectURL(file));
    setTextureName(file.name);
  }, []);

  // Color texture upload (JPEG/PNG) — wraps the mesh with realistic color
  const handleTextureUpload = useCallback((e) => {
    applyTextureFile(e.target.files?.[0]);
  }, [applyTextureFile]);

  // Window-level drag-drop for JPEG (canvas swallows pointer events)
  useEffect(() => {
    const onDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
    const onDragLeave = (e) => { if (e.clientX === 0 && e.clientY === 0) setDragOver(false); };
    const onDrop      = (e) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const ext = file.name.split('.').pop().toLowerCase();
      if (['jpg','jpeg','png','webp'].includes(ext)) {
        applyTextureFile(file);
      } else if (['stl','ply','obj'].includes(ext)) {
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

  useEffect(() => {
    if (!autoPlay || !simulation?.states?.length) return;
    const interval = setInterval(() => {
      setActiveState((s) => {
        if (s >= simulation.states.length - 1) { setAutoPlay(false); return s; }
        return s + 1;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [autoPlay, simulation]);

  const states = simulation?.states || [];
  const currentState = states[activeState] || null;

  if (loading) {
    return <div className="flex items-center justify-center h-full bg-surface-0"><Loader2 className="animate-spin text-gray-500" size={32} /></div>;
  }
  if (!simulation) {
    return <div className="flex items-center justify-center h-full bg-surface-0"><p className="text-red-400">Simulation not found</p></div>;
  }

  return (
    <div className="flex flex-col h-full bg-surface-0 relative">
      {/* Full-page drag-drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 border-2 border-dashed border-lume-400 pointer-events-none">
          <ImageIcon size={40} className="text-lume-400 mb-3" />
          <p className="text-white font-semibold text-base">Drop colour JPEG to apply</p>
          <p className="text-gray-400 text-sm mt-1">Texture atlas from your scanner</p>
        </div>
      )}
      {/* Header */}
      <div className="bg-surface-1 border-b border-white/5 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={patient ? `/patients/${patient.id}` : '/'} className="text-gray-600 hover:text-white transition">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-base font-display font-bold text-white">3D Simulation</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {simulation.clinician_prompt}
                {patient && <span className="text-gray-400 ml-2">— {patient.first_name} {patient.last_name}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Upload mesh button */}
            <input ref={fileInputRef} type="file" accept=".stl,.ply,.obj" className="hidden" onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border transition ${
                scanUrl ? 'border-green-500/20 text-green-400 bg-green-500/5' : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title="OBJ recommended for color (STL has no UVs)">
              <Upload size={12} />
              {scanUrl ? `Mesh · .${scanFormat}` : 'Load Mesh'}
            </button>
            {/* Upload color texture (JPEG/PNG) */}
            <input ref={textureInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleTextureUpload} />
            <button onClick={() => textureInputRef.current?.click()}
              className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border transition ${
                textureUrl ? 'border-green-500/20 text-green-400 bg-green-500/5' : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title="Drop JPEG anywhere or click to pick">
              <ImageIcon size={12} />
              {textureName ? `✓ ${textureName}` : 'Drop Colour JPEG'}
            </button>
            {simulation.target_teeth?.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-600">Teeth:</span>
                {simulation.target_teeth.map((t) => (
                  <span key={t} className="bg-white/10 text-white text-[11px] px-2 py-0.5 rounded-full font-medium">#{t}</span>
                ))}
              </div>
            )}
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
              simulation.status === 'completed' ? 'bg-green-500/10 text-green-400'
              : simulation.status === 'failed' ? 'bg-red-500/10 text-red-400'
              : 'bg-amber-500/10 text-amber-400'
            }`}>{simulation.status}</span>
          </div>
        </div>
      </div>

      {/* 3D Viewer + Metrics Panel */}
      <div className="flex-1 flex relative">
        <div className="flex-1 bg-black">
          <DentalViewer simulation={simulation} activeStateIndex={activeState} scanUrl={scanUrl} scanFormat={scanFormat} textureUrl={textureUrl} clinicalPathology={pathology} pickedTooth={pickedTooth} />
        </div>

        {/* Side Panel */}
        <div className="w-[360px] bg-surface-1 border-l border-white/5 flex flex-col">
          {/* Tab switcher */}
          <div className="flex border-b border-white/5 bg-black/30">
            <button
              onClick={() => setSideTab('timeline')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold transition ${
                sideTab === 'timeline'
                  ? 'text-white border-b-2 border-blue-500 bg-white/5'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Activity size={12} />
              Timeline
            </button>
            <button
              onClick={() => setSideTab('clinical')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold transition ${
                sideTab === 'clinical'
                  ? 'text-white border-b-2 border-emerald-500 bg-white/5'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Layers size={12} />
              Clinical Tools
              {pickedTooth && (
                <span className="ml-1 bg-emerald-500/20 text-emerald-300 text-[9px] px-1.5 py-0.5 rounded-full">
                  #{pickedTooth}
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sideTab === 'timeline' && (
              <>
                <div className="p-4 border-b border-white/5">
                  <div className="text-[11px] text-gray-600 uppercase tracking-wider mb-1">Treatment Timeline</div>
                  <div className="text-sm font-display font-semibold text-white">{currentState?.label || 'No state selected'}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all"
                        style={{ width: `${((activeState + 1) / states.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium tabular-nums">{activeState + 1}/{states.length}</span>
                  </div>
                  <div className="text-[11px] text-gray-600 mt-2">Drag the slider to step through each milestone</div>
                </div>

                {currentState?.clinical_metrics && (
                  <div className="p-4 border-b border-white/5">
                    <h3 className="text-[11px] text-gray-600 uppercase tracking-wider mb-3">Clinical Metrics</h3>
                    <div className="space-y-2">
                      {Object.entries(currentState.clinical_metrics).map(([key, val]) => (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
                          <MetricValue label={key} value={val} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4">
                  <h3 className="text-[11px] text-gray-600 uppercase tracking-wider mb-3">Timeline</h3>
                  <div className="space-y-1">
                    {states.map((s, i) => (
                      <button key={i} onClick={() => setActiveState(i)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition ${
                          i === activeState ? 'bg-white/10 text-white font-medium' : 'text-gray-500 hover:bg-white/5'
                        }`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${i === activeState ? 'bg-white' : i < activeState ? 'bg-gray-500' : 'bg-gray-700'}`} />
                          {s.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 border-t border-white/5">
                  <h3 className="text-[11px] text-gray-600 uppercase tracking-wider mb-2">Module</h3>
                  <span className="text-[11px] bg-white/5 text-gray-400 px-2 py-1 rounded capitalize">{simulation.module?.replace(/_/g, ' ')}</span>
                </div>
              </>
            )}

            {sideTab === 'clinical' && (
              <div className="p-3 space-y-3">
                <ToothPicker
                  value={pickedTooth}
                  onPick={(fdi) => { setPickedTooth(fdi); setPathology({}); }}
                  highlightTeeth={simulation.target_teeth || []}
                />
                {pickedTooth && (
                  <ToothAnatomyPanel
                    fdi={pickedTooth}
                    pathology={pathology}
                    onClose={() => { setPickedTooth(null); setPathology({}); }}
                  />
                )}
                <PathologyPicker
                  fdi={pickedTooth}
                  value={pathology}
                  onChange={setPathology}
                />
                {pickedTooth && pathology?.kind && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                    <div className="text-[10px] text-emerald-300 uppercase tracking-wider mb-1">Treatment Plan Entry</div>
                    <div className="text-xs text-white">
                      Tooth #{pickedTooth} · Class {pathology.classification}
                      {pathology.surfaces?.length ? ' ' + pathology.surfaces.join('') : ''}
                      {' · '}
                      <span className="capitalize">{(pathology.kind || '').replace(/_/g, ' ')}</span>
                    </div>
                    {pathology.depth && (
                      <div className="text-[10px] text-gray-400 mt-1">
                        Depth: <span className="capitalize">{pathology.depth.replace('_', ' ')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Controls */}
      {states.length > 1 && (
        <div className="bg-surface-1 border-t border-white/5 px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveState((s) => Math.max(0, s - 1))} disabled={activeState === 0}
              className="p-2 rounded-lg border border-white/10 disabled:opacity-20 hover:bg-white/5 transition text-gray-400">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => { if (activeState >= states.length - 1) setActiveState(0); setAutoPlay(!autoPlay); }}
              className={`p-2 rounded-lg border transition ${autoPlay ? 'bg-white/10 border-white/20 text-white' : 'border-white/10 hover:bg-white/5 text-gray-400'}`}>
              {autoPlay ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <div className="flex-1">
              <input type="range" min={0} max={states.length - 1} value={activeState}
                onChange={(e) => { setActiveState(parseInt(e.target.value)); setAutoPlay(false); }} className="w-full" />
              <div className="flex justify-between mt-1">
                {states.map((s, i) => (
                  <button key={i} onClick={() => { setActiveState(i); setAutoPlay(false); }}
                    className={`text-[10px] px-2 py-0.5 rounded transition ${
                      i === activeState ? 'bg-white text-black font-medium' : 'text-gray-600 hover:text-gray-300'
                    }`}>{s.label}</button>
                ))}
              </div>
            </div>
            <button onClick={() => setActiveState((s) => Math.min(states.length - 1, s + 1))} disabled={activeState === states.length - 1}
              className="p-2 rounded-lg border border-white/10 disabled:opacity-20 hover:bg-white/5 transition text-gray-400">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricValue({ label, value }) {
  if (typeof value === 'boolean') {
    return <span className={`text-[11px] px-1.5 py-0.5 rounded ${value ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>{value ? 'Yes' : 'No'}</span>;
  }
  const colorMap = {
    stage: { initial: 'bg-green-500/10 text-green-400', enamel: 'bg-yellow-500/10 text-yellow-400', dentin: 'bg-orange-500/10 text-orange-400', pulp: 'bg-red-500/10 text-red-400', abscess: 'bg-red-500/15 text-red-300', restored: 'bg-blue-500/10 text-blue-400', extracted: 'bg-gray-500/10 text-gray-400', endodontic: 'bg-purple-500/10 text-purple-400' },
    prognosis: { excellent: 'bg-green-500/10 text-green-400', good: 'bg-green-500/10 text-green-400', fair: 'bg-yellow-500/10 text-yellow-400', poor: 'bg-red-500/10 text-red-400' },
    risk: { low: 'bg-green-500/10 text-green-400', moderate: 'bg-yellow-500/10 text-yellow-400', high: 'bg-red-500/10 text-red-400' },
    risk_level: { low: 'bg-green-500/10 text-green-400', moderate: 'bg-yellow-500/10 text-yellow-400', high: 'bg-red-500/10 text-red-400' },
  };
  const map = colorMap[label];
  if (map && map[value]) {
    return <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium capitalize ${map[value]}`}>{String(value).replace(/_/g, ' ')}</span>;
  }
  return <span className="text-[11px] font-medium text-gray-300">{String(value).replace(/_/g, ' ')}</span>;
}
