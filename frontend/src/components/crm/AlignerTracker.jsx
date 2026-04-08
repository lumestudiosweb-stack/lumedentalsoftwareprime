import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { alignerAPI } from '../../services/mockApi';
import { Camera, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';

export default function AlignerTracker() {
  const { patientId } = useParams();
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statusRes, historyRes] = await Promise.all([
          alignerAPI.getStatus(patientId),
          alignerAPI.getHistory(patientId),
        ]);
        setStatus(statusRes.data);
        setHistory(historyRes.data);
      } catch {} finally { setLoading(false); }
    }
    load();
  }, [patientId]);

  async function handleAdvance() {
    try {
      const { data } = await alignerAPI.advance(patientId);
      setStatus(data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to advance tray');
    }
  }

  if (loading) return <div className="p-8 text-gray-600">Loading...</div>;

  if (!status) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-display font-bold text-white mb-4">Aligner Tracker</h1>
        <div className="bg-surface-2 border border-white/5 rounded-xl p-8 text-center">
          <p className="text-gray-500">No aligner tracking found for this patient.</p>
          <button className="mt-4 bg-white text-black px-4 py-2 rounded-lg text-sm font-semibold">Start Tracking</button>
        </div>
      </div>
    );
  }

  const progressPct = (status.current_tray_number / status.total_trays) * 100;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-display font-bold text-white mb-6">Aligner Tracker</h1>

      <div className="bg-surface-2 border border-white/5 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-display font-semibold text-white">
              Tray {status.current_tray_number} of {status.total_trays}
            </h2>
            <p className="text-sm text-gray-500">
              Started: {new Date(status.tray_start_date).toLocaleDateString()}
              {status.next_change_date && <span> | Next: {new Date(status.next_change_date).toLocaleDateString()}</span>}
            </p>
          </div>
          <FitBadge status={status.fit_status} />
        </div>

        <div className="w-full bg-surface-4 rounded-full h-2 mb-2">
          <div className="bg-white h-2 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="text-xs text-gray-600">{Math.round(progressPct)}% complete</p>

        {status.ai_recommendation && (
          <div className="mt-4 bg-white/5 border border-white/10 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">AI Recommendation</p>
            <p className="text-sm text-gray-300 mt-1">{status.ai_recommendation}</p>
          </div>
        )}

        {status.gap_measurement_mm !== null && (
          <div className="mt-4 text-sm">
            <span className="text-gray-500">Measured gap:</span>
            <span className={`ml-2 font-medium ${
              status.gap_measurement_mm < 0.5 ? 'text-green-400' : status.gap_measurement_mm < 1.0 ? 'text-amber-400' : 'text-red-400'
            }`}>{status.gap_measurement_mm}mm</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button className="flex items-center justify-center gap-2 bg-surface-2 border border-white/5 rounded-xl p-5 hover:border-white/10 transition">
          <Camera size={18} className="text-gray-400" />
          <span className="font-medium text-white text-sm">Upload Fit Photo</span>
        </button>
        <button onClick={handleAdvance}
          className="flex items-center justify-center gap-2 bg-white text-black rounded-xl p-5 hover:bg-gray-200 transition font-semibold text-sm">
          <ArrowRight size={18} /> Advance to Next Tray
        </button>
      </div>

      <div className="bg-surface-2 border border-white/5 rounded-xl p-6">
        <h2 className="font-display font-semibold text-white mb-4 text-sm">Tray History</h2>
        <div className="space-y-3">
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-sm font-medium text-white">
                  {h.current_tray_number}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Tray {h.current_tray_number}</p>
                  <p className="text-xs text-gray-600">{new Date(h.tray_start_date).toLocaleDateString()}</p>
                </div>
              </div>
              <FitBadge status={h.fit_status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FitBadge({ status }) {
  const config = {
    good: { color: 'bg-green-500/10 text-green-400', icon: CheckCircle, label: 'Good Fit' },
    acceptable: { color: 'bg-amber-500/10 text-amber-400', icon: AlertCircle, label: 'Acceptable' },
    poor: { color: 'bg-red-500/10 text-red-400', icon: AlertCircle, label: 'Poor Fit' },
    needs_rescan: { color: 'bg-purple-500/10 text-purple-400', icon: AlertCircle, label: 'Needs Rescan' },
  };
  const c = config[status] || config.good;
  const Icon = c.icon;
  return (
    <span className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full ${c.color}`}>
      <Icon size={12} /> {c.label}
    </span>
  );
}
