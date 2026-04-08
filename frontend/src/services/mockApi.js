/**
 * Mock API layer — replaces real API calls with local demo data.
 * Every function returns a Promise that resolves like axios { data: ... }
 */
import {
  mockPatients, mockClinicalRecords, mockScans, mockTreatments,
  mockSimulations, mockCrmEvents, mockAlignerTracking,
} from './mockData';

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const wrap = async (data) => { await delay(); return { data }; };

// Auth
export const authAPI = {
  login: (d) => wrap({ token: 'dev-token', user: { id: 'dev-user', first_name: 'Dr. Demo', last_name: 'User', email: d.email, role: 'dentist' } }),
  register: (d) => wrap({ token: 'dev-token', user: { ...d, id: 'new-user', role: d.role || 'dentist' } }),
  me: () => wrap({ id: 'dev-user', first_name: 'Dr. Demo', last_name: 'User', email: 'demo@lumedental.com', role: 'dentist' }),
};

// Patients
export const patientAPI = {
  list: ({ limit = 50, offset = 0, search } = {}) => {
    let filtered = mockPatients;
    if (search) {
      const s = search.toLowerCase();
      filtered = mockPatients.filter((p) =>
        p.first_name.toLowerCase().includes(s) || p.last_name.toLowerCase().includes(s) || p.email.toLowerCase().includes(s)
      );
    }
    return wrap({ patients: filtered.slice(offset, offset + limit), total: filtered.length });
  },
  get: (id) => wrap(mockPatients.find((p) => p.id === id) || mockPatients[0]),
  getProfile: (id) => {
    const patient = mockPatients.find((p) => p.id === id) || mockPatients[0];
    return wrap({
      ...patient,
      clinicalRecords: mockClinicalRecords[id] || [],
      scans: mockScans[id] || [],
      treatments: mockTreatments[id] || [],
    });
  },
  create: (data) => wrap({ id: 'p-new-' + Date.now(), ...data, created_at: new Date().toISOString() }),
  update: (id, data) => wrap({ ...mockPatients.find((p) => p.id === id), ...data }),
  delete: (id) => wrap({ message: 'Patient archived' }),
};

// Clinical
export const clinicalAPI = {
  listByPatient: (pid) => wrap(mockClinicalRecords[pid] || []),
  getPerioChart: (pid) => wrap((mockClinicalRecords[pid] || []).filter((r) => r.pocket_depth_mm)),
  create: (pid, data) => wrap({ id: 'cr-new', patient_id: pid, ...data }),
  update: (id, data) => wrap({ id, ...data }),
};

// Scans
export const scanAPI = {
  listByPatient: (pid) => wrap(mockScans[pid] || []),
  get: (id) => {
    for (const scans of Object.values(mockScans)) {
      const s = scans.find((sc) => sc.id === id);
      if (s) return wrap({ ...s, meshes: [] });
    }
    return wrap(null);
  },
  upload: (pid, file) => {
    const newScan = {
      id: 's-new-' + Date.now(),
      patient_id: pid,
      status: 'ready',
      scan_type: 'intraoral',
      file_format: file.name.split('.').pop().toLowerCase(),
      original_filename: file.name,
      storage_path: URL.createObjectURL(file),
      arch: 'both',
      scan_date: new Date().toISOString(),
      quality_score: 'high',
      vertex_count: null,
      face_count: null,
      _file: file, // Keep reference for 3D viewer
    };
    if (!mockScans[pid]) mockScans[pid] = [];
    mockScans[pid].push(newScan);
    return wrap(newScan);
  },
  getMeshes: (id) => wrap([]),
};

/* ── Simulation state generators ───────────────────────────── */

