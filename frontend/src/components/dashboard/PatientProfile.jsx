import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { patientAPI, simulationAPI, scanAPI } from '../../services/mockApi';
import { FileUp, Play, CheckCircle, Clock, Eye, Loader2, Upload, X, ChevronDown } from 'lucide-react';

// Preset simulation pathways
const SIMULATION_PRESETS = [
  { key: 'cavity_composite', label: 'Cavity → Composite Filling', description: 'Caries progression and composite restoration', promptTemplate: 'Simulate caries progression and composite filling on' },
  { key: 'pulpitis_rct_crown', label: 'Pulpitis → RCT → Zirconia Crown', description: 'Irreversible pulpitis to abscess, root canal treatment, and crown', promptTemplate: 'Simulate pulpitis progression, RCT, and zirconia crown on' },
  { key: 'caries_progression', label: 'Caries Progression (Untreated)', description: 'Show what happens if caries is left untreated over 18 months', promptTemplate: 'Show caries progression if untreated on' },
  { key: 'extraction', label: 'Extraction & Healing', description: 'Tooth extraction and socket healing', promptTemplate: 'Simulate extraction and healing of' },
  { key: 'perio_treatment', label: 'Periodontal Disease & Treatment', description: 'Bone loss progression vs SRP treatment outcome', promptTemplate: 'Simulate periodontal disease progression and treatment on' },
  { key: 'crown_only', label: 'Crown Restoration', description: 'Tooth preparation and zirconia crown placement', promptTemplate: 'Simulate crown restoration on' },
];

