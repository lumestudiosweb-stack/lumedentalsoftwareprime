const db = require('../config/database');

const TABLE = 'treatments';

const Treatment = {
  async findByPatient(patientId) {
    return db(TABLE).where({ patient_id: patientId }).orderBy('created_at', 'desc');
  },

  async findById(id) {
    return db(TABLE).where({ id }).first();
  },

  async create(data) {
    const [treatment] = await db(TABLE).insert(data).returning('*');
    return treatment;
  },

  async update(id, data) {
    const [treatment] = await db(TABLE).where({ id }).update({ ...data, updated_at: db.fn.now() }).returning('*');
    return treatment;
  },

  async updateStatus(id, status) {
    const update = { status, updated_at: db.fn.now() };
    if (status === 'completed') update.completed_date = db.fn.now();
    const [treatment] = await db(TABLE).where({ id }).update(update).returning('*');
    return treatment;
  },

  async delete(id) {
    return db(TABLE).where({ id }).del();
  },

  async findPending(patientId) {
    return db(TABLE)
      .where({ patient_id: patientId })
      .whereIn('status', ['proposed', 'accepted', 'scheduled'])
      .orderBy('scheduled_date');
  },
};

module.exports = Treatment;
