const db = require('../config/database');

const TABLE = 'crm_events';

const CrmEvent = {
  async findByPatient(patientId) {
    return db(TABLE).where({ patient_id: patientId }).orderBy('scheduled_at', 'desc');
  },

  async findById(id) {
    return db(TABLE).where({ id }).first();
  },

  async create(data) {
    const [event] = await db(TABLE).insert(data).returning('*');
    return event;
  },

  async update(id, data) {
    const [event] = await db(TABLE).where({ id }).update({ ...data, updated_at: db.fn.now() }).returning('*');
    return event;
  },

  async findScheduledDue() {
    return db(TABLE)
      .where({ status: 'scheduled' })
      .where('scheduled_at', '<=', db.fn.now())
      .orderBy('scheduled_at');
  },

  async findEscalations() {
    return db(TABLE)
      .where({ requires_escalation: true })
      .whereIn('status', ['responded', 'escalated'])
      .orderBy('responded_at', 'desc');
  },

  async recordResponse(id, response, analysis) {
    const update = {
      patient_response: response,
      response_analysis: analysis,
      status: 'responded',
      responded_at: db.fn.now(),
      updated_at: db.fn.now(),
    };
    if (analysis && analysis.requires_escalation) {
      update.requires_escalation = true;
      update.escalation_reason = analysis.escalation_reason;
      update.status = 'escalated';
    }
    const [event] = await db(TABLE).where({ id }).update(update).returning('*');
    return event;
  },
};

module.exports = CrmEvent;
