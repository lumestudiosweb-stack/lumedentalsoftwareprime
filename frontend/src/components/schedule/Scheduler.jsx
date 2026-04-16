import { useState, useMemo } from 'react';
import { Calendar, Clock, User, Plus, ChevronLeft, ChevronRight, Circle } from 'lucide-react';

/**
 * Smart Scheduler — visual day view with chairs (operatories) as columns
 * and time slots as rows. Mock appointments are laid out as colored blocks.
 */

const CHAIRS = [
  { id: 'op-1', name: 'Op 1', color: '#60a5fa', dentist: 'Dr. Rivera' },
  { id: 'op-2', name: 'Op 2', color: '#34d399', dentist: 'Dr. Chen' },
  { id: 'op-3', name: 'Op 3', color: '#f472b6', dentist: 'Dr. Patel' },
  { id: 'op-4', name: 'Hygiene', color: '#fbbf24', dentist: 'RDH Morgan' },
];

const APPTS = [
  { id: 1, chair: 'op-1', start: 8, end: 9, patient: 'Aisha Rahman', procedure: 'Composite #14', status: 'in-progress' },
  { id: 2, chair: 'op-1', start: 9.5, end: 11, patient: 'James Okonkwo', procedure: 'Crown Prep #30', status: 'scheduled' },
  { id: 3, chair: 'op-1', start: 13, end: 14, patient: 'Maria Santos', procedure: 'Recall Exam', status: 'scheduled' },
  { id: 4, chair: 'op-1', start: 15, end: 16.5, patient: 'David Kim', procedure: 'RCT #19', status: 'scheduled' },

  { id: 5, chair: 'op-2', start: 8, end: 9, patient: 'Lily Wang', procedure: 'Scaling & Root Planing', status: 'completed' },
  { id: 6, chair: 'op-2', start: 9, end: 10.5, patient: 'Ben Ellis', procedure: 'Extraction #17', status: 'in-progress' },
  { id: 7, chair: 'op-2', start: 11, end: 12, patient: 'Sophia Lee', procedure: 'Emergency Exam', status: 'urgent' },
  { id: 8, chair: 'op-2', start: 14, end: 15, patient: 'Omar Hassan', procedure: 'Whitening Consult', status: 'scheduled' },

  { id: 9, chair: 'op-3', start: 8.5, end: 10, patient: 'Elena Petrov', procedure: 'Aligner Review', status: 'scheduled' },
  { id: 10, chair: 'op-3', start: 10.5, end: 12, patient: 'Noah Brooks', procedure: 'Impl. Consult', status: 'scheduled' },
  { id: 11, chair: 'op-3', start: 13, end: 15, patient: 'Grace Kim', procedure: 'Veneer Prep x4', status: 'scheduled' },

  { id: 12, chair: 'op-4', start: 8, end: 9, patient: 'Tom Harris', procedure: 'Prophy', status: 'completed' },
  { id: 13, chair: 'op-4', start: 9, end: 10, patient: 'Ava Thompson', procedure: 'Prophy + FL', status: 'completed' },
  { id: 14, chair: 'op-4', start: 10, end: 11, patient: 'Liam Park', procedure: 'Perio Maint.', status: 'in-progress' },
  { id: 15, chair: 'op-4', start: 11, end: 12, patient: 'Emma Davis', procedure: 'Prophy', status: 'scheduled' },
  { id: 16, chair: 'op-4', start: 13, end: 14, patient: 'Ryan Cho', procedure: 'SRP Q1', status: 'scheduled' },
  { id: 17, chair: 'op-4', start: 14, end: 15, patient: 'Isabella Ruiz', procedure: 'Prophy', status: 'scheduled' },
  { id: 18, chair: 'op-4', start: 15, end: 16, patient: 'Leo Martin', procedure: 'SRP Q2', status: 'scheduled' },
];

const HOURS = Array.from({ length: 10 }, (_, i) => 8 + i); // 8 AM → 5 PM
const HOUR_HEIGHT = 56; // px per hour

