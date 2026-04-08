// Complete mock data for the LumeDental platform demo

export const mockPatients = [
  {
    id: 'p1', first_name: 'Aisha', last_name: 'Rahman', date_of_birth: '1989-03-15',
    email: 'aisha.rahman@email.com', phone: '+91 98765 43210', gender: 'Female',
    insurance_provider: 'Star Health', insurance_id: 'SH-2024-88412',
    allergies: 'Penicillin', medical_history_notes: 'Mild hypertension, controlled with medication',
    facial_photo_url: null, created_at: '2024-11-01T10:00:00Z',
  },
  {
    id: 'p2', first_name: 'Rajesh', last_name: 'Kapoor', date_of_birth: '1975-08-22',
    email: 'rajesh.k@email.com', phone: '+91 87654 32109', gender: 'Male',
    insurance_provider: 'ICICI Lombard', insurance_id: 'IL-2024-55231',
    allergies: 'None', medical_history_notes: 'Type 2 Diabetes',
    facial_photo_url: null, created_at: '2024-10-15T09:30:00Z',
  },
  {
    id: 'p3', first_name: 'Priya', last_name: 'Sharma', date_of_birth: '1995-12-03',
    email: 'priya.sharma@email.com', phone: '+91 76543 21098', gender: 'Female',
    insurance_provider: 'Max Bupa', insurance_id: 'MB-2024-77890',
    allergies: 'Latex', medical_history_notes: 'No significant history',
    facial_photo_url: null, created_at: '2024-12-01T14:00:00Z',
  },
  {
    id: 'p4', first_name: 'Mohammed', last_name: 'Ali', date_of_birth: '1982-06-18',
    email: 'm.ali@email.com', phone: '+91 65432 10987', gender: 'Male',
    insurance_provider: 'Bajaj Allianz', insurance_id: 'BA-2024-33456',
    allergies: 'None', medical_history_notes: 'Smoker, 10 pack-years',
    facial_photo_url: null, created_at: '2024-09-20T11:00:00Z',
  },
  {
    id: 'p5', first_name: 'Sneha', last_name: 'Patel', date_of_birth: '2001-01-30',
    email: 'sneha.p@email.com', phone: '+91 54321 09876', gender: 'Female',
    insurance_provider: 'None', insurance_id: null,
    allergies: 'None', medical_history_notes: 'Orthodontic patient, aligner therapy in progress',
    facial_photo_url: null, created_at: '2025-01-10T16:00:00Z',
  },
  {
    id: 'p6', first_name: 'Vikram', last_name: 'Singh', date_of_birth: '1968-11-05',
    email: 'vikram.s@email.com', phone: '+91 43210 98765', gender: 'Male',
    insurance_provider: 'Star Health', insurance_id: 'SH-2024-12099',
    allergies: 'Sulfa drugs', medical_history_notes: 'Periodontal disease history, on blood thinners',
    facial_photo_url: null, created_at: '2024-08-05T08:00:00Z',
  },
];

