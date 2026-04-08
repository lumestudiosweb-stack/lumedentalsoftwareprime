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
      } catch {
        // No tracking found
      } finally {
        setLoading(false);
      }
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

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  if (!status) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Aligner Tracker</h1>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-gray-500">No aligner tracking found for this patient.</p>
          <button className="mt-4 bg-lume-600 text-white px-4 py-2 rounded-lg text-sm">
            Start Tracking
          </button>
        </div>
      </div>
    );
  }

  const progressPct = (status.current_tray_number / status.total_trays) * 100;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Aligner Tracker</h1>

      {/* Current Status Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Tray {status.current_tray_number} of {status.total_trays}
            </h2>
            <p className="text-sm text-gray-500">
              Started: {new Date(status.tray_start_date).toLocaleDateString()}
              {status.next_change_date && (
                <span> | Next change: {new Date(status.next_change_date).toLocaleDateString()}</span>
              )}
            </p>
          </div>
          <FitBadge status={status.fit_status} />
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div
            className="bg-lume-600 h-3 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">{Math.round(progressPct)}% complete</p>

        {/* AI Recommendation */}
        {status.ai_recommendation && (
          <div className="mt-4 bg-lume-50 border border-lume-200 rounded-lg p-4">
            <p className="text-sm font-medium text-lume-800">AI Recommendation</p>
            <p className="text-sm text-lume-700 mt-1">{status.ai_recommendation}</p>
          </div>
        )}

        {/* Gap Measurement */}
        {status.gap_measurement_mm !== null && (
          <div className="mt-4 text-sm">
            <span className="text-gray-500">Measured gap:</span>
            <span className={`ml-2 font-medium ${
              status.gap_measurement_mm < 0.5 ? 'text-green-600'
              : status.gap_measurement_mm < 1.0 ? 'text-amber-600'
              : 'text-red-600'
            }`}>
              {status.gap_measurement_mm}mm
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition">
          <Camera size={20} className="text-lume-600" />
          <span className="font-medium text-gray-900">Upload Fit Photo</span>
        </button>
        <button
          onClick={handleAdvance}
          className="flex items-center justify-center gap-2 bg-lume-600 text-white rounded-xl p-5 hover:bg-lume-700 transition"
        >
          <ArrowRight size={20} />
          <span className="font-medium">Advance to Next Tray</span>
        </button>
      </div>

      {/* History */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Tray History</h2>
        <div className="space-y-3">
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-lume-100 rounded-full flex items-center justify-center text-sm font-medium text-lume-700">
                  {h.current_tray_number}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Tray {h.current_tray_number}</p>
                  <p className="text-xs text-gray-500">{new Date(h.tray_start_date).toLocaleDateString()}</p>
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
    good: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Good Fit' },
    acceptable: { color: 'bg-amber-100 text-amber-700', icon: AlertCircle, label: 'Acceptable' },
    poor: { color: 'bg-red-100 text-red-700', icon: AlertCircle, label: 'Poor Fit' },
    needs_rescan: { color: 'bg-purple-100 text-purple-700', icon: AlertCircle, label: 'Needs Rescan' },
  };
  const c = config[status] || config.good;
  const Icon = c.icon;

  return (
    <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${c.color}`}>
      <Icon size={12} />
      {c.label}
    </span>
  );
}
