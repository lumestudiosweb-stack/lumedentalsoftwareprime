import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { patientAPI, simulationAPI, scanAPI } from '../../services/mockApi';
import { FileUp, Play, CheckCircle, Clock, Eye, Loader2, Upload, X, ChevronDown, Box } from 'lucide-react';
import ScanPreview3D from '../viewer/ScanPreview3D';

const SIMULATION_PRESETS = [
  { key: 'cavity_composite', label: 'Cavity \u2192 Composite Filling', description: 'Caries progression and composite restoration', promptTemplate: 'Simulate caries progression and composite filling on' },
  { key: 'pulpitis_rct_crown', label: 'Pulpitis \u2192 RCT \u2192 Zirconia Crown', description: 'Irreversible pulpitis to abscess, root canal treatment, and crown', promptTemplate: 'Simulate pulpitis progression, RCT, and zirconia crown on' },
  { key: 'caries_progression', label: 'Caries Progression (Untreated)', description: 'Show what happens if caries is left untreated over 18 months', promptTemplate: 'Show caries progression if untreated on' },
  { key: 'extraction', label: 'Extraction & Healing', description: 'Tooth extraction and socket healing', promptTemplate: 'Simulate extraction and healing of' },
  { key: 'perio_treatment', label: 'Periodontal Disease & Treatment', description: 'Bone loss progression vs SRP treatment outcome', promptTemplate: 'Simulate periodontal disease progression and treatment on' },
  { key: 'crown_only', label: 'Crown Restoration', description: 'Tooth preparation and zirconia crown placement', promptTemplate: 'Simulate crown restoration on' },
];

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];

