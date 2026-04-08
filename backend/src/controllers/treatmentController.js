const Treatment = require('../models/Treatment');
const CrmEvent = require('../models/CrmEvent');
const { AppError } = require('../middleware/errorHandler');

async function listByPatient(req, res, next) {
  try {
    const treatments = await Treatment.findByPatient(req.params.patientId);
    res.json(treatments);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const treatment = await Treatment.findById(req.params.id);
    if (!treatment) throw new AppError('Treatment not found', 404);
    res.json(treatment);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = { ...req.body, patient_id: req.params.patientId };
    const treatment = await Treatment.create(data);
    res.status(201).json(treatment);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const treatment = await Treatment.update(req.params.id, req.body);
    if (!treatment) throw new AppError('Treatment not found', 404);
    res.json(treatment);
  } catch (err) {
    next(err);
  }
}

async function complete(req, res, next) {
  try {
    const treatment = await Treatment.updateStatus(req.params.id, 'completed');
    if (!treatment) throw new AppError('Treatment not found', 404);

    // Trigger post-op CRM events
    const now = new Date();
    const day1 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const day3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const month6 = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

    await Promise.all([
      CrmEvent.create({
        patient_id: treatment.patient_id,
        treatment_id: treatment.id,
        event_type: 'post_op_day1_check',
        channel: 'sms',
        scheduled_at: day1,
        message_template: 'Hi {{patient_name}}, how are you feeling after your {{treatment_type}} yesterday? Any pain or concerns? Reply here or call us.',
      }),
      CrmEvent.create({
        patient_id: treatment.patient_id,
        treatment_id: treatment.id,
        event_type: 'post_op_day3_audit',
        channel: 'sms',
        scheduled_at: day3,
        message_template: 'Hi {{patient_name}}, quick check-in on your {{treatment_type}} from 3 days ago. How does your bite feel? Any sensitivity?',
      }),
      CrmEvent.create({
        patient_id: treatment.patient_id,
        treatment_id: treatment.id,
        event_type: 'hygiene_recall_6m',
        channel: 'sms',
        scheduled_at: month6,
        message_template: 'Hi {{patient_name}}, it\'s time for your 6-month hygiene check! Would you like to book an appointment?',
      }),
    ]);

    res.json({ treatment, message: 'Treatment completed. Post-op follow-up events scheduled.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listByPatient, getById, create, update, complete };