export const mockClinicalRecords = {
  p1: [
    { id: 'cr1', patient_id: 'p1', tooth_number: 36, diagnosis: 'caries_dentin', plaque_index: 1.5, bone_level_mm: null, pocket_depth_mm: null, vitality: 'vital', diagnosis_notes: 'Occlusal caries extending into dentin, no pulp involvement yet', created_at: '2025-03-01' },
    { id: 'cr2', patient_id: 'p1', tooth_number: 14, diagnosis: 'caries_enamel', plaque_index: 1.0, bone_level_mm: null, pocket_depth_mm: null, vitality: 'vital', diagnosis_notes: 'Early enamel lesion on mesial surface', created_at: '2025-03-01' },
    { id: 'cr3', patient_id: 'p1', tooth_number: 46, diagnosis: 'healthy', plaque_index: 0.5, bone_level_mm: 2.0, pocket_depth_mm: 2.5, vitality: 'vital', diagnosis_notes: 'Previously restored, composite filling intact', created_at: '2025-03-01' },
  ],
  p2: [
    { id: 'cr4', patient_id: 'p2', tooth_number: 46, diagnosis: 'pulpitis_irreversible', plaque_index: 2.0, bone_level_mm: 3.5, pocket_depth_mm: 3.0, vitality: 'vital', diagnosis_notes: 'Spontaneous pain, lingering response to cold, deep caries on radiograph', created_at: '2025-02-15' },
    { id: 'cr5', patient_id: 'p2', tooth_number: 47, diagnosis: 'caries_dentin', plaque_index: 1.8, bone_level_mm: 2.5, pocket_depth_mm: 3.0, vitality: 'vital', diagnosis_notes: 'MOD caries', created_at: '2025-02-15' },
  ],
  p4: [
    { id: 'cr6', patient_id: 'p4', tooth_number: 38, diagnosis: 'impaction_mesioangular', plaque_index: null, bone_level_mm: null, pocket_depth_mm: null, vitality: 'vital', diagnosis_notes: 'Mesioangular impaction at 55 degrees, pericoronitis episodes x2', created_at: '2025-01-20' },
    { id: 'cr7', patient_id: 'p4', tooth_number: 48, diagnosis: 'impaction_horizontal', plaque_index: null, bone_level_mm: null, pocket_depth_mm: null, vitality: 'vital', diagnosis_notes: 'Horizontal impaction, resorption risk on 47 distal root', created_at: '2025-01-20' },
  ],
  p6: [
    { id: 'cr8', patient_id: 'p6', tooth_number: 31, diagnosis: 'periodontal_disease', plaque_index: 2.5, bone_level_mm: 5.0, pocket_depth_mm: 6.0, mobility_grade: 1.0, recession_mm: 2.0, bleeding_on_probing: true, vitality: 'vital', diagnosis_notes: 'Generalized chronic periodontitis, Stage III Grade B', created_at: '2025-02-01' },
    { id: 'cr9', patient_id: 'p6', tooth_number: 32, diagnosis: 'periodontal_disease', plaque_index: 2.3, bone_level_mm: 4.5, pocket_depth_mm: 5.5, mobility_grade: 0.5, recession_mm: 1.5, bleeding_on_probing: true, vitality: 'vital', diagnosis_notes: 'Deep pocketing with BOP', created_at: '2025-02-01' },
    { id: 'cr10', patient_id: 'p6', tooth_number: 41, diagnosis: 'periodontal_disease', plaque_index: 2.8, bone_level_mm: 6.0, pocket_depth_mm: 7.0, mobility_grade: 2.0, recession_mm: 3.0, bleeding_on_probing: true, vitality: 'vital', diagnosis_notes: 'Severe bone loss, guarded prognosis', created_at: '2025-02-01' },
  ],
};

export const mockScans = {
  p1: [
    { id: 's1', patient_id: 'p1', scan_type: 'intraoral', file_format: 'stl', storage_path: '/scans/p1_upper.stl', original_filename: 'aisha_upper_arch.stl', arch: 'upper', status: 'ready', vertex_count: 48230, face_count: 96120, scan_date: '2025-03-01T10:30:00Z', quality_score: 'high' },
    { id: 's2', patient_id: 'p1', scan_type: 'intraoral', file_format: 'stl', storage_path: '/scans/p1_lower.stl', original_filename: 'aisha_lower_arch.stl', arch: 'lower', status: 'ready', vertex_count: 45100, face_count: 89800, scan_date: '2025-03-01T10:35:00Z', quality_score: 'high' },
  ],
  p2: [
    { id: 's3', patient_id: 'p2', scan_type: 'intraoral', file_format: 'stl', storage_path: '/scans/p2_full.stl', original_filename: 'rajesh_full_scan.stl', arch: 'both', status: 'ready', vertex_count: 92400, face_count: 184200, scan_date: '2025-02-15T09:00:00Z', quality_score: 'high' },
  ],
  p4: [
    { id: 's4', patient_id: 'p4', scan_type: 'cbct', file_format: 'dcm', storage_path: '/scans/p4_cbct.dcm', original_filename: 'mohammed_cbct.dcm', arch: null, status: 'ready', vertex_count: null, face_count: null, scan_date: '2025-01-20T11:00:00Z', quality_score: 'high' },
  ],
  p5: [
    { id: 's5', patient_id: 'p5', scan_type: 'intraoral', file_format: 'stl', storage_path: '/scans/p5_full.stl', original_filename: 'sneha_aligner_scan_t12.stl', arch: 'both', status: 'ready', vertex_count: 88500, face_count: 176400, scan_date: '2025-03-20T14:00:00Z', quality_score: 'medium' },
  ],
  p6: [
    { id: 's6', patient_id: 'p6', scan_type: 'intraoral', file_format: 'stl', storage_path: '/scans/p6_lower.stl', original_filename: 'vikram_lower_perio.stl', arch: 'lower', status: 'ready', vertex_count: 51000, face_count: 101500, scan_date: '2025-02-01T08:30:00Z', quality_score: 'high' },
  ],
};