export default function Scheduler() {
  const [dateOffset, setDateOffset] = useState(0);
  const [selected, setSelected] = useState(null);

  const date = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dateOffset);
    return d;
  }, [dateOffset]);

  const stats = useMemo(() => {
    const total = APPTS.length;
    const completed = APPTS.filter((a) => a.status === 'completed').length;
    const inProgress = APPTS.filter((a) => a.status === 'in-progress').length;
    const urgent = APPTS.filter((a) => a.status === 'urgent').length;
    const chairHours = APPTS.reduce((sum, a) => sum + (a.end - a.start), 0);
    const totalChairHours = CHAIRS.length * HOURS.length;
    const utilization = Math.round((chairHours / totalChairHours) * 100);
    return { total, completed, inProgress, urgent, utilization };
  }, []);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <Calendar size={22} className="text-lume-400" />
            Schedule
          </h1>
          <p className="text-sm text-gray-500 mt-1">Operatory view · Drag to reschedule</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDateOffset((d) => d - 1)} className="p-2 rounded-lg border border-white/10 text-gray-400 hover:bg-white/5">
            <ChevronLeft size={16} />
          </button>
          <div className="bg-surface-2 border border-white/5 rounded-lg px-4 py-2 text-sm text-white font-medium min-w-[180px] text-center">
            {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <button onClick={() => setDateOffset((d) => d + 1)} className="p-2 rounded-lg border border-white/10 text-gray-400 hover:bg-white/5">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setDateOffset(0)} className="ml-2 px-3 py-2 text-xs text-gray-400 border border-white/10 rounded-lg hover:bg-white/5">
            Today
          </button>
          <button className="ml-2 bg-white text-black text-sm font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 hover:bg-gray-200">
            <Plus size={14} /> New
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <StatTile label="Total Appts" value={stats.total} accent="#ffffff" />
        <StatTile label="Completed" value={stats.completed} accent="#4ade80" />
        <StatTile label="In Chair" value={stats.inProgress} accent="#60a5fa" />
        <StatTile label="Urgent" value={stats.urgent} accent="#f87171" />
        <StatTile label="Chair Util." value={`${stats.utilization}%`} accent="#fbbf24" />
      </div>

      {/* Schedule Grid */}
      <div className="bg-surface-2 border border-white/5 rounded-xl overflow-hidden">
        {/* Chair headers */}
        <div className="grid sticky top-0 bg-surface-2 z-10 border-b border-white/5" style={{ gridTemplateColumns: `60px repeat(${CHAIRS.length}, 1fr)` }}>
          <div />
          {CHAIRS.map((c) => (
            <div key={c.id} className="px-3 py-3 border-l border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                <span className="text-sm font-semibold text-white">{c.name}</span>
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">{c.dentist}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${CHAIRS.length}, 1fr)` }}>
          {/* Time labels */}
          <div className="border-r border-white/5">
            {HOURS.map((h) => (
              <div key={h} className="text-[10px] text-gray-600 text-right pr-2 border-b border-white/5 flex items-start justify-end pt-1" style={{ height: HOUR_HEIGHT }}>
                {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
              </div>
            ))}
          </div>

          {/* Chair columns */}
          {CHAIRS.map((c) => (
            <div key={c.id} className="relative border-l border-white/5">
              {HOURS.map((h) => (
                <div key={h} className="border-b border-white/5" style={{ height: HOUR_HEIGHT }} />
              ))}
              {/* Appointment blocks */}
              {APPTS.filter((a) => a.chair === c.id).map((a) => (
                <AppointmentBlock key={a.id} appt={a} chair={c} selected={selected === a.id} onClick={() => setSelected(a.id === selected ? null : a.id)} />
              ))}
            </div>
          ))}

          {/* Now indicator (fake: at 10:30 AM) */}
          <NowLine />
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, accent }) {
  return (
    <div className="bg-surface-2 border border-white/5 rounded-xl px-4 py-3">
      <div className="text-[10px] text-gray-600 uppercase tracking-wider">{label}</div>
      <div className="text-xl font-display font-bold mt-0.5" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function AppointmentBlock({ appt, chair, selected, onClick }) {
  const top = (appt.start - 8) * HOUR_HEIGHT;
  const height = (appt.end - appt.start) * HOUR_HEIGHT - 2;

  const statusConfig = {
    'in-progress': { bg: chair.color + '30', border: chair.color, label: 'IN CHAIR', dot: chair.color },
    'completed':   { bg: '#1f3d2e', border: '#4ade80',  label: 'DONE',    dot: '#4ade80' },
    'urgent':      { bg: '#3d1f1f', border: '#f87171',  label: 'URGENT',  dot: '#f87171' },
    'scheduled':   { bg: '#1a1a1d', border: chair.color + '80', label: '',      dot: chair.color + '80' },
  };
  const s = statusConfig[appt.status];

  return (
    <div
      onClick={onClick}
      className={`absolute left-1 right-1 rounded-md px-2 py-1 cursor-pointer transition-all overflow-hidden ${selected ? 'ring-2 ring-white shadow-xl z-20' : 'hover:brightness-125'}`}
      style={{ top, height, background: s.bg, borderLeft: `3px solid ${s.border}` }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-white truncate">{appt.patient}</div>
        {s.label && (
          <span className="text-[8px] font-bold px-1 rounded" style={{ background: s.border + '20', color: s.border }}>
            {s.label}
          </span>
        )}
      </div>
      <div className="text-[10px] text-gray-400 truncate">{appt.procedure}</div>
      {height > 60 && (
        <div className="text-[9px] text-gray-500 mt-1 flex items-center gap-1">
          <Clock size={8} /> {formatTime(appt.start)} – {formatTime(appt.end)}
        </div>
      )}
    </div>
  );
}

function formatTime(h) {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  const ampm = hour >= 12 ? 'p' : 'a';
  const h12 = hour > 12 ? hour - 12 : hour;
  return `${h12}:${min.toString().padStart(2, '0')}${ampm}`;
}

function NowLine() {
  const now = 10.5; // demo: 10:30 AM
  const top = (now - 8) * HOUR_HEIGHT;
  return (
    <div className="absolute left-[60px] right-0 pointer-events-none z-10" style={{ top }}>
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        <div className="flex-1 h-px bg-red-500/70" />
      </div>
    </div>
  );
}
