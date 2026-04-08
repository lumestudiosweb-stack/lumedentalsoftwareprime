const ClinicalRecord = require('../models/ClinicalRecord');
const { AppError } = require('../middleware/errorHandler');

async function listByPatient(req, res, next) {
  try {
    const records = await ClinicalRecord.findByPatient(req.params.patientId);
    res.json(records);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const record = await ClinicalRecord.findById(req.params.id);
    if (!record) throw new AppError('Clinical record not found', 404);
    res.json(record);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = { ...req.body, patient_id: req.params.patientId };
    const record = await ClinicalRecord.create(data);
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const record = await ClinicalRecord.update(req.params.id, req.body);
    if (!record) throw new AppError('Clinical record not found', 404);
    res.json(record);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await ClinicalRecord.delete(req.params.id);
    res.json({ message: 'Record deleted' });
  } catch (err) {
    next(err);
  }
}

async function getPerioChart(req, res, next) {
  try {
    const chart = await ClinicalRecord.getPerioChart(req.params.patientId);
    res.json(chart);
  } catch (err) {
    next(err);
  }
}

module.exports = { listByPatient, getById, create, update, remove, getPerioChart };