export const mockTreatments = {
  p1: [
    { id: 't1', patient_id: 'p1', tooth_number: 36, treatment_type: 'filling_composite', status: 'proposed', description: 'Direct composite restoration (MOD)', cost: 3500, currency: 'INR', simulation_id: 'sim1', created_at: '2025-03-01' },
  ],
  p2: [
    { id: 't2', patient_id: 'p2', tooth_number: 46, treatment_type: 'root_canal', status: 'scheduled', description: 'RCT + PFM Crown', cost: 15000, currency: 'INR', scheduled_date: '2025-04-15', simulation_id: 'sim2', created_at: '2025-02-15' },
    { id: 't3', patient_id: 'p2', tooth_number: 47, treatment_type: 'filling_composite', status: 'proposed', description: 'MOD composite', cost: 4000, currency: 'INR', created_at: '2025-02-15' },
  ],
  p4: [
    { id: 't4', patient_id: 'p4', tooth_number: 38, treatment_type: 'surgery_3rd_molar', status: 'completed', description: 'Surgical extraction of impacted 38', cost: 8000, currency: 'INR', completed_date: '2025-02-10', created_at: '2025-01-20' },
    { id: 't5', patient_id: 'p4', tooth_number: 48, treatment_type: 'surgery_3rd_molar', status: 'scheduled', description: 'Surgical extraction of impacted 48', cost: 8000, currency: 'INR', scheduled_date: '2025-04-20', created_at: '2025-01-20' },
  ],
  p5: [
    { id: 't6', patient_id: 'p5', treatment_type: 'aligner_therapy', status: 'in_progress', description: 'Clear aligner therapy - 24 trays', cost: 150000, currency: 'INR', created_at: '2024-09-01' },
  ],
  p6: [
    { id: 't7', patient_id: 'p6', treatment_type: 'scaling_root_planing', status: 'completed', description: 'Full mouth SRP - 4 quadrants', cost: 12000, currency: 'INR', completed_date: '2025-02-15', created_at: '2025-02-01' },
  ],
};

