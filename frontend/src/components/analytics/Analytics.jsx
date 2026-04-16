import { useMemo } from 'react';
import { TrendingUp, DollarSign, Users, Activity, Award, ArrowUp, ArrowDown } from 'lucide-react';

/**
 * Practice Analytics — revenue, production, and KPI dashboard.
 * All charts are pure SVG so there's no chart-library dependency.
 */

const REVENUE_BY_MONTH = [
  { month: 'Apr', revenue: 142000, prod: 168000, collections: 138000 },
  { month: 'May', revenue: 156000, prod: 182000, collections: 152000 },
  { month: 'Jun', revenue: 148000, prod: 174000, collections: 145000 },
  { month: 'Jul', revenue: 172000, prod: 198000, collections: 168000 },
  { month: 'Aug', revenue: 184000, prod: 215000, collections: 178000 },
  { month: 'Sep', revenue: 168000, prod: 192000, collections: 162000 },
  { month: 'Oct', revenue: 195000, prod: 228000, collections: 188000 },
  { month: 'Nov', revenue: 208000, prod: 242000, collections: 201000 },
  { month: 'Dec', revenue: 178000, prod: 205000, collections: 174000 },
  { month: 'Jan', revenue: 222000, prod: 258000, collections: 215000 },
  { month: 'Feb', revenue: 234000, prod: 272000, collections: 226000 },
  { month: 'Mar', revenue: 248000, prod: 285000, collections: 240000 },
];

const PROCEDURES = [
  { name: 'Composite Restoration', count: 142, revenue: 56800, color: '#60a5fa' },
  { name: 'Crown',                  count: 38,  revenue: 68400, color: '#34d399' },
  { name: 'Aligner Tx',             count: 14,  revenue: 84000, color: '#f472b6' },
  { name: 'RCT',                    count: 22,  revenue: 33000, color: '#fbbf24' },
  { name: 'Implant',                count: 9,   revenue: 40500, color: '#a78bfa' },
  { name: 'Prophy / Hygiene',       count: 287, revenue: 28700, color: '#22d3ee' },
];

const PRODUCERS = [
  { name: 'Dr. Rivera',  prod: 98000,  collections: 92000, util: 87 },
  { name: 'Dr. Chen',    prod: 86000,  collections: 81000, util: 78 },
  { name: 'Dr. Patel',   prod: 74000,  collections: 71000, util: 82 },
  { name: 'RDH Morgan',  prod: 27000,  collections: 26000, util: 95 },
];

