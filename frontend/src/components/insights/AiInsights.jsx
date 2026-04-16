import { useState } from 'react';
import { Sparkles, AlertTriangle, Heart, Brain, Phone, Mail, MessageSquare, ArrowRight, TrendingUp, Smile } from 'lucide-react';

/**
 * AI Insights Hub — predictive analytics & automated recommendations
 * powered by (mock) ML models. Smile scores, recall predictions, and
 * sentiment-driven escalations all live here.
 */

const AT_RISK = [
  { id: 1, name: 'Aisha Rahman', risk: 92, factors: ['Pocket depth ↑ 1.8mm', 'Smoker', '6mo overdue recall'], action: 'Schedule SRP this week', urgency: 'high' },
  { id: 2, name: 'David Kim',   risk: 78, factors: ['Dry mouth (Rx)', 'High caries index', 'Skipped fluoride'], action: 'Rx fluoride varnish + 3mo recall', urgency: 'high' },
  { id: 3, name: 'Sophia Lee',  risk: 64, factors: ['Bruxism worn occlusion', 'Cracked #14'], action: 'Night guard + crown consult', urgency: 'medium' },
  { id: 4, name: 'Omar Hassan', risk: 58, factors: ['Diabetic A1c 8.2', 'BoP 28%'], action: 'Coordinate with PCP, perio maint.', urgency: 'medium' },
  { id: 5, name: 'Lily Wang',   risk: 41, factors: ['New restoration #19', 'Mild gingivitis'], action: 'Verify hygiene compliance', urgency: 'low' },
];

const SMILE_SCORES = [
  { name: 'Grace Kim',     score: 96, change: +4, status: 'Veneer consult complete' },
  { name: 'Noah Brooks',   score: 88, change: +12, status: 'Aligner tray 14/24' },
  { name: 'Elena Petrov',  score: 84, change: +6, status: 'Aligner tray 8/18' },
  { name: 'Ben Ellis',     score: 71, change: -3, status: 'Post-op #17 healing' },
  { name: 'Maria Santos',  score: 68, change: +2, status: 'Hygiene maintenance' },
];

const RECALL_QUEUE = [
  { name: 'James Okonkwo', overdue: 14, type: '6-mo Prophy', confidence: 94, channel: 'sms' },
  { name: 'Tom Harris',    overdue: 8,  type: '6-mo Prophy', confidence: 91, channel: 'email' },
  { name: 'Ava Thompson',  overdue: 22, type: '4-mo Perio',  confidence: 96, channel: 'call' },
  { name: 'Liam Park',     overdue: 5,  type: 'Post-op chk', confidence: 88, channel: 'sms' },
];

const AI_BRIEFING = [
  { type: 'opportunity', text: '14 patients haven\'t booked their next hygiene visit. Estimated $4.2k in production.', icon: TrendingUp, color: '#4ade80' },
  { type: 'risk', text: '3 high-risk perio patients have not responded to last 2 outreach attempts.', icon: AlertTriangle, color: '#f87171' },
  { type: 'win', text: 'Case acceptance up 12% this month. Veneer presentations driving the bump.', icon: Sparkles, color: '#fbbf24' },
];

export default function AiInsights() {
  const [tab, setTab] = useState('risk');

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <Brain size={22} className="text-lume-400" />
            AI Insights
          </h1>
          <p className="text-sm text-gray-500 mt-1">Predictive intelligence · Models updated 3 min ago</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          12 models active
        </div>
      </div>

      {/* Daily AI briefing */}
      <div className="bg-gradient-to-br from-lume-400/10 via-surface-2 to-surface-2 border border-lume-400/20 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={14} className="text-lume-400" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-lume-400 uppercase">Today's AI Briefing</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {AI_BRIEFING.map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={i} className="flex items-start gap-3 bg-black/30 rounded-lg p-3 border border-white/5">
                <div className="p-1.5 rounded-md" style={{ background: b.color + '15' }}>
                  <Icon size={14} style={{ color: b.color }} />
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{b.text}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-surface-2 rounded-lg p-1 w-fit">
        {[
          { key: 'risk',   label: 'At-Risk Patients', icon: AlertTriangle },
          { key: 'smile',  label: 'Smile Scores',     icon: Smile },
          { key: 'recall', label: 'Smart Recall',     icon: Heart },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === key ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'risk'   && <RiskList items={AT_RISK} />}
      {tab === 'smile'  && <SmileBoard items={SMILE_SCORES} />}
      {tab === 'recall' && <RecallQueue items={RECALL_QUEUE} />}
    </div>
  );
}