const PATHWAYS = {
  cavity_composite: {
    module: 'caries_endo',
    simulation_type: 'comparison',
    states: (teeth) => [
      { id: 'g0', state_order: 0, label: 'Current — Healthy Tooth', clinical_metrics: { stage: 'initial', diagnosis: 'early_caries', depth_mm: 0 } },
      { id: 'g1', state_order: 1, label: '3 Months — Enamel Caries', clinical_metrics: { stage: 'enamel', depth_mm: 0.8, reversible: true, risk: 'low' } },
      { id: 'g2', state_order: 2, label: '6 Months — Dentin Caries', clinical_metrics: { stage: 'dentin', depth_mm: 2.5, risk: 'moderate', reversible: false } },
      { id: 'g3', state_order: 3, label: 'Post-Treatment — Composite Filling', clinical_metrics: { stage: 'restored', treatment: 'composite_filling', prognosis: 'excellent', material: 'composite_resin' } },
    ],
  },
  pulpitis_rct_crown: {
    module: 'caries_endo',
    simulation_type: 'treatment_outcome',
    states: (teeth) => [
      { id: 'g0', state_order: 0, label: 'Current — Deep Caries', clinical_metrics: { stage: 'dentin', depth_mm: 3.2, risk: 'high', pain: 'on_stimulus' } },
      { id: 'g1', state_order: 1, label: 'Progression — Irreversible Pulpitis', clinical_metrics: { stage: 'pulp', vitality: 'compromised', pain: 'spontaneous', needs_rct: true } },
      { id: 'g2', state_order: 2, label: 'If Untreated — Periapical Abscess', clinical_metrics: { stage: 'abscess', infection: true, swelling: true, pain: 'severe', needs_extraction_if_delayed: true } },
      { id: 'g3', state_order: 3, label: 'Treatment — Root Canal', clinical_metrics: { stage: 'endodontic', treatment: 'root_canal', canals_obturated: true, pain: 'none' } },
      { id: 'g4', state_order: 4, label: 'Final — Zirconia Crown', clinical_metrics: { stage: 'restored', treatment: 'zirconia_crown', prognosis: 'excellent', crown_type: 'zirconia', aesthetics: 'excellent' } },
    ],
  },
  caries_progression: {
    module: 'caries_endo',
    simulation_type: 'disease_progression',
    states: (teeth) => [
      { id: 'g0', state_order: 0, label: 'Current State', clinical_metrics: { stage: 'initial', depth_mm: 0 } },
      { id: 'g1', state_order: 1, label: '3 Months — Enamel Demineralization', clinical_metrics: { stage: 'enamel', depth_mm: 0.6, reversible: true } },
      { id: 'g2', state_order: 2, label: '6 Months — Dentin Involvement', clinical_metrics: { stage: 'dentin', depth_mm: 2.0, risk: 'moderate' } },
      { id: 'g3', state_order: 3, label: '12 Months — Pulp Exposure', clinical_metrics: { stage: 'pulp', depth_mm: 4.0, pain: 'severe', needs_rct: true } },
      { id: 'g4', state_order: 4, label: '18 Months — Abscess Formation', clinical_metrics: { stage: 'abscess', infection: true, swelling: true, bone_loss: true } },
    ],
  },
  extraction: {
    module: 'surgery_3rd_molar',
    simulation_type: 'treatment_outcome',
    states: (teeth) => [
      { id: 'g0', state_order: 0, label: 'Current — Impacted / Damaged Tooth', clinical_metrics: { stage: 'initial', condition: 'non_restorable' } },
      { id: 'g1', state_order: 1, label: 'Extraction Procedure', clinical_metrics: { stage: 'extracted', procedure: 'extraction' } },
      { id: 'g2', state_order: 2, label: '4 Weeks — Socket Healing', clinical_metrics: { stage: 'extracted', healing_weeks: 4, bone_fill_pct: 60 } },
    ],
  },
  perio_treatment: {
    module: 'perio',
    simulation_type: 'comparison',
    states: (teeth) => [
      { id: 'g0', state_order: 0, label: 'Current — Periodontal Disease', clinical_metrics: { stage: 'initial', pocket_depth_mm: 6.0, bone_loss_mm: 4.5, mobility: 'Grade I' } },
      { id: 'g1', state_order: 1, label: '12 Months Untreated — Severe Recession', clinical_metrics: { pocket_depth_mm: 9.0, bone_loss_mm: 7.0, recession_mm: 5.0, root_exposure: true, tooth_loss_risk: 'high' } },
      { id: 'g2', state_order: 2, label: 'Post-SRP + Maintenance', clinical_metrics: { pocket_depth_mm: 3.5, bone_loss_mm: 4.5, recession_mm: 1.5, prognosis: 'good' } },
    ],
  },
  crown_only: {
    module: 'caries_endo',
    simulation_type: 'treatment_outcome',
    states: (teeth) => [
      { id: 'g0', state_order: 0, label: 'Current — Damaged Tooth', clinical_metrics: { stage: 'initial', condition: 'fractured_or_worn' } },
      { id: 'g1', state_order: 1, label: 'Tooth Preparation', clinical_metrics: { stage: 'endodontic', preparation: 'crown_prep' } },
      { id: 'g2', state_order: 2, label: 'Final — Zirconia Crown Seated', clinical_metrics: { stage: 'restored', treatment: 'zirconia_crown', prognosis: 'excellent', crown_type: 'zirconia' } },
    ],
  },
};

