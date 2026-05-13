/* ──────────────────────────────────────────────────────────────────────
   exportCaseReport — generates a patient-facing case report as a
   printable HTML doc and opens it in a new tab. From there the user
   can hit Ctrl+P → "Save as PDF" to email / print it.

   Why HTML+print and not jsPDF: jsPDF would add ~250 KB to the bundle
   for what's essentially a styled document. Browser-native print
   honors any CSS and produces pixel-perfect output with zero deps.
─────────────────────────────────────────────────────────────────────── */

const TREATMENT_LABELS = {
  filling: 'Composite Filling',
  inlay: 'Inlay / Onlay',
  crown: 'Full Ceramic Crown',
  rct: 'Root Canal Therapy + Crown',
  extraction: 'Extraction',
  implant: 'Dental Implant + Crown',
  veneer: 'Porcelain Veneer',
  no_treatment: 'No Treatment Recommended',
};
const STAGE_LABELS = {
  enamel:   'Stage 1 — Enamel Decay',
  dentin:   'Stage 2 — Dentin Involvement',
  pulp:     'Stage 3 — Pulp Exposure',
  periapex: 'Stage 4 — Periapical Infection',
  loss:     'Stage 5 — Tooth Loss',
};
const STAGE_DESCRIPTIONS = {
  enamel:   'Initial decay confined to enamel. Early treatment prevents further progression.',
  dentin:   'Decay has reached the softer dentin. Sensitivity to cold/sweet is common.',
  pulp:     'Bacteria have reached the pulp chamber. Severe pain. Endodontic treatment is required.',
  periapex: 'Infection has breached the apex. Bone destruction is forming around the root.',
  loss:     'Tooth is non-restorable; extraction and replacement are indicated.',
};

