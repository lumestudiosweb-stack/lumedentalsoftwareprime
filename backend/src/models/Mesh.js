const db = require('../config/database');

const TABLE = 'meshes';

const Mesh = {
  async findByScan(scanId) {
    return db(TABLE).where({ scan_id: scanId }).orderBy('tooth_label');
  },

  async findById(id) {
    return db(TABLE).where({ id }).first();
  },

  async create(data) {
    const [mesh] = await db(TABLE).insert(data).returning('*');
    return mesh;
  },

  async bulkCreate(meshes) {
    return db(TABLE).insert(meshes).returning('*');
  },

  async update(id, data) {
    const [mesh] = await db(TABLE).where({ id }).update({ ...data, updated_at: db.fn.now() }).returning('*');
    return mesh;
  },

  async findByTooth(scanId, toothLabel) {
    return db(TABLE).where({ scan_id: scanId, tooth_label: toothLabel }).first();
  },

  async getTeethSegments(scanId) {
    return db(TABLE).where({ scan_id: scanId, structure_type: 'tooth' }).orderBy('tooth_label');
  },
};

module.exports = Mesh;