export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [simulations, setSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  const [selectedTeeth, setSelectedTeeth] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedScan, setSelectedScan] = useState(null);
  const [showWizard, setShowWizard] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewFormat, setPreviewFormat] = useState('stl');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, simsRes] = await Promise.all([
          patientAPI.getProfile(id),
          simulationAPI.listByPatient(id),
        ]);
        setProfile(profileRes.data);
        setSimulations(simsRes.data);
        if (profileRes.data.scans?.length > 0) {
          const firstScan = profileRes.data.scans[0];
          setSelectedScan(firstScan.id);
          if (firstScan.storage_path?.startsWith('blob:')) {
            setPreviewUrl(firstScan.storage_path);
            setPreviewFormat(firstScan.file_format || 'stl');
          }
        }
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleFileUpload = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['stl', 'ply', 'obj'].includes(ext)) {
      alert('Please upload an STL, PLY, or OBJ file from your intraoral scanner.');
      return;
    }
    // Immediately create a blob URL so we can preview before API returns
    const blobUrl = URL.createObjectURL(file);
    setPreviewUrl(blobUrl);
    setPreviewFormat(ext);
    setShowPreview(true);
    setUploading(true);
    try {
      const { data: newScan } = await scanAPI.upload(id, file);
      setProfile((prev) => ({ ...prev, scans: [...(prev.scans || []), newScan] }));
      setSelectedScan(newScan.id);
    } catch (err) {
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  }, [id]);

  const onDrop = useCallback((e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer?.files?.[0]; if (file) handleFileUpload(file); }, [handleFileUpload]);
  const onDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);

  function toggleTooth(fdi) {
    setSelectedTeeth((prev) => prev.includes(fdi) ? prev.filter((t) => t !== fdi) : [...prev, fdi]);
  }

  async function handleRunSimulation(e) {
    e.preventDefault();
    if (selectedTeeth.length === 0) { alert('Please select at least one tooth.'); return; }
    const prompt = customPrompt || (selectedPreset
      ? `${SIMULATION_PRESETS.find((p) => p.key === selectedPreset)?.promptTemplate} #${selectedTeeth.join(', #')}`
      : `Simulate treatment on #${selectedTeeth.join(', #')}`);
    setSimulating(true);
    try {
      const { data } = await simulationAPI.create({ patient_id: id, parent_scan_id: selectedScan, clinician_prompt: prompt, simulation_type: 'comparison', module: 'general', pathway: selectedPreset, target_teeth: selectedTeeth });
      navigate(`/simulation/${data.id}`);
    } catch (err) {
      alert('Simulation failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSimulating(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-600">Loading...</div>;
  if (!profile) return <div className="p-8 text-red-400">Patient not found</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">{profile.first_name} {profile.last_name}</h1>
          <p className="text-gray-500 text-sm">DOB: {profile.date_of_birth} | {profile.email} | {profile.phone}</p>
        </div>
        <Link to={`/aligners/${id}`} className="text-sm text-gray-400 border border-white/10 px-4 py-2 rounded-lg hover:bg-white/5 transition">
          Aligner Tracker
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Clinical Records */}
        <div className="bg-surface-2 border border-white/5 rounded-xl p-5">
          <h2 className="font-display font-semibold text-white mb-4 text-sm">Clinical Records</h2>
          {profile.clinicalRecords?.length === 0 ? (
            <p className="text-sm text-gray-600">No records yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {profile.clinicalRecords?.map((r) => (
                <div key={r.id} className="text-sm p-3 bg-surface-3 rounded-lg">
                  <span className="font-medium text-white">Tooth #{r.tooth_number}</span>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                    r.diagnosis === 'healthy' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>{r.diagnosis.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scans */}
        <div className="bg-surface-2 border border-white/5 rounded-xl p-5">
          <h2 className="font-display font-semibold text-white mb-4 text-sm flex items-center justify-between">
            3D Scans
            <button onClick={() => fileInputRef.current?.click()} className="text-xs text-gray-400 flex items-center gap-1 hover:text-white transition">
              <FileUp size={12} /> Upload
            </button>
          </h2>
          <input ref={fileInputRef} type="file" accept=".stl,.ply,.obj" className="hidden" onChange={(e) => { if (e.target.files[0]) handleFileUpload(e.target.files[0]); }} />
          <div
            onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
            className={`border border-dashed rounded-lg p-4 mb-3 text-center transition cursor-pointer ${
              dragOver ? 'border-lume-400 bg-lume-500/5' : 'border-white/10 hover:border-white/20'
            } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Processing scan...</div>
            ) : (
              <>
                <Upload size={18} className="mx-auto text-gray-600 mb-1" />
                <p className="text-xs text-gray-500">Drop STL / PLY file here</p>
                <p className="text-xs text-gray-600 mt-0.5">From your intraoral scanner</p>
              </>
            )}
          </div>
          {profile.scans?.length === 0 ? (
            <p className="text-sm text-gray-600">No scans uploaded</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {profile.scans?.map((s) => (
                <div key={s.id} onClick={() => {
                  setSelectedScan(s.id);
                  if (s.storage_path?.startsWith('blob:')) {
                    setPreviewUrl(s.storage_path);
                    setPreviewFormat(s.file_format || 'stl');
                    setShowPreview(true);
                  }
                }}
                  className={`text-sm p-3 rounded-lg cursor-pointer transition ${
                    selectedScan === s.id ? 'bg-white/10 border border-white/10' : 'bg-surface-3 hover:bg-surface-4'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-white text-xs">{s.original_filename || `${s.scan_type} (${s.file_format.toUpperCase()})`}</div>
                    {s.storage_path?.startsWith('blob:') && <Box size={10} className="text-lume-400 shrink-0" />}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{new Date(s.scan_date).toLocaleDateString()}</div>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${s.status === 'ready' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Treatments */}
        <div className="bg-surface-2 border border-white/5 rounded-xl p-5">
          <h2 className="font-display font-semibold text-white mb-4 text-sm">Treatments</h2>
          {profile.treatments?.length === 0 ? (
            <p className="text-sm text-gray-600">No treatments</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {profile.treatments?.map((t) => (
                <div key={t.id} className="text-sm p-3 bg-surface-3 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="font-medium text-white text-xs">{t.treatment_type.replace(/_/g, ' ')}</span>
                    {t.tooth_number && <span className="text-gray-500 ml-1 text-xs">#{t.tooth_number}</span>}
                  </div>
                  {t.status === 'completed' ? <CheckCircle size={14} className="text-green-400" /> : <Clock size={14} className="text-amber-400" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3D Scan Preview Panel */}
      {previewUrl && (
        <div className="mt-4 bg-surface-1 border border-white/5 rounded-xl overflow-hidden" style={{ height: '480px' }}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2">
              <Box size={14} className="text-lume-400" />
              <span className="text-sm font-display font-semibold text-white">3D Scan Preview</span>
              <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-wide">{previewFormat}</span>
            </div>
            <button
              onClick={() => { setPreviewUrl(null); setShowPreview(false); }}
              className="text-gray-600 hover:text-white transition p-1"
            >
              <X size={14} />
            </button>
          </div>
          <ScanPreview3D
            scanUrl={previewUrl}
            scanFormat={previewFormat}
            className="h-full w-full"
          />
        </div>
      )}

      {/* Previous Simulations */}
      {simulations.length > 0 && (
        <div className="mt-6 bg-surface-2 border border-white/5 rounded-xl p-5">
          <h2 className="font-display font-semibold text-white mb-4 flex items-center gap-2 text-sm">
            <Eye size={16} className="text-gray-500" /> Previous Simulations
          </h2>
          <div className="space-y-2">
            {simulations.map((sim) => (
              <Link key={sim.id} to={`/simulation/${sim.id}`} className="block p-4 bg-surface-3 rounded-lg hover:bg-surface-4 border border-transparent hover:border-white/5 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white text-sm">{sim.clinician_prompt}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {sim.module.replace(/_/g, ' ')} | Teeth: {sim.target_teeth?.map((t) => `#${t}`).join(', ')} | {sim.states?.length || 0} states
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      sim.status === 'completed' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>{sim.status}</span>
                    <Play size={14} className="text-gray-500" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* New Simulation Wizard */}
      <div className="mt-6 bg-surface-1 border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-white flex items-center gap-2">
            <Play size={16} /> New 3D Simulation
          </h2>
          <button onClick={() => setShowWizard(!showWizard)} className="text-gray-500 hover:text-white text-xs flex items-center gap-1 transition">
            {showWizard ? 'Simple Mode' : 'Advanced Wizard'}
            <ChevronDown size={12} className={`transition-transform ${showWizard ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showWizard ? (
          <div className="space-y-5">
            {/* Step 1: Select Teeth */}
            <div>
              <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-2">Step 1 — Select Tooth (FDI Notation)</label>
              <div className="bg-surface-3 rounded-lg p-4">
                <div className="text-center mb-1"><span className="text-[10px] text-gray-600">UPPER</span></div>
                <div className="flex justify-center gap-0.5 mb-1">
                  {UPPER_RIGHT.map((t) => <ToothButton key={t} fdi={t} selected={selectedTeeth.includes(t)} onClick={() => toggleTooth(t)} />)}
                  <div className="w-px bg-white/10 mx-1" />
                  {UPPER_LEFT.map((t) => <ToothButton key={t} fdi={t} selected={selectedTeeth.includes(t)} onClick={() => toggleTooth(t)} />)}
                </div>
                <div className="flex justify-center gap-0.5 mt-1">
                  {LOWER_RIGHT.map((t) => <ToothButton key={t} fdi={t} selected={selectedTeeth.includes(t)} onClick={() => toggleTooth(t)} />)}
                  <div className="w-px bg-white/10 mx-1" />
                  {LOWER_LEFT.map((t) => <ToothButton key={t} fdi={t} selected={selectedTeeth.includes(t)} onClick={() => toggleTooth(t)} />)}
                </div>
                <div className="text-center mt-1"><span className="text-[10px] text-gray-600">LOWER</span></div>
                {selectedTeeth.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">Selected:</span>
                    {selectedTeeth.map((t) => (
                      <span key={t} className="bg-white text-black text-xs px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                        #{t} <button onClick={() => toggleTooth(t)} className="hover:text-gray-500"><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Select Pathway */}
            <div>
              <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-2">Step 2 — Choose Simulation Pathway</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {SIMULATION_PRESETS.map((preset) => (
                  <button key={preset.key} onClick={() => setSelectedPreset(selectedPreset === preset.key ? null : preset.key)}
                    className={`text-left p-3 rounded-lg border transition text-sm ${
                      selectedPreset === preset.key ? 'bg-white text-black border-white' : 'bg-surface-3 text-gray-300 border-white/5 hover:border-white/10'
                    }`}>
                    <div className="font-medium text-xs">{preset.label}</div>
                    <div className={`text-xs mt-0.5 ${selectedPreset === preset.key ? 'text-black/50' : 'text-gray-600'}`}>{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Custom prompt */}
            <div>
              <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-2">Step 3 — Custom Instructions (Optional)</label>
              <input type="text" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g., Patient has spontaneous pain, cold lingering >30s..."
                className="w-full px-4 py-2.5 bg-surface-3 border border-white/10 text-white placeholder-gray-600 rounded-lg focus:ring-2 focus:ring-white/20 focus:border-white/20 outline-none text-sm" />
            </div>

            <div className="flex items-center justify-between">
              {!selectedScan && <p className="text-xs text-gray-600">Upload or select a scan above to enable simulation</p>}
              <button onClick={handleRunSimulation} disabled={selectedTeeth.length === 0 || !selectedScan || simulating}
                className="ml-auto bg-white text-black px-8 py-2.5 rounded-lg font-semibold hover:bg-gray-200 transition disabled:opacity-30 flex items-center gap-2 text-sm">
                {simulating ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : <><Play size={16} /> Run 3D Simulation</>}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRunSimulation} className="space-y-3">
            <div className="flex gap-1 flex-wrap">
              {[36, 46, 14, 26, 11, 21, 31, 41].map((t) => (
                <button key={t} type="button" onClick={() => toggleTooth(t)}
                  className={`text-xs px-2.5 py-1 rounded-full transition ${
                    selectedTeeth.includes(t) ? 'bg-white text-black font-semibold' : 'bg-white/5 text-gray-500 hover:bg-white/10'
                  }`}>#{t}</button>
              ))}
            </div>
            <div className="flex gap-4">
              <input type="text" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder='e.g., "Simulate RCT + Crown on #36"'
                className="flex-1 px-4 py-2.5 bg-surface-3 border border-white/10 text-white placeholder-gray-600 rounded-lg focus:ring-2 focus:ring-white/20 outline-none text-sm" />
              <button type="submit" disabled={selectedTeeth.length === 0 || !selectedScan || simulating}
                className="bg-white text-black px-6 py-2.5 rounded-lg font-semibold hover:bg-gray-200 transition disabled:opacity-30 flex items-center gap-2 text-sm">
                {simulating ? <><Loader2 size={16} className="animate-spin" /> Running...</> : 'Run Simulation'}
              </button>
            </div>
            {!selectedScan && <p className="text-xs text-gray-600">Select a scan above to enable simulation</p>}
          </form>
        )}
      </div>
    </div>
  );
}

function ToothButton({ fdi, selected, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-7 h-7 text-[10px] font-medium rounded transition ${
        selected ? 'bg-white text-black' : 'bg-white/5 text-gray-500 hover:bg-white/10'
      }`}>{fdi}</button>
  );
}
