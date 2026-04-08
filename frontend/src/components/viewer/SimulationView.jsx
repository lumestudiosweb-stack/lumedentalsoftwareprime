import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { simulationAPI, patientAPI } from '../../services/mockApi';
import DentalViewer from './DentalViewer';
import { ChevronLeft, ChevronRight, Loader2, ArrowLeft, Play, Pause } from 'lucide-react';

export default function SimulationView() {
  const { id } = useParams();
  const [simulation, setSimulation] = useState(null);
  const [patient, setPatient] = useState(null);
  const [activeState, setActiveState] = useState(0);
  const [loading, setLoading] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await simulationAPI.get(id);
        setSimulation(data);
        if (data?.patient_id) {
          const { data: p } = await patientAPI.get(data.patient_id);
          setPatient(p);
        }
      } catch {
        // handle
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Auto-play through states
  useEffect(() => {
    if (!autoPlay || !simulation?.states?.length) return;
    const interval = setInterval(() => {
      setActiveState((s) => {
        if (s >= simulation.states.length - 1) {
          setAutoPlay(false);
          return s;
        }
        return s + 1;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [autoPlay, simulation]);

  const states = simulation?.states || [];
  const currentState = states[activeState] || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-lume-600" size={32} />
      </div>
    );
  }

  if (!simulation) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500">Simulation not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={patient ? `/patients/${patient.id}` : '/'}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">3D Simulation</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {simulation.clinician_prompt}
                {patient && (
                  <span className="text-lume-600 ml-2">— {patient.first_name} {patient.last_name}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {simulation.target_teeth?.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Teeth:</span>
                {simulation.target_teeth.map((t) => (
                  <span key={t} className="bg-lume-100 text-lume-700 text-xs px-2 py-0.5 rounded-full font-medium">
                    #{t}
                  </span>
                ))}
              </div>
            )}
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              simulation.status === 'completed' ? 'bg-green-100 text-green-700'
              : simulation.status === 'failed' ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700'
            }`}>
              {simulation.status}
            </span>
          </div>
        </div>
      </div>

      {/* 3D Viewer + Metrics Panel */}
      <div className="flex-1 flex relative">
        {/* 3D Canvas */}
        <div className="flex-1 bg-gray-900">
          <DentalViewer
            simulation={simulation}
            activeStateIndex={activeState}
          />
        </div>

        {/* Side Panel — Clinical Metrics */}
        <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto">
          {/* Current State Info */}
          <div className="p-4 border-b border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Current View</div>
            <div className="text-sm font-semibold text-gray-900">
              {currentState?.label || 'No state selected'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              State {activeState + 1} of {states.length}
            </div>
          </div>

          {/* Clinical Metrics */}
          {currentState?.clinical_metrics && (
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-xs text-gray-400 uppercase tracking-wide mb-3">Clinical Metrics</h3>
              <div className="space-y-2">
                {Object.entries(currentState.clinical_metrics).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
                    <MetricValue label={key} value={val} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* State Legend */}
          <div className="p-4">
            <h3 className="text-xs text-gray-400 uppercase tracking-wide mb-3">Progression Timeline</h3>
            <div className="space-y-1">
              {states.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveState(i)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition ${
                    i === activeState
                      ? 'bg-lume-50 border border-lume-200 text-lume-800 font-medium'
                      : i < activeState
                      ? 'text-gray-500 hover:bg-gray-50'
                      : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      i === activeState ? 'bg-lume-600' : i < activeState ? 'bg-gray-400' : 'bg-gray-200'
                    }`} />
                    {s.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Module Info */}
          <div className="p-4 border-t border-gray-100">
            <h3 className="text-xs text-gray-400 uppercase tracking-wide mb-2">Module</h3>
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded capitalize">
              {simulation.module?.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Timeline Controls */}
      {states.length > 1 && (
        <div className="bg-white border-t border-gray-200 px-6 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveState((s) => Math.max(0, s - 1))}
              disabled={activeState === 0}
              className="p-2 rounded-lg border disabled:opacity-30 hover:bg-gray-50 transition"
            >
              <ChevronLeft size={18} />
            </button>

            {/* Auto-play */}
            <button
              onClick={() => {
                if (activeState >= states.length - 1) setActiveState(0);
                setAutoPlay(!autoPlay);
              }}
              className={`p-2 rounded-lg border transition ${autoPlay ? 'bg-lume-50 border-lume-200 text-lume-600' : 'hover:bg-gray-50'}`}
            >
              {autoPlay ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={states.length - 1}
                value={activeState}
                onChange={(e) => {
                  setActiveState(parseInt(e.target.value));
                  setAutoPlay(false);
                }}
                className="w-full accent-lume-600"
              />
              <div className="flex justify-between mt-1">
                {states.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setActiveState(i); setAutoPlay(false); }}
                    className={`text-xs px-2 py-0.5 rounded transition ${
                      i === activeState ? 'bg-lume-600 text-white' : 'text-gray-500 hover:text-gray-900'
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
              className="p-2 rounded-lg border disabled:opacity-30 hover:bg-gray-50 transition"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricValue({ label, value }) {
  if (typeof value === 'boolean') {
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${value ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
        {value ? 'Yes' : 'No'}
      </span>
    );
  }
  const colorMap = {
    stage: { initial: 'bg-green-100 text-green-700', enamel: 'bg-yellow-100 text-yellow-700', dentin: 'bg-orange-100 text-orange-700', pulp: 'bg-red-100 text-red-700', abscess: 'bg-red-200 text-red-800', restored: 'bg-blue-100 text-blue-700', extracted: 'bg-gray-200 text-gray-700', endodontic: 'bg-purple-100 text-purple-700' },
    prognosis: { excellent: 'bg-green-100 text-green-700', good: 'bg-green-100 text-green-700', fair: 'bg-yellow-100 text-yellow-700', poor: 'bg-red-100 text-red-700' },
    risk: { low: 'bg-green-100 text-green-700', moderate: 'bg-yellow-100 text-yellow-700', high: 'bg-red-100 text-red-700' },
    risk_level: { low: 'bg-green-100 text-green-700', moderate: 'bg-yellow-100 text-yellow-700', high: 'bg-red-100 text-red-700' },
  };
  const map = colorMap[label];
  if (map && map[value]) {
    return <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${map[value]}`}>{String(value).replace(/_/g, ' ')}</span>;
  }
  return <span className="text-xs font-medium text-gray-800">{String(value).replace(/_/g, ' ')}</span>;
}