export const mockSimulations = {
  p1: [
    {
      id: 'sim1', patient_id: 'p1', parent_scan_id: 's1', clinician_prompt: 'Show caries progression on #36 if untreated for 12 months, then simulate composite restoration',
      simulation_type: 'comparison', module: 'caries_endo', target_teeth: [36], status: 'completed', progress_percent: 100,
      created_at: '2025-03-01T11:00:00Z', completed_at: '2025-03-01T11:02:30Z', processing_time_ms: 150000,
      parsed_intent: { module: 'caries_endo', target_teeth: [36], treatment: 'composite_filling', simulation_type: 'comparison' },
      states: [
        { id: 'st1', state_order: 0, label: 'Current State', clinical_metrics: { stage: 'initial', diagnosis: 'caries_dentin', depth_mm: 1.2 } },
        { id: 'st2', state_order: 1, label: '6 Months Untreated', clinical_metrics: { stage: 'dentin', depth_mm: 2.8, risk: 'pulp_exposure', reversible: false } },
        { id: 'st3', state_order: 2, label: '12 Months Untreated — Pulpitis', clinical_metrics: { stage: 'pulp', depth_mm: 4.1, needs_rct: true, pain_level: 'severe' } },
        { id: 'st4', state_order: 3, label: 'Post-Treatment (Composite)', clinical_metrics: { stage: 'restored', treatment: 'composite_filling', prognosis: 'excellent' } },
      ],
    },
  ],
  p2: [
    {
      id: 'sim2', patient_id: 'p2', parent_scan_id: 's3', clinician_prompt: 'Simulate RCT + Crown on #46',
      simulation_type: 'treatment_outcome', module: 'caries_endo', target_teeth: [46], status: 'completed', progress_percent: 100,
      created_at: '2025-02-15T10:00:00Z', completed_at: '2025-02-15T10:03:00Z', processing_time_ms: 180000,
      parsed_intent: { module: 'caries_endo', target_teeth: [46], treatment: 'rct_crown' },
      states: [
        { id: 'st5', state_order: 0, label: 'Current — Irreversible Pulpitis', clinical_metrics: { stage: 'pulp', vitality: 'compromised', pain: 'spontaneous' } },
        { id: 'st6', state_order: 1, label: 'Post-RCT (Access Cavity)', clinical_metrics: { stage: 'endodontic', canals_obturated: true } },
        { id: 'st7', state_order: 2, label: 'Final — PFM Crown Seated', clinical_metrics: { stage: 'restored', treatment: 'rct_crown', prognosis: 'good', crown_type: 'PFM' } },
      ],
    },
  ],
  p4: [
    {
      id: 'sim3', patient_id: 'p4', parent_scan_id: 's4', clinician_prompt: 'Show impaction collision risk for #48 on adjacent #47 root',
      simulation_type: 'disease_progression', module: 'surgery_3rd_molar', target_teeth: [48, 47], status: 'completed', progress_percent: 100,
      created_at: '2025-01-20T12:00:00Z', completed_at: '2025-01-20T12:01:45Z', processing_time_ms: 105000,
      parsed_intent: { module: 'surgery_3rd_molar', target_teeth: [48, 47], impaction_angle: 75, treatment: 'extraction' },
      states: [
        { id: 'st8', state_order: 0, label: 'Current Impaction (75° horizontal)', clinical_metrics: { impaction_angle_deg: 75, impaction_type: 'horizontal' } },
        { id: 'st9', state_order: 1, label: 'Projected Collision — Root Resorption Risk', clinical_metrics: { risk_level: 'high', adjacent_root_resorption_risk: true, pericoronitis_risk: true, resorption_depth_mm: 1.8 } },
        { id: 'st10', state_order: 2, label: 'Post-Extraction Healing (4 weeks)', clinical_metrics: { stage: 'extracted', healing_weeks: 4, bone_fill_pct: 60 } },
      ],
    },
  ],
  p6: [
    {
      id: 'sim4', patient_id: 'p6', parent_scan_id: 's6', clinician_prompt: 'Simulate periodontal bone loss progression if untreated, pocket depths 5-7mm',
      simulation_type: 'comparison', module: 'perio', target_teeth: [31, 32, 41], status: 'completed', progress_percent: 100,
      created_at: '2025-02-01T09:00:00Z', completed_at: '2025-02-01T09:02:00Z', processing_time_ms: 120000,
      parsed_intent: { module: 'perio', target_teeth: [31, 32, 41], pocket_depth_mm: 6.0 },
      states: [
        { id: 'st11', state_order: 0, label: 'Current Periodontal State', clinical_metrics: { pocket_depth_mm: 6.0, bone_loss_mm: 5.0, mobility: 'Grade I-II' } },
        { id: 'st12', state_order: 1, label: '12 Months Untreated — Severe Recession', clinical_metrics: { pocket_depth_mm: 8.5, bone_loss_mm: 7.0, recession_mm: 4.5, root_exposure: true, tooth_loss_risk: 'high' } },
        { id: 'st13', state_order: 2, label: 'Post-SRP + Maintenance (3 months)', clinical_metrics: { pocket_depth_mm: 4.0, bone_loss_mm: 5.0, recession_mm: 2.0, pocket_reduction_mm: 2.0, prognosis: 'fair' } },
      ],
    },
  ],
};