// FDI tooth numbers
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

  // Simulation wizard state
  const [selectedTeeth, setSelectedTeeth] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedScan, setSelectedScan] = useState(null);
  const [showWizard, setShowWizard] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, simsRes] = await Promise.all([
          patientAPI.getProfile(id),
          simulationAPI.listByPatient(id),
        ]);
        setProfile(profileRes.data);
        setSimulations(simsRes.data);
        if (profileRes.data.scans?.length > 0) setSelectedScan(profileRes.data.scans[0].id);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Scan upload handler
  const handleFileUpload = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['stl', 'ply', 'obj'].includes(ext)) {
      alert('Please upload an STL, PLY, or OBJ file from your intraoral scanner.');
      return;
    }
    setUploading(true);
    try {
      const { data: newScan } = await scanAPI.upload(id, file);
      setProfile((prev) => ({
        ...prev,
        scans: [...(prev.scans || []), newScan],
      }));
      setSelectedScan(newScan.id);
    } catch (err) {
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  }, [id]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const onDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);

  // Toggle tooth selection
  function toggleTooth(fdi) {
    setSelectedTeeth((prev) =>
      prev.includes(fdi) ? prev.filter((t) => t !== fdi) : [...prev, fdi]
    );
  }

  // Run simulation
  async function handleRunSimulation(e) {
    e.preventDefault();
    if (selectedTeeth.length === 0) {
      alert('Please select at least one tooth.');
      return;
    }
    const prompt = customPrompt || (selectedPreset
      ? `${SIMULATION_PRESETS.find((p) => p.key === selectedPreset)?.promptTemplate} #${selectedTeeth.join(', #')}`
      : `Simulate treatment on #${selectedTeeth.join(', #')}`);

    setSimulating(true);
    try {
      const { data } = await simulationAPI.create({
        patient_id: id,
        parent_scan_id: selectedScan,
        clinician_prompt: prompt,
        simulation_type: 'comparison',
        module: 'general',
        pathway: selectedPreset,
        target_teeth: selectedTeeth,
      });
      navigate(`/simulation/${data.id}`);
    } catch (err) {
      alert('Simulation failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSimulating(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;
  if (!profile) return <div className="p-8 text-red-500">Patient not found</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{profile.first_name} {profile.last_name}</h1>
          <p className="text-gray-500">DOB: {profile.date_of_birth} | {profile.email} | {profile.phone}</p>
        </div>
        <Link
          to={`/aligners/${id}`}
          className="text-sm text-lume-600 border border-lume-200 px-4 py-2 rounded-lg hover:bg-lume-50"
        >
          Aligner Tracker
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clinical Records */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Clinical Records</h2>
          {profile.clinicalRecords?.length === 0 ? (
            <p className="text-sm text-gray-400">No records yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {profile.clinicalRecords?.map((r) => (
                <div key={r.id} className="text-sm p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Tooth #{r.tooth_number}</span>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                    r.diagnosis === 'healthy' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {r.diagnosis.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scans — with drag & drop upload */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center justify-between">
            3D Scans
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-lume-600 flex items-center gap-1 hover:text-lume-800 transition"
            >
              <FileUp size={14} /> Upload
            </button>
          </h2>
          <input
            ref={fileInputRef}
            type="file"
            accept=".stl,.ply,.obj"
            className="hidden"
            onChange={(e) => { if (e.target.files[0]) handleFileUpload(e.target.files[0]); }}
          />

          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`border-2 border-dashed rounded-lg p-4 mb-3 text-center transition cursor-pointer ${
              dragOver ? 'border-lume-400 bg-lume-50' : 'border-gray-200 hover:border-gray-300'
            } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Loader2 size={16} className="animate-spin" /> Processing scan...
              </div>
            ) : (
              <>
                <Upload size={20} className="mx-auto text-gray-400 mb-1" />
                <p className="text-xs text-gray-500">Drop STL / PLY file here</p>
                <p className="text-xs text-gray-400 mt-0.5">From your intraoral scanner</p>
              </>
            )}
          </div>

          {/* Scan list */}
          {profile.scans?.length === 0 ? (
            <p className="text-sm text-gray-400">No scans uploaded</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {profile.scans?.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedScan(s.id)}
                  className={`text-sm p-3 rounded-lg cursor-pointer transition ${
                    selectedScan === s.id ? 'bg-lume-50 border border-lume-200' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium">{s.original_filename || `${s.scan_type} (${s.file_format.toUpperCase()})`}</div>
                  <div className="text-xs text-gray-500 mt-1">{new Date(s.scan_date).toLocaleDateString()}</div>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    s.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Treatments */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Treatments</h2>
          {profile.treatments?.length === 0 ? (
            <p className="text-sm text-gray-400">No treatments</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {profile.treatments?.map((t) => (
                <div key={t.id} className="text-sm p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="font-medium">{t.treatment_type.replace(/_/g, ' ')}</span>
                    {t.tooth_number && <span className="text-gray-500 ml-1">#{t.tooth_number}</span>}
                  </div>
                  {t.status === 'completed' ? (
                    <CheckCircle size={14} className="text-green-500" />
                  ) : (
                    <Clock size={14} className="text-amber-500" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Existing Simulations */}
      {simulations.length > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Eye size={18} className="text-lume-600" />
            Previous Simulations
          </h2>
          <div className="space-y-3">
            {simulations.map((sim) => (
              <Link
                key={sim.id}
                to={`/simulation/${sim.id}`}
                className="block p-4 bg-gray-50 rounded-lg hover:bg-lume-50 hover:border-lume-200 border border-transparent transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{sim.clinician_prompt}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {sim.module.replace(/_/g, ' ')} | Teeth: {sim.target_teeth?.map((t) => `#${t}`).join(', ')} | {sim.states?.length || 0} states | {new Date(sim.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      sim.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {sim.status}
                    </span>
                    <Play size={14} className="text-lume-600" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* New Simulation Wizard */}
      <div className="mt-6 bg-gradient-to-r from-lume-950 to-lume-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Play size={18} />
            New 3D Simulation
          </h2>
          <button
            onClick={() => setShowWizard(!showWizard)}
            className="text-white/70 hover:text-white text-sm flex items-center gap-1 transition"
          >
            {showWizard ? 'Simple Mode' : 'Advanced Wizard'}
            <ChevronDown size={14} className={`transition-transform ${showWizard ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showWizard ? (
          /* ── Advanced Wizard ── */
          <div className="space-y-5">
            {/* Step 1: Select Teeth */}
            <div>
              <label className="block text-xs text-white/70 uppercase tracking-wide mb-2">
                Step 1 — Select Tooth (FDI Notation)
              </label>
              <div className="bg-white/10 rounded-lg p-4">
                {/* Upper arch */}
                <div className="text-center mb-1">
                  <span className="text-[10px] text-white/50">UPPER</span>
                </div>
                <div className="flex justify-center gap-0.5 mb-1">
                  {UPPER_RIGHT.map((t) => (
                    <ToothButton key={t} fdi={t} selected={selectedTeeth.includes(t)} onClick={() => toggleTooth(t)} />
                  ))}
                  <div className="w-px bg-white/20 mx-1" />
                  {UPPER_LEFT.map((t) => (
                    <ToothButton key={t} fdi={t} selected={selectedTeeth.includes(t)} onClick={() => toggleTooth(t)} />
                  ))}
                </div>
                <div className="flex justify-center gap-0.5 mt-1">
                  {LOWER_RIGHT.map((t) => (
                    <ToothButton key={t} fdi={t} selected={selectedTeeth.includes(t)} onClick={() => toggleTooth(t)} />
                  ))}
                  <div className="w-px bg-white/20 mx-1" />
                  {LOWER_LEFT.map((t) => (
                    <ToothButton key={t} fdi={t} selected={selectedTeeth.includes(t)} onClick={() => toggleTooth(t)} />
                  ))}
                </div>
                <div className="text-center mt-1">
                  <span className="text-[10px] text-white/50">LOWER</span>
                </div>
                {selectedTeeth.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-white/60">Selected:</span>
                    {selectedTeeth.map((t) => (
                      <span key={t} className="bg-lume-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        #{t}
                        <button onClick={() => toggleTooth(t)} className="hover:text-white/80"><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Select Pathway */}
            <div>
              <label className="block text-xs text-white/70 uppercase tracking-wide mb-2">
                Step 2 — Choose Simulation Pathway
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {SIMULATION_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => setSelectedPreset(selectedPreset === preset.key ? null : preset.key)}
                    className={`text-left p-3 rounded-lg border transition text-sm ${
                      selectedPreset === preset.key
                        ? 'bg-white text-lume-900 border-white'
                        : 'bg-white/10 text-white border-white/10 hover:bg-white/20'
                    }`}
                  >
                    <div className="font-medium">{preset.label}</div>
                    <div className={`text-xs mt-0.5 ${selectedPreset === preset.key ? 'text-gray-500' : 'text-white/60'}`}>
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Custom prompt (optional) */}
            <div>
              <label className="block text-xs text-white/70 uppercase tracking-wide mb-2">
                Step 3 — Custom Instructions (Optional)
              </label>
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g., Patient has spontaneous pain, cold lingering >30s..."
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-lg focus:ring-2 focus:ring-white/40 focus:border-transparent outline-none text-sm"
              />
            </div>

            {/* Run button */}
            <div className="flex items-center justify-between">
              {!selectedScan && (
                <p className="text-xs text-white/50">Upload or select a scan above to enable simulation</p>
              )}
              <button
                onClick={handleRunSimulation}
                disabled={selectedTeeth.length === 0 || !selectedScan || simulating}
                className="ml-auto bg-white text-lume-900 px-8 py-2.5 rounded-lg font-medium hover:bg-gray-100 transition disabled:opacity-50 flex items-center gap-2"
              >
                {simulating ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : <><Play size={16} /> Run 3D Simulation</>}
              </button>
            </div>
          </div>
        ) : (
          /* ── Simple Mode — text prompt ── */
          <form onSubmit={handleRunSimulation} className="space-y-3">
            {/* Quick tooth selection */}
            <div className="flex gap-1 flex-wrap">
              {[36, 46, 14, 26, 11, 21, 31, 41].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTooth(t)}
                  className={`text-xs px-2.5 py-1 rounded-full transition ${
                    selectedTeeth.includes(t)
                      ? 'bg-white text-lume-900 font-medium'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  #{t}
                </button>
              ))}
            </div>
            <div className="flex gap-4">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder='e.g., "Simulate RCT + Crown on #36" or "Show caries progression on #14"'
                className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 text-white placeholder-white/50 rounded-lg focus:ring-2 focus:ring-white/40 focus:border-transparent outline-none"
              />
              <button
                type="submit"
                disabled={selectedTeeth.length === 0 || !selectedScan || simulating}
                className="bg-white text-lume-900 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-100 transition disabled:opacity-50 flex items-center gap-2"
              >
                {simulating ? <><Loader2 size={16} className="animate-spin" /> Running...</> : 'Run Simulation'}
              </button>
            </div>
            {!selectedScan && (
              <p className="text-xs text-white/60">Select a scan above to enable simulation</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function ToothButton({ fdi, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-7 h-7 text-[10px] font-medium rounded transition ${
        selected
          ? 'bg-white text-lume-900 shadow-sm'
          : 'bg-white/10 text-white/70 hover:bg-white/20'
      }`}
    >
      {fdi}
    </button>
  );
}