export function exportCaseReport({ simulation, patient, stageId, treatmentId, pickedTooth, setExporting, setToast }) {
  if (!patient) {
    setToast?.({ type: 'err', msg: 'No patient context — cannot generate report.' });
    setTimeout(() => setToast?.(null), 3000);
    return;
  }
  setExporting?.(true);
  setTimeout(() => setExporting?.(false), 2000);
  try {
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
    if (!win) {
      setToast?.({ type: 'err', msg: 'Pop-up blocked — allow pop-ups to export.' });
      setTimeout(() => setToast?.(null), 3500);
      setExporting?.(false);
      return;
    }
    const caseId  = `LUME-${(simulation?.id || '0000').toString().slice(-6).toUpperCase()}`;
    const issued  = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const stage   = STAGE_LABELS[stageId]   || '—';
    const treat   = TREATMENT_LABELS[treatmentId] || '—';
    const stageDesc = STAGE_DESCRIPTIONS[stageId] || '';

    const html = `<!doctype html><html><head>
<meta charset="utf-8" />
<title>LumeDental Case Report — ${caseId}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:40px 56px;font-family:'Inter',system-ui,-apple-system,sans-serif;color:#1a1f2c;background:#fff;line-height:1.5}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #14a892;padding-bottom:16px;margin-bottom:28px}
  .brand{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:22px;color:#14a892;letter-spacing:-0.01em}
  .brand small{display:block;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#697184;font-weight:500;margin-top:4px}
  .meta{font-size:11px;color:#697184;text-align:right}
  .meta b{color:#1a1f2c;font-weight:600}
  h1{font-family:'Space Grotesk',sans-serif;font-size:24px;margin:0 0 4px;color:#1a1f2c;letter-spacing:-0.01em}
  h2{font-family:'Space Grotesk',sans-serif;font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#0e8a7a;margin:28px 0 12px}
  .section{margin-bottom:20px}
  .row{display:grid;grid-template-columns:160px 1fr;gap:14px;padding:8px 0;border-bottom:1px solid #eef0f4;font-size:13px}
  .row .k{color:#697184;font-weight:500}
  .row .v{color:#1a1f2c;font-weight:600}
  .stage-card{background:#f5fdfb;border:1px solid #95ecdd;border-radius:10px;padding:16px 18px;margin-top:8px}
  .stage-card .label{font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#0e8a7a;font-weight:600}
  .stage-card .title{font-size:18px;font-weight:700;margin:4px 0 8px}
  .stage-card .desc{font-size:13px;color:#3a4255}
  .plan{background:#fff5e8;border:1px solid #f5cb83;border-radius:10px;padding:16px 18px;margin-top:8px}
  .plan .label{font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#a06914;font-weight:600}
  .plan .title{font-size:18px;font-weight:700;margin:4px 0 8px;color:#1a1f2c}
  .plan .desc{font-size:13px;color:#5a5240}
  .footer{margin-top:36px;padding-top:16px;border-top:1px solid #eef0f4;font-size:10px;color:#9099ad;text-align:center}
  .signature-block{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:36px}
  .signature-line{border-top:1px solid #4a5160;padding-top:6px;font-size:11px;color:#697184}
  @media print { body{padding:24px 32px} }
</style>
</head><body>

<div class="header">
  <div>
    <div class="brand">LumeDental
      <small>3D Predictive Dental Platform</small>
    </div>
  </div>
  <div class="meta">
    <b>Case Report</b><br/>
    Case ID: <b>${caseId}</b><br/>
    Issued: <b>${issued}</b>
  </div>
</div>

<h1>Patient Case Summary</h1>
<p style="margin:0 0 24px;color:#697184;font-size:13px">3D simulation-based diagnosis and treatment recommendation</p>

<h2>Patient Information</h2>
<div class="section">
  <div class="row"><span class="k">Name</span><span class="v">${escapeHtml(`${patient.first_name || ''} ${patient.last_name || ''}`)}</span></div>
  ${patient.date_of_birth ? `<div class="row"><span class="k">Date of Birth</span><span class="v">${new Date(patient.date_of_birth).toLocaleDateString()}</span></div>` : ''}
  ${patient.email ? `<div class="row"><span class="k">Email</span><span class="v">${escapeHtml(patient.email)}</span></div>` : ''}
  ${patient.phone ? `<div class="row"><span class="k">Phone</span><span class="v">${escapeHtml(patient.phone)}</span></div>` : ''}
  <div class="row"><span class="k">Affected Tooth (FDI)</span><span class="v">#${pickedTooth || (simulation?.target_teeth?.[0]) || '—'}</span></div>
</div>

<h2>Clinical Findings</h2>
<div class="stage-card">
  <div class="label">Disease Stage</div>
  <div class="title">${escapeHtml(stage)}</div>
  <div class="desc">${escapeHtml(stageDesc)}</div>
</div>

<h2>Recommended Treatment</h2>
<div class="plan">
  <div class="label">Treatment Plan</div>
  <div class="title">${escapeHtml(treat)}</div>
  <div class="desc">Based on the predicted disease progression and the affected tooth's clinical metrics, the recommended intervention is <b>${escapeHtml(treat.toLowerCase())}</b>. Please discuss expected duration, cost, and post-operative care with your dentist.</div>
</div>

<h2>Simulation Context</h2>
<div class="section">
  <div class="row"><span class="k">Clinician Prompt</span><span class="v">${escapeHtml(simulation?.clinician_prompt || '—')}</span></div>
  <div class="row"><span class="k">Module</span><span class="v">${escapeHtml((simulation?.module || '—').replace(/_/g, ' '))}</span></div>
  <div class="row"><span class="k">Simulation States</span><span class="v">${simulation?.states?.length || 0}</span></div>
  <div class="row"><span class="k">Generated</span><span class="v">${simulation?.created_at ? new Date(simulation.created_at).toLocaleString() : issued}</span></div>
</div>

<div class="signature-block">
  <div class="signature-line">Patient Signature &amp; Date</div>
  <div class="signature-line">Treating Dentist &amp; Date</div>
</div>

<div class="footer">
  This is a software-generated case summary from LumeDental's 3D predictive simulation. It is intended for patient education and treatment planning, and is not a substitute for a clinical diagnosis by a licensed dentist. ${issued}
</div>

<script>
  // Open the print dialog automatically — user can save as PDF or print.
  window.addEventListener('load', () => { setTimeout(() => window.print(), 350); });
</script>

</body></html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
    setToast?.({ type: 'ok', msg: 'Report opened — use Print → Save as PDF.' });
    setTimeout(() => setToast?.(null), 3500);
  } catch (e) {
    setToast?.({ type: 'err', msg: 'Failed to generate report.' });
    setTimeout(() => setToast?.(null), 3500);
  } finally {
    setTimeout(() => setExporting?.(false), 500);
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