function RiskList({ items }) {
  return (
    <div className="space-y-3">
      {items.map((p) => {
        const color = p.risk >= 80 ? '#f87171' : p.risk >= 60 ? '#fbbf24' : '#a3a3a3';
        return (
          <div key={p.id} className="bg-surface-2 border border-white/5 rounded-xl p-5 hover:border-white/10 transition">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <RiskRing value={p.risk} color={color} />
                <div>
                  <h3 className="text-sm font-display font-semibold text-white">{p.name}</h3>
                  <p className="text-[11px] text-gray-500 capitalize">{p.urgency} urgency</p>
                </div>
              </div>
              <button className="flex items-center gap-1.5 text-[11px] text-white bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 transition">
                Take action <ArrowRight size={11} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Risk Factors</div>
                <div className="flex flex-wrap gap-1.5">
                  {p.factors.map((f) => (
                    <span key={f} className="text-[10px] bg-white/5 text-gray-300 px-2 py-0.5 rounded border border-white/5">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Recommended</div>
                <p className="text-xs text-gray-300 italic">"{p.action}"</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RiskRing({ value, color }) {
  const r = 18, c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div className="relative">
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="3" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform="rotate(-90 22 22)" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">{value}</div>
    </div>
  );
}

function SmileBoard({ items }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((p) => {
        const positive = p.change >= 0;
        return (
          <div key={p.name} className="bg-surface-2 border border-white/5 rounded-xl p-5 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br from-lume-400/20 to-transparent" />
            <div className="flex items-center justify-between mb-3 relative">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Smile Score</p>
                <h3 className="text-sm font-display font-semibold text-white">{p.name}</h3>
              </div>
              <Smile size={18} className="text-lume-400" />
            </div>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-display font-bold text-white">{p.score}</span>
              <span className={`text-xs mb-1 font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>
                {positive ? '+' : ''}{p.change}
              </span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-gradient-to-r from-lume-500 to-lume-300 rounded-full" style={{ width: `${p.score}%` }} />
            </div>
            <p className="text-[11px] text-gray-500">{p.status}</p>
          </div>
        );
      })}
    </div>
  );
}

function RecallQueue({ items }) {
  const channelIcons = { sms: MessageSquare, email: Mail, call: Phone };
  const channelColors = { sms: '#60a5fa', email: '#a78bfa', call: '#fbbf24' };

  return (
    <div className="bg-surface-2 border border-white/5 rounded-xl overflow-hidden">
      <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-white/5 text-[10px] text-gray-600 uppercase tracking-wider">
        <div className="col-span-3">Patient</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-2">Overdue</div>
        <div className="col-span-2">AI Confidence</div>
        <div className="col-span-2">Channel</div>
        <div className="col-span-1 text-right">Action</div>
      </div>
      {items.map((r, i) => {
        const Icon = channelIcons[r.channel];
        return (
          <div key={i} className="grid grid-cols-12 gap-4 px-5 py-4 border-b border-white/5 last:border-0 items-center hover:bg-white/[0.02]">
            <div className="col-span-3 text-sm text-white font-medium">{r.name}</div>
            <div className="col-span-2 text-xs text-gray-400">{r.type}</div>
            <div className="col-span-2">
              <span className={`text-xs font-medium ${r.overdue > 14 ? 'text-red-400' : 'text-amber-400'}`}>
                {r.overdue} days
              </span>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden max-w-[60px]">
                <div className="h-full bg-gradient-to-r from-lume-500 to-lume-300" style={{ width: `${r.confidence}%` }} />
              </div>
              <span className="text-[11px] text-gray-400 tabular-nums">{r.confidence}%</span>
            </div>
            <div className="col-span-2">
              <span className="flex items-center gap-1.5 text-[11px] capitalize w-fit px-2 py-0.5 rounded-full border" style={{ color: channelColors[r.channel], borderColor: channelColors[r.channel] + '40', background: channelColors[r.channel] + '10' }}>
                <Icon size={10} /> {r.channel}
              </span>
            </div>
            <div className="col-span-1 text-right">
              <button className="text-[11px] bg-white text-black font-semibold px-2.5 py-1 rounded-md hover:bg-gray-200">
                Send
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
