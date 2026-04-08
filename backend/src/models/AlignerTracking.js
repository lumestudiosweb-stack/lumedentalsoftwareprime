const db = require('../config/database');

const TABLE = 'aligner_tracking';

const AlignerTracking = {
  async findByPatient(patientId) {
    return db(TABLE).where({ patient_id: patientId }).orderBy('created_at', 'desc');
  },

  async findLatest(patientId) {
    return db(TABLE).where({ patient_id: patientId }).orderBy('created_at', 'desc').first();
  },

  async findById(id) {
    return db(TABLE).where({ id }).first();
  },

  async create(data) {
    const [record] = await db(TABLE).insert(data).returning('*');
    return record;
  },

  async update(id, data) {
    const [record] = await db(TABLE).where({ id }).update({ ...data, updated_at: db.fn.now() }).returning('*');
    return record;
  },

  async advanceTray(patientId) {
    const latest = await this.findLatest(patientId);
    if (!latest) return null;
    const nextTray = latest.current_tray_number + 1;
    if (nextTray > latest.total_trays) return null;
    const [record] = await db(TABLE)
      .insert({
        patient_id: patientId,
        treatment_id: latest.treatment_id,
        current_tray_number: nextTray,
        total_trays: latest.total_trays,
        tray_start_date: db.fn.now(),
        wear_hours_per_day: latest.wear_hours_per_day,
      })
      .returning('*');
    return record;
  },
};

module.exports = AlignerTracking;
