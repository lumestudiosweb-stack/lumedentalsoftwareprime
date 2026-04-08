import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { patientAPI, crmAPI } from '../../services/mockApi';
import { mockPatients } from '../../services/mockData';
import { Users, AlertTriangle, Clock, Activity, ArrowRight, Hexagon, MessageSquare } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ patients: 0, escalations: [], dueEvents: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [patientsRes, escalationsRes, dueRes] = await Promise.all([
          patientAPI.list(),
          crmAPI.getEscalations(),
          crmAPI.getDue(),
        ]);
        setStats({
          patients: patientsRes.data.total,
          escalations: escalationsRes.data,
          dueEvents: dueRes.data,
        });
      } catch {
        // fallback
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-white">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back, Dr. Demo</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Total Patients" value={stats.patients} />
        <StatCard icon={AlertTriangle} label="Escalations" value={stats.escalations.length} accent="red" />
        <StatCard icon={Clock} label="Due Follow-ups" value={stats.dueEvents.length} accent="amber" />
        <StatCard icon={Activity} label="Simulations Run" value={4} accent="green" />
      </div>

      {/* Escalations */}
      {stats.escalations.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-6 mb-6">
          <h2 className="text-base font-display font-semibold text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle size={18} /> Requires Immediate Attention
          </h2>
          <div className="space-y-2">
            {stats.escalations.map((e) => {
              const patient = mockPatients.find((p) => p.id === e.patient_id);
              return (
                <div key={e.id} className="flex items-center justify-between bg-surface-2 rounded-lg p-4 border border-white/5">
                  <div>
                    <span className="text-sm font-medium text-white">
                      {patient ? `${patient.first_name} ${patient.last_name}` : 'Patient'}
                    </span>
                    <span className="text-sm text-red-400 ml-3">{e.escalation_reason}</span>
                    <p className="text-xs text-gray-500 mt-1 italic">"{e.patient_response?.slice(0, 80)}..."</p>
                  </div>
                  <Link to={`/patients/${e.patient_id}`} className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition">
                    View <ArrowRight size={14} />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Due events */}
      {stats.dueEvents.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-6 mb-6">
          <h2 className="text-base font-display font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <Clock size={18} /> Upcoming Follow-ups ({stats.dueEvents.length})
          </h2>
          <div className="space-y-2">
            {stats.dueEvents.map((e) => {
              const patient = mockPatients.find((p) => p.id === e.patient_id);
              return (
                <div key={e.id} className="flex items-center justify-between bg-surface-2 rounded-lg p-4 border border-white/5">
                  <div>
                    <span className="text-sm font-medium text-white">
                      {patient ? `${patient.first_name} ${patient.last_name}` : 'Patient'}
                    </span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                      e.event_type === 'aligner_tray_change' ? 'bg-purple-500/10 text-purple-400'
                      : e.event_type === 'hygiene_recall_6m' ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-white/5 text-gray-400'
                    }`}>
                      {e.event_type.replace(/_/g, ' ')}
                    </span>
                    <p className="text-xs text-gray-600 mt-1">{e.message_template?.slice(0, 90)}...</p>
                  </div>
                  <span className="text-xs text-gray-600">{new Date(e.scheduled_at).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/patients"
          className="bg-surface-2 border border-white/5 rounded-xl p-6 hover:border-white/10 transition group"
        >
          <Users size={22} className="text-gray-500 mb-3 group-hover:text-white transition" />
          <h3 className="font-display font-semibold text-white group-hover:text-white transition">Patient Records</h3>
          <p className="text-sm text-gray-600 mt-1">Search, view profiles, and manage clinical data</p>
        </Link>
        <Link
          to="/patients/p1"
          className="bg-white text-black rounded-xl p-6 hover:bg-gray-100 transition group"
        >
          <Hexagon size={22} className="mb-3 text-black/40" />
          <h3 className="font-display font-semibold">3D Simulation</h3>
          <p className="text-sm text-black/50 mt-1">Run predictive 3D visualization</p>
        </Link>
        <Link
          to="/crm"
          className="bg-surface-2 border border-white/5 rounded-xl p-6 hover:border-white/10 transition group"
        >
          <MessageSquare size={22} className="text-gray-500 mb-3 group-hover:text-white transition" />
          <h3 className="font-display font-semibold text-white group-hover:text-white transition">AI Clinical CRM</h3>
          <p className="text-sm text-gray-600 mt-1">Post-op follow-ups, recalls, and aligner tracking</p>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-surface-2 border border-white/5 rounded-xl p-5">
      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center mb-3">
        <Icon size={18} className={accent === 'red' ? 'text-red-400' : accent === 'amber' ? 'text-amber-400' : accent === 'green' ? 'text-green-400' : 'text-gray-400'} />
      </div>
      <p className="text-2xl font-display font-bold text-white">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
