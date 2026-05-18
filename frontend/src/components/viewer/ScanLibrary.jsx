import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Filter, FileBox, Loader2, ExternalLink, Database, Inbox } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────
   ScanLibrary — full-screen modal that lets the user browse all real
   anonymized patient scans hosted on Cloudflare R2 (or wherever), filter
   by arch, search by ID, and load one into the active viewer.

   Reads the manifest from /scans/manifest.json which is a static asset
   committed to the repo. Each entry is a URL to a public mesh file —
   no patient data crosses the wire.

   Empty / error states are handled explicitly so adding the feature
   doesn't break the app before any scans exist.
─────────────────────────────────────────────────────────────────────── */

const ARCH_FILTERS = [
  { id: 'all',     label: 'All' },
  { id: 'upper',   label: 'Upper' },
  { id: 'lower',   label: 'Lower' },
  { id: 'full',    label: 'Full mouth' },
  { id: 'unknown', label: 'Unsorted' },
];

export default function ScanLibrary({ open, onClose, onLoadScan }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scans, setScans] = useState([]);
  const [archFilter, setArchFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Fetch the manifest whenever the modal is opened (re-fetch every
  // open so newly-added scans show up without a full page refresh).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/scans/manifest.json', { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.scans) ? data.scans : [];
        // Defensive: filter out entries missing required fields so a
        // malformed manifest can't crash the grid.
        const valid = list.filter((s) => s && s.id && s.url && s.format);
        setScans(valid);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || 'Failed to load manifest');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scans.filter((s) => {
      if (archFilter !== 'all' && (s.arch || 'unknown') !== archFilter) return false;
      if (q && !s.id.toLowerCase().includes(q) && !(s.label || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [scans, archFilter, search]);

  if (!open) return null;

  // Counts per arch (for the filter chips)
  const counts = scans.reduce((acc, s) => {
    const a = s.arch || 'unknown';
    acc[a] = (acc[a] || 0) + 1;
    return acc;
  }, {});

  // Portal to body + max int32 z-index so the modal sits ABOVE drei's
  // auto-z-indexed <Html> overlays (clinical badges, marker pickers,
  // etc.) coming out of the DentalViewer Canvas behind it.
  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background: 'rgba(2,2,6,0.85)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div className="w-full max-w-5xl h-[80vh] bg-surface-1 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5 bg-surface-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center">
              <Database size={14} className="text-teal-300" />
            </div>
            <div>
              <div className="text-sm font-display font-semibold text-white">Scan Library</div>
              <div className="text-[10px] text-gray-500">
                {loading ? 'Loading…' : `${scans.length} scan${scans.length === 1 ? '' : 's'} available`}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center" aria-label="Close library">
            <X size={16} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID or label…"
              className="w-full bg-surface-2 border border-white/8 rounded-md pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-teal-400/40"
            />
          </div>
          <Filter size={12} className="text-gray-500" />
          <div className="flex items-center gap-1">
            {ARCH_FILTERS.map((f) => {
              const active = archFilter === f.id;
              const count = f.id === 'all' ? scans.length : (counts[f.id] || 0);
              return (
                <button
                  key={f.id}
                  onClick={() => setArchFilter(f.id)}
                  className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition ${
                    active
                      ? 'bg-teal-500/15 border border-teal-400/40 text-teal-200'
                      : 'border border-white/8 text-gray-400 hover:text-white hover:border-white/15'
                  }`}
                >
                  {f.label}
                  <span className={`ml-1 text-[9px] ${active ? 'text-teal-300' : 'text-gray-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && <CenteredHint icon={<Loader2 className="animate-spin" size={22} />} text="Loading scan manifest…" />}
          {error && !loading && (
            <CenteredHint
              icon={<Inbox size={22} className="text-amber-400" />}
              text={`Could not load /scans/manifest.json — ${error}`}
              sub="Check that the file exists at frontend/public/scans/manifest.json."
            />
          )}
          {!loading && !error && scans.length === 0 && (
            <CenteredHint
              icon={<FileBox size={32} className="text-gray-600" />}
              text="No scans in the library yet."
              sub={
                <>
                  Add entries to <code className="bg-surface-2 px-1.5 py-0.5 rounded text-teal-200 text-[10px]">/scans/manifest.json</code>.
                  See <code className="bg-surface-2 px-1.5 py-0.5 rounded text-teal-200 text-[10px]">/scans/README.md</code> for the schema +
                  Cloudflare R2 upload instructions.
                </>
              }
            />
          )}
          {!loading && !error && scans.length > 0 && filtered.length === 0 && (
            <CenteredHint
              icon={<Search size={22} className="text-gray-600" />}
              text="No scans match your filter."
              sub="Try a different arch filter or clear the search."
            />
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((s) => (
                <ScanCard
                  key={s.id}
                  scan={s}
                  onLoad={() => { onLoadScan?.(s); onClose?.(); }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 px-5 py-2.5 bg-surface-2 flex items-center justify-between text-[10px] text-gray-500">
          <span>{filtered.length} of {scans.length} shown</span>
          <span>Scans are anonymized via <code className="text-gray-400">scripts/anonymize_scans.py</code></span>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ScanCard({ scan, onLoad }) {
  const archColor = {
    upper:   'text-sky-300 border-sky-400/30 bg-sky-500/10',
    lower:   'text-amber-300 border-amber-400/30 bg-amber-500/10',
    full:    'text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-500/10',
    unknown: 'text-gray-400 border-white/10 bg-white/5',
  }[scan.arch || 'unknown'];

  return (
    <button
      onClick={onLoad}
      className="group bg-surface-2 border border-white/8 hover:border-teal-400/40 rounded-lg overflow-hidden text-left transition shadow-lg hover:shadow-[0_0_20px_rgba(20,184,166,0.20)]"
    >
      {/* Thumbnail placeholder — once we batch-render previews, swap to <img>. */}
      <div className="aspect-[4/3] bg-gradient-to-br from-surface-3 to-surface-1 flex items-center justify-center group-hover:from-teal-500/5 transition">
        <ToothMarkSVG />
      </div>
      <div className="p-2 space-y-1">
        <div className="text-[11px] font-semibold text-white truncate">{scan.label || scan.id}</div>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${archColor} font-medium`}>
            {(scan.arch || 'unsorted').toUpperCase()}
          </span>
          <span className="text-[9px] text-gray-600 uppercase tracking-wider">{scan.format}</span>
        </div>
        {scan.qualityNote && (
          <div className="text-[9px] text-gray-500">Quality: {scan.qualityNote}</div>
        )}
      </div>
    </button>
  );
}

function CenteredHint({ icon, text, sub }) {
  return (
    <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center px-8">
      <div className="mb-3">{icon}</div>
      <div className="text-sm text-gray-300 font-medium mb-1">{text}</div>
      {sub && <div className="text-[11px] text-gray-500 max-w-md leading-relaxed">{sub}</div>}
    </div>
  );
}

function ToothMarkSVG() {
  return (
    <svg viewBox="0 0 96 110" className="w-14 h-16 opacity-30 group-hover:opacity-60 transition">
      <defs>
        <linearGradient id="lib-tooth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8d8c2" />
          <stop offset="100%" stopColor="#7a6442" />
        </linearGradient>
      </defs>
      <path
        d="M 20 18 C 18 8, 30 4, 38 8 C 42 5, 50 5, 54 8 C 62 4, 74 8, 72 18 L 70 32 C 70 42, 65 70, 56 78 L 56 88 C 56 92, 50 92, 48 88 L 46 78 C 38 70, 22 42, 22 32 Z"
        fill="url(#lib-tooth)"
        stroke="rgba(0,0,0,0.4)"
        strokeWidth="0.7"
      />
    </svg>
  );
}
