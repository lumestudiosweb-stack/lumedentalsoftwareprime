import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { patientAPI, crmAPI } from '../../services/mockApi';
import { mockPatients } from '../../services/mockData';
import { Users, AlertTriangle, Clock, Activity, ArrowRight, Box, MessageSquare } from 'lucide-react';

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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back, Dr. Demo</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <StatCard icon={Users} label="Total Patients" value={stats.patients} color="blue" />
        <StatCard icon={AlertTriangle} label="Escalations" value={stats.escalations.length} color="red" />
        <StatCard icon={Clock} label="Due Follow-ups" value={stats.dueEvents.length} color="amber" />
        <StatCard icon={Activity} label="Simulations Run" value={4} color="green" />
      </div>

      {/* Escalations */}
      {stats.escalations.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-red-800 mb-3 flex items-center gap-2">
            <AlertTriangle size={20} /> Requires Immediate Attention
          </h2>
          <div className="space-y-2">
            {stats.escalations.map((e) => {
              const patient = mockPatients.find((p) => p.id === e.patient_id);
              return (
                <div key={e.id} className="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {patient ? `${patient.first_name} ${patient.last_name}` : 'Patient'}
                    </span>
                    <span className="text-sm text-red-600 ml-3">{e.escalation_reason}</span>
                    <p className="text-xs text-gray-500 mt-1 italic">"{e.patient_response?.slice(0, 80)}..."</p>
                  </div>
                  <Link to={`/patients/${e.patient_id}`} className="text-sm text-lume-600 hover:underline flex items-center gap-1">
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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <Clock size={20} /> Upcoming Follow-ups ({stats.dueEvents.length})
          </h2>
          <div className="space-y-2">
            {stats.dueEvents.map((e) => {
              const patient = mockPatients.find((p) => p.id === e.patient_id);
              return (
                <div key={e.id} className="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {patient ? `${patient.first_name} ${patient.last_name}` : 'Patient'}
                    </span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                      e.event_type === 'aligner_tray_change' ? 'bg-purple-100 text-purple-700'
                      : e.event_type === 'hygiene_recall_6m' ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                    }`}>
                      {e.event_type.replace(/_/g, ' ')}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">{e.message_template?.slice(0, 90)}...</p>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(e.scheduled_at).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          to="/patients"
          className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition group"
        >
          <Users size={24} className="text-lume-600 mb-3" />
          <h3 className="font-semibold text-gray-900 group-hover:text-lume-600 transition">Patient Records</h3>
          <p className="text-sm text-gray-500 mt-1">Search, view profiles, and manage clinical data</p>
        </Link>
        <Link
          to="/patients/p1"
          className="bg-gradient-to-br from-lume-600 to-lume-800 text-white rounded-xl p-6 hover:shadow-lg transition group"
        >
          <Box size={24} className="mb-3 opacity-80" />
          <h3 className="font-semibold">3D Simulation</h3>
          <p className="text-sm opacity-80 mt-1">Select a patient to run predictive 3D visualization</p>
        </Link>
        <Link
          to="/crm"
          className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition group"
        >
          <MessageSquare size={24} className="text-lume-600 mb-3" />
          <h3 className="font-semibold text-gray-900 group-hover:text-lume-600 transition">AI Clinical CRM</h3>
          <p className="text-sm text-gray-500 mt-1">Post-op follow-ups, recalls, and aligner tracking</p>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center mb-3`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