export const mockCrmEvents = [
  { id: 'ev1', patient_id: 'p4', treatment_id: 't4', event_type: 'post_op_day1_check', channel: 'sms', status: 'responded', scheduled_at: '2025-02-11T09:00:00Z', sent_at: '2025-02-11T09:00:00Z', responded_at: '2025-02-11T10:30:00Z', patient_response: 'There is some pain and swelling on the left side, took the painkiller you prescribed', response_analysis: { sentiment: 'neutral', keywords: { pain: true, bleeding: false, swelling: true }, requires_escalation: false }, requires_escalation: false },
  { id: 'ev2', patient_id: 'p4', treatment_id: 't4', event_type: 'post_op_day3_audit', channel: 'sms', status: 'responded', scheduled_at: '2025-02-13T09:00:00Z', sent_at: '2025-02-13T09:00:00Z', responded_at: '2025-02-13T14:00:00Z', patient_response: 'Much better now, swelling went down. No more pain.', response_analysis: { sentiment: 'positive', keywords: { pain: false, bleeding: false, swelling: false }, requires_escalation: false }, requires_escalation: false },
  { id: 'ev3', patient_id: 'p6', treatment_id: 't7', event_type: 'post_op_day1_check', channel: 'sms', status: 'escalated', scheduled_at: '2025-02-16T09:00:00Z', sent_at: '2025-02-16T09:00:00Z', responded_at: '2025-02-16T11:00:00Z', patient_response: 'My gums are bleeding a lot and there is sharp pain when I eat. Very worried.', response_analysis: { sentiment: 'negative', keywords: { pain: true, bleeding: true, swelling: false }, requires_escalation: true, escalation_reason: 'bleeding reported, pain reported' }, requires_escalation: true, escalation_reason: 'bleeding reported, pain reported' },
  { id: 'ev4', patient_id: 'p1', event_type: 'hygiene_recall_6m', channel: 'sms', status: 'scheduled', scheduled_at: '2025-09-01T09:00:00Z', message_template: 'Hi Aisha, it\'s time for your 6-month hygiene check! Would you like to book an appointment?' },
  { id: 'ev5', patient_id: 'p2', treatment_id: 't2', event_type: 'appointment_reminder', channel: 'sms', status: 'scheduled', scheduled_at: '2025-04-14T09:00:00Z', message_template: 'Hi Rajesh, reminder: your RCT appointment for tooth #46 is tomorrow at 10:00 AM.' },
  { id: 'ev6', patient_id: 'p5', event_type: 'aligner_tray_change', channel: 'sms', status: 'scheduled', scheduled_at: '2025-04-10T09:00:00Z', message_template: 'Hi Sneha, time to switch to tray 13! Please upload a fit photo after 24 hours of wear.' },
];

export const mockAlignerTracking = {
  p5: {
    id: 'at1', patient_id: 'p5', treatment_id: 't6', current_tray_number: 12, total_trays: 24,
    tray_start_date: '2025-03-20T00:00:00Z', next_change_date: '2025-04-03T00:00:00Z',
    wear_hours_per_day: 22, gap_measurement_mm: 0.3, fit_status: 'good',
    ai_recommendation: 'Gap: 0.3mm. Fit is excellent. Move to tray 13 on schedule.',
    history: [
      { id: 'ath1', current_tray_number: 10, tray_start_date: '2025-02-20T00:00:00Z', fit_status: 'good', gap_measurement_mm: 0.2 },
      { id: 'ath2', current_tray_number: 11, tray_start_date: '2025-03-06T00:00:00Z', fit_status: 'acceptable', gap_measurement_mm: 0.7 },
      { id: 'ath3', current_tray_number: 12, tray_start_date: '2025-03-20T00:00:00Z', fit_status: 'good', gap_measurement_mm: 0.3 },
    ],
  },
};