function detectPathway(prompt) {
  const p = prompt.toLowerCase();
  if ((p.includes('pulpitis') || p.includes('rct') || p.includes('root canal')) && (p.includes('crown') || p.includes('zirconia'))) return 'pulpitis_rct_crown';
  if (p.includes('root canal') || p.includes('rct')) return 'pulpitis_rct_crown';
  if (p.includes('composite') || p.includes('filling')) return 'cavity_composite';
  if (p.includes('extract') || p.includes('impact')) return 'extraction';
  if (p.includes('perio') || p.includes('gum') || p.includes('pocket') || p.includes('recession')) return 'perio_treatment';
  if (p.includes('crown') || p.includes('zirconia')) return 'crown_only';
  if (p.includes('caries') || p.includes('cavity') || p.includes('decay')) return 'caries_progression';
  if (p.includes('abscess')) return 'pulpitis_rct_crown';
  return 'caries_progression'; // default
}

function extractTeeth(prompt) {
  const matches = prompt.match(/#(\d{2})/g);
  if (matches) return matches.map((m) => parseInt(m.slice(1)));
  const numMatches = prompt.match(/tooth\s*(\d{2})/gi);
  if (numMatches) return numMatches.map((m) => parseInt(m.match(/\d{2}/)[0]));
  return [36]; // default tooth
}

// Simulations
export const simulationAPI = {
  listByPatient: (pid) => wrap(mockSimulations[pid] || []),
  get: (id) => {
    for (const sims of Object.values(mockSimulations)) {
      const s = sims.find((sim) => sim.id === id);
      if (s) return wrap(s);
    }
    return wrap(null);
  },
  getStates: (id) => {
    for (const sims of Object.values(mockSimulations)) {
      const s = sims.find((sim) => sim.id === id);
      if (s) return wrap(s.states);
    }
    return wrap([]);
  },
  create: (data) => {
    const prompt = data.clinician_prompt || '';
    const pathwayKey = data.pathway || detectPathway(prompt);
    const pathway = PATHWAYS[pathwayKey] || PATHWAYS.caries_progression;
    const teeth = data.target_teeth || extractTeeth(prompt);
    const ts = Date.now();

    const states = pathway.states(teeth).map((s, i) => ({
      ...s,
      id: `ns-${ts}-${i}`,
    }));

    const newSim = {
      id: 'sim-new-' + ts,
      patient_id: data.patient_id,
      parent_scan_id: data.parent_scan_id,
      clinician_prompt: prompt,
      simulation_type: data.simulation_type || pathway.simulation_type,
      module: data.module || pathway.module,
      target_teeth: teeth,
      status: 'completed',
      progress_percent: 100,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      processing_time_ms: 2500,
      parsed_intent: { module: pathway.module, target_teeth: teeth, pathway: pathwayKey },
      states,
    };

    const pid = data.patient_id;
    if (!mockSimulations[pid]) mockSimulations[pid] = [];
    mockSimulations[pid].push(newSim);
    return wrap(newSim);
  },
};

// Treatments
export const treatmentAPI = {
  listByPatient: (pid) => wrap(mockTreatments[pid] || []),
  create: (pid, data) => wrap({ id: 't-new', patient_id: pid, ...data, status: 'proposed' }),
  complete: (id) => wrap({ id, status: 'completed', message: 'Treatment completed. Post-op follow-up events scheduled.' }),
};

// CRM
export const crmAPI = {
  listByPatient: (pid) => wrap(mockCrmEvents.filter((e) => e.patient_id === pid)),
  getEscalations: () => wrap(mockCrmEvents.filter((e) => e.requires_escalation)),
  getDue: () => wrap(mockCrmEvents.filter((e) => e.status === 'scheduled')),
  recordResponse: (id, response) => wrap({ id, status: 'responded', patient_response: response }),
  create: (data) => wrap({ id: 'ev-new', ...data }),
};

// Aligners
export const alignerAPI = {
  getStatus: (pid) => {
    const data = mockAlignerTracking[pid];
    if (!data) return Promise.reject({ response: { data: { error: 'No tracking found' } } });
    return wrap(data);
  },
  getHistory: (pid) => wrap(mockAlignerTracking[pid]?.history || []),
  start: (pid, data) => wrap({ id: 'at-new', patient_id: pid, current_tray_number: 1, ...data }),
  submitFitPhoto: (pid) => wrap({ fit_status: 'good', gap_measurement_mm: 0.35, ai_recommendation: 'Gap: 0.35mm. Fit looks great. Continue as prescribed.' }),
  advance: (pid) => {
    const data = mockAlignerTracking[pid];
    if (data) data.current_tray_number += 1;
    return wrap(data);
  },
};
