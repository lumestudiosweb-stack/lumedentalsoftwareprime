const db = require('../config/database');

const TABLE = 'clinical_records';

const ClinicalRecord = {
  async findByPatient(patientId) {
    return db(TABLE).where({ patient_id: patientId }).orderBy('tooth_number');
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

  async delete(id) {
    return db(TABLE).where({ id }).del();
  },

  async findByTooth(patientId, toothNumber) {
    return db(TABLE).where({ patient_id: patientId, tooth_number: toothNumber }).orderBy('created_at', 'desc');
  },

  async getPerioChart(patientId) {
    return db(TABLE)
      .where({ patient_id: patientId })
      .whereNotNull('pocket_depth_mm')
      .select('tooth_number', 'pocket_depth_mm', 'recession_mm', 'bone_level_mm', 'bleeding_on_probing', 'mobility_grade')
      .orderBy('tooth_number');
  },
};

module.exports = ClinicalRecord;
