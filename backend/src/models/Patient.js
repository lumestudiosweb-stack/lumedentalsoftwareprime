const db = require('../config/database');

const TABLE = 'patients';

const Patient = {
  async findAll({ limit = 50, offset = 0, search } = {}) {
    const query = db(TABLE).whereNull('deleted_at').orderBy('created_at', 'desc').limit(limit).offset(offset);
    if (search) {
      query.where(function () {
        this.whereILike('first_name', `%${search}%`)
          .orWhereILike('last_name', `%${search}%`)
          .orWhereILike('email', `%${search}%`)
          .orWhereILike('phone', `%${search}%`);
      });
    }
    return query;
  },

  async findById(id) {
    return db(TABLE).where({ id }).whereNull('deleted_at').first();
  },

  async create(data) {
    const [patient] = await db(TABLE).insert(data).returning('*');
    return patient;
  },

  async update(id, data) {
    const [patient] = await db(TABLE).where({ id }).update({ ...data, updated_at: db.fn.now() }).returning('*');
    return patient;
  },

  async softDelete(id) {
    const [patient] = await db(TABLE).where({ id }).update({ deleted_at: db.fn.now() }).returning('*');
    return patient;
  },

  async count({ search } = {}) {
    const query = db(TABLE).whereNull('deleted_at').count('id as count');
    if (search) {
      query.where(function () {
        this.whereILike('first_name', `%${search}%`)
          .orWhereILike('last_name', `%${search}%`);
      });
    }
    const [result] = await query;
    return parseInt(result.count, 10);
  },

  async getFullProfile(id) {
    const patient = await this.findById(id);
    if (!patient) return null;
    const [clinicalRecords, scans, treatments] = await Promise.all([
      db('clinical_records').where({ patient_id: id }).orderBy('created_at', 'desc'),
      db('scans').where({ patient_id: id }).orderBy('scan_date', 'desc'),
      db('treatments').where({ patient_id: id }).orderBy('created_at', 'desc'),
    ]);
    return { ...patient, clinicalRecords, scans, treatments };
  },
};

module.exports = Patient;
