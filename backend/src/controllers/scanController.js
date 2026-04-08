const Scan = require('../models/Scan');
const Mesh = require('../models/Mesh');
const { AppError } = require('../middleware/errorHandler');
const axios = require('axios');
const logger = require('../utils/logger');

async function listByPatient(req, res, next) {
  try {
    const scans = await Scan.findByPatient(req.params.patientId);
    res.json(scans);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const scan = await Scan.findById(req.params.id);
    if (!scan) throw new AppError('Scan not found', 404);
    const meshes = await Scan.getMeshes(scan.id);
    res.json({ ...scan, meshes });
  } catch (err) {
    next(err);
  }
}

async function upload(req, res, next) {
  try {
    if (!req.file) throw new AppError('No scan file uploaded', 400);

    const scan = await Scan.create({
      patient_id: req.params.patientId,
      scan_type: req.body.scan_type || 'intraoral',
      file_format: req.file.originalname.split('.').pop().toLowerCase(),
      storage_path: req.file.path,
      original_filename: req.file.originalname,
      file_size_bytes: req.file.size,
      arch: req.body.arch,
      status: 'processing',
      uploaded_by: req.user.id,
    });

    // Trigger async segmentation via AI service
    triggerSegmentation(scan.id, req.file.path).catch((err) => {
      logger.error(`Segmentation trigger failed for scan ${scan.id}:`, err.message);
    });

    res.status(201).json(scan);
  } catch (err) {
    next(err);
  }
}

async function triggerSegmentation(scanId, filePath) {
  const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
  try {
    await axios.post(`${aiServiceUrl}/api/segment`, {
      scan_id: scanId,
      file_path: filePath,
    });
  } catch (err) {
    await Scan.updateStatus(scanId, 'failed', err.message);
    throw err;
  }
}

async function getMeshes(req, res, next) {
  try {
    const meshes = await Mesh.findByScan(req.params.id);
    res.json(meshes);
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status, error } = req.body;
    const scan = await Scan.updateStatus(req.params.id, status, error);
    if (!scan) throw new AppError('Scan not found', 404);
    res.json(scan);
  } catch (err) {
    next(err);
  }
}

module.exports = { listByPatient, getById, upload, getMeshes, updateStatus };
