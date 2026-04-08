const db = require('../config/database');

const TABLE = 'scans';

const Scan = {
  async findByPatient(patientId) {
    return db(TABLE).where({ patient_id: patientId }).orderBy('scan_date', 'desc');
  },

  async findById(id) {
    return db(TABLE).where({ id }).first();
  },

  async create(data) {
    const [scan] = await db(TABLE).insert(data).returning('*');
    return scan;
  },

  async update(id, data) {
    const [scan] = await db(TABLE).where({ id }).update({ ...data, updated_at: db.fn.now() }).returning('*');
    return scan;
  },

  async updateStatus(id, status, error = null) {
    const update = { status, updated_at: db.fn.now() };
    if (error) update.processing_error = error;
    const [scan] = await db(TABLE).where({ id }).update(update).returning('*');
    return scan;
  },

  async delete(id) {
    return db(TABLE).where({ id }).del();
  },

  async getMeshes(scanId) {
    return db('meshes').where({ scan_id: scanId }).orderBy('tooth_label');
  },
};

module.exports = Scan;
