import { useState, useEffect } from 'react';
import { crmAPI } from '../../services/mockApi';
import { AlertTriangle, Clock, CheckCircle, Send } from 'lucide-react';

export default function CrmDashboard() {
  const [tab, setTab] = useState('escalations');
  const [escalations, setEscalations] = useState([]);
  const [dueEvents, setDueEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [escRes, dueRes] = await Promise.all([crmAPI.getEscalations(), crmAPI.getDue()]);
        setEscalations(escRes.data);
        setDueEvents(dueRes.data);
      } catch {} finally { setLoading(false); }
    }
    load();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-display font-bold text-white mb-6">AI Clinical Coordinator</h1>
      <div className="flex gap-1 mb-6 bg-surface-2 rounded-lg p-1 w-fit">
        {[
          { key: 'escalations', label: 'Escalations', icon: AlertTriangle, count: escalations.length },
          { key: 'due', label: 'Due Follow-ups', icon: Clock, count: dueEvents.length },
        ].map(({ key, label, icon: Icon, count }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === key ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>
            <Icon size={14} />
            {label}
            {count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                key === 'escalations' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-600 py-10 text-center">Loading events...</div>
      ) : tab === 'escalations' ? (
        <EscalationList items={escalations} />
      ) : (
        <DueEventList items={dueEvents} />
      )}
    </div>
  );
}

function EscalationList({ items }) {
  if (items.length === 0) {
    return (
      <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-8 text-center">
        <CheckCircle className="mx-auto text-green-400 mb-2" size={32} />
        <p className="text-green-400 font-medium">No escalations</p>
        <p className="text-green-500/60 text-sm">All patients are responding well</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((event) => (
        <div key={event.id} className="bg-surface-2 border border-red-500/10 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-red-400" />
                <span className="font-medium text-white text-sm">{event.event_type.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-sm text-gray-400 mb-2">Patient response: <em>"{event.patient_response}"</em></p>
              <p className="text-sm text-red-400 font-medium">{event.escalation_reason}</p>
            </div>
            <span className="text-[11px] text-gray-600">{event.responded_at && new Date(event.responded_at).toLocaleString()}</span>
          </div>
          {event.response_analysis && (
            <div className="mt-3 pt-3 border-t border-white/5 text-sm">
              <span className="text-gray-500">AI Analysis: </span>
              <span className={`font-medium ${event.response_analysis.sentiment === 'negative' ? 'text-red-400' : 'text-gray-300'}`}>
                {event.response_analysis.sentiment}
              </span>
              {event.response_analysis.keywords && (
                <span className="text-gray-600 ml-2">
                  ({Object.entries(event.response_analysis.keywords).filter(([, v]) => v).map(([k]) => k).join(', ')})
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DueEventList({ items }) {
  if (items.length === 0) {
    return (
      <div className="bg-surface-2 border border-white/5 rounded-xl p-8 text-center">
        <Clock className="mx-auto text-gray-600 mb-2" size={32} />
        <p className="text-gray-400 font-medium">No pending follow-ups</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((event) => (
        <div key={event.id} className="bg-surface-2 border border-white/5 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="font-medium text-white text-sm">{event.event_type.replace(/_/g, ' ')}</span>
            <span className={`ml-3 text-[11px] px-2 py-0.5 rounded ${
              event.channel === 'sms' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
            }`}>{event.channel}</span>
            <p className="text-sm text-gray-600 mt-1">{event.message_template?.slice(0, 100)}...</p>
          </div>
          <button className="flex items-center gap-1 text-sm text-gray-400 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/5 transition">
            <Send size={12} /> Send Now
          </button>
        </div>
      ))}
    </div>
  );
}
