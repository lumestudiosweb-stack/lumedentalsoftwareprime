const db = require('../config/database');

const TABLE = 'simulations';

const Simulation = {
  async findByPatient(patientId) {
    return db(TABLE)
      .where({ patient_id: patientId })
      .orderBy('created_at', 'desc');
  },

  async findById(id) {
    return db(TABLE).where({ id }).first();
  },

  async create(data) {
    const [sim] = await db(TABLE).insert(data).returning('*');
    return sim;
  },

  async update(id, data) {
    const [sim] = await db(TABLE).where({ id }).update({ ...data, updated_at: db.fn.now() }).returning('*');
    return sim;
  },

  async updateStatus(id, status, progress = null) {
    const update = { status, updated_at: db.fn.now() };
    if (progress !== null) update.progress_percent = progress;
    if (status === 'simulating') update.started_at = db.fn.now();
    if (status === 'completed' || status === 'failed') update.completed_at = db.fn.now();
    const [sim] = await db(TABLE).where({ id }).update(update).returning('*');
    return sim;
  },

  async getStates(simulationId) {
    return db('simulation_states')
      .where({ simulation_id: simulationId })
      .orderBy('state_order');
  },

  async createState(data) {
    const [state] = await db('simulation_states').insert(data).returning('*');
    return state;
  },

  async getFullSimulation(id) {
    const simulation = await this.findById(id);
    if (!simulation) return null;
    const states = await this.getStates(id);
    return { ...simulation, states };
  },

  async findByScan(scanId) {
    return db(TABLE).where({ parent_scan_id: scanId }).orderBy('created_at', 'desc');
  },
};

module.exports = Simulation;