export default function Analytics() {
  const stats = useMemo(() => {
    const cur = REVENUE_BY_MONTH[REVENUE_BY_MONTH.length - 1];
    const prev = REVENUE_BY_MONTH[REVENUE_BY_MONTH.length - 2];
    const ytd = REVENUE_BY_MONTH.slice(-3).reduce((s, m) => s + m.revenue, 0);
    return {
      mtd: cur.revenue,
      mtdDelta: ((cur.revenue - prev.revenue) / prev.revenue) * 100,
      ytd,
      newPatients: 47,
      newPatientsDelta: 12,
      casesAccepted: 78,
      caseAcceptDelta: 4,
      avgProduction: cur.prod,
      avgProdDelta: ((cur.prod - prev.prod) / prev.prod) * 100,
    };
  }, []);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <TrendingUp size={22} className="text-lume-400" />
            Practice Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">Last 12 months · Updated just now</p>
        </div>
        <div className="flex gap-2">
          {['7D', '30D', '90D', 'YTD', 'All'].map((p, i) => (
            <button key={p} className={`px-3 py-1.5 text-xs rounded-lg border transition ${
              i === 4 ? 'bg-white text-black border-white font-semibold' : 'border-white/10 text-gray-400 hover:bg-white/5'
            }`}>{p}</button>
          ))}
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={DollarSign} label="MTD Revenue" value={`$${(stats.mtd / 1000).toFixed(0)}k`} delta={stats.mtdDelta} accent="#4ade80" />
        <KpiCard icon={Activity} label="MTD Production" value={`$${(stats.avgProduction / 1000).toFixed(0)}k`} delta={stats.avgProdDelta} accent="#60a5fa" />
        <KpiCard icon={Users} label="New Patients" value={stats.newPatients} delta={stats.newPatientsDelta} accent="#f472b6" />
        <KpiCard icon={Award} label="Case Acceptance" value={`${stats.casesAccepted}%`} delta={stats.caseAcceptDelta} accent="#fbbf24" />
      </div>

      {/* Revenue Chart */}
      <div className="bg-surface-2 border border-white/5 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-display font-semibold text-white">Revenue & Production</h2>
            <p className="text-[11px] text-gray-500">Trailing 12 months</p>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <Legend color="#4ade80" label="Revenue" />
            <Legend color="#60a5fa" label="Production" />
            <Legend color="#a78bfa" label="Collections" />
          </div>
        </div>
        <RevenueChart data={REVENUE_BY_MONTH} />
      </div>

      {/* Procedure Mix + Producers */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-2 border border-white/5 rounded-xl p-6">
          <h2 className="text-sm font-display font-semibold text-white mb-1">Top Procedures</h2>
          <p className="text-[11px] text-gray-500 mb-5">Last 30 days · By revenue</p>
          <div className="space-y-3">
            {PROCEDURES.map((p) => {
              const max = Math.max(...PROCEDURES.map((x) => x.revenue));
              const pct = (p.revenue / max) * 100;
              return (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                      <span className="text-gray-300">{p.name}</span>
                      <span className="text-gray-600 text-[10px]">{p.count} cases</span>
                    </div>
                    <span className="text-white font-medium tabular-nums">${(p.revenue / 1000).toFixed(1)}k</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${p.color}80, ${p.color})` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-surface-2 border border-white/5 rounded-xl p-6">
          <h2 className="text-sm font-display font-semibold text-white mb-1">Provider Production</h2>
          <p className="text-[11px] text-gray-500 mb-5">This month · MTD</p>
          <div className="space-y-4">
            {PRODUCERS.map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-white/15 to-white/5 border border-white/10 flex items-center justify-center text-[11px] text-white font-bold">
                  {p.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{p.name}</span>
                    <span className="text-sm text-white tabular-nums">${(p.prod / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-400 to-emerald-400" style={{ width: `${p.util}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 tabular-nums">{p.util}% util</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, delta, accent }) {
  const positive = delta >= 0;
  return (
    <div className="bg-surface-2 border border-white/5 rounded-xl p-5 relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10" style={{ background: accent }} />
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-gray-500" />
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-display font-bold text-white">{value}</div>
      <div className={`flex items-center gap-1 text-[11px] mt-1 ${positive ? 'text-green-400' : 'text-red-400'}`}>
        {positive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
        {Math.abs(delta).toFixed(1)}% vs last month
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-gray-400">{label}</span>
    </div>
  );
}

function RevenueChart({ data }) {
  const W = 800;
  const H = 240;
  const PAD = { l: 40, r: 12, t: 12, b: 24 };
  const max = Math.max(...data.flatMap((d) => [d.revenue, d.prod, d.collections]));
  const min = 0;
  const xStep = (W - PAD.l - PAD.r) / (data.length - 1);

  const yScale = (v) => H - PAD.b - ((v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const path = (key) => data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${PAD.l + i * xStep} ${yScale(d[key])}`).join(' ');
  const area = (key) => `${path(key)} L ${PAD.l + (data.length - 1) * xStep} ${H - PAD.b} L ${PAD.l} ${H - PAD.b} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[240px]">
      <defs>
        <linearGradient id="grad-rev" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grad-prod" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + t * (H - PAD.t - PAD.b)} y2={PAD.t + t * (H - PAD.t - PAD.b)}
            stroke="#ffffff" strokeOpacity="0.05" strokeDasharray="2 2" />
          <text x={PAD.l - 6} y={PAD.t + t * (H - PAD.t - PAD.b) + 3} fontSize="9" fill="#666" textAnchor="end">
            ${Math.round((max * (1 - t)) / 1000)}k
          </text>
        </g>
      ))}

      {/* Areas */}
      <path d={area('prod')} fill="url(#grad-prod)" />
      <path d={area('revenue')} fill="url(#grad-rev)" />

      {/* Lines */}
      <path d={path('prod')} stroke="#60a5fa" strokeWidth="1.5" fill="none" />
      <path d={path('collections')} stroke="#a78bfa" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />
      <path d={path('revenue')} stroke="#4ade80" strokeWidth="2" fill="none" />

      {/* Points + labels */}
      {data.map((d, i) => (
        <g key={d.month}>
          <circle cx={PAD.l + i * xStep} cy={yScale(d.revenue)} r="3" fill="#4ade80" stroke="#0a0a0d" strokeWidth="1.5" />
          <text x={PAD.l + i * xStep} y={H - 8} fontSize="9" fill="#666" textAnchor="middle">{d.month}</text>
        </g>
      ))}
    </svg>
  );
}
