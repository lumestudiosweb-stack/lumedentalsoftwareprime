const Patient = require('../models/Patient');
const { AppError } = require('../middleware/errorHandler');

async function list(req, res, next) {
  try {
    const { limit = 50, offset = 0, search } = req.query;
    const [patients, total] = await Promise.all([
      Patient.findAll({ limit: parseInt(limit), offset: parseInt(offset), search }),
      Patient.count({ search }),
    ]);
    res.json({ patients, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) throw new AppError('Patient not found', 404);
    res.json(patient);
  } catch (err) {
    next(err);
  }
}

async function getFullProfile(req, res, next) {
  try {
    const profile = await Patient.getFullProfile(req.params.id);
    if (!profile) throw new AppError('Patient not found', 404);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const patient = await Patient.create(req.body);
    res.status(201).json(patient);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const patient = await Patient.update(req.params.id, req.body);
    if (!patient) throw new AppError('Patient not found', 404);
    res.json(patient);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const patient = await Patient.softDelete(req.params.id);
    if (!patient) throw new AppError('Patient not found', 404);
    res.json({ message: 'Patient archived successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, getFullProfile, create, update, remove };
