const AlignerTracking = require('../models/AlignerTracking');
const CrmEvent = require('../models/CrmEvent');
const { AppError } = require('../middleware/errorHandler');
const axios = require('axios');
const logger = require('../utils/logger');

async function getStatus(req, res, next) {
  try {
    const latest = await AlignerTracking.findLatest(req.params.patientId);
    if (!latest) throw new AppError('No aligner tracking found for this patient', 404);
    res.json(latest);
  } catch (err) {
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const history = await AlignerTracking.findByPatient(req.params.patientId);
    res.json(history);
  } catch (err) {
    next(err);
  }
}

async function startTracking(req, res, next) {
  try {
    const { treatment_id, total_trays, wear_hours_per_day } = req.body;
    const record = await AlignerTracking.create({
      patient_id: req.params.patientId,
      treatment_id,
      current_tray_number: 1,
      total_trays,
      tray_start_date: new Date(),
      wear_hours_per_day: wear_hours_per_day || 22,
    });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
}

async function submitFitPhoto(req, res, next) {
  try {
    if (!req.file) throw new AppError('No fit photo uploaded', 400);

    const latest = await AlignerTracking.findLatest(req.params.patientId);
    if (!latest) throw new AppError('No active aligner tracking', 404);

    // Send photo to AI service for gap analysis
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
    let gapAnalysis;
    try {
      const response = await axios.post(`${aiServiceUrl}/api/aligner-fit`, {
        image_path: req.file.path,
        tray_number: latest.current_tray_number,
      });
      gapAnalysis = response.data;
    } catch (err) {
      logger.error('Aligner fit analysis failed:', err.message);
      gapAnalysis = { gap_mm: null, fit_status: 'needs_rescan', recommendation: 'AI analysis unavailable. Manual review required.' };
    }

    // Decision tree
    let fitStatus = 'good';
    let recommendation = 'Fit looks good. Continue wearing as prescribed.';

    if (gapAnalysis.gap_mm !== null) {
      if (gapAnalysis.gap_mm < 0.5) {
        fitStatus = 'good';
        recommendation = `Gap: ${gapAnalysis.gap_mm}mm. Move to tray ${latest.current_tray_number + 1}.`;
      } else if (gapAnalysis.gap_mm <= 1.0) {
        fitStatus = 'acceptable';
        recommendation = `Gap: ${gapAnalysis.gap_mm}mm. Continue current tray for 2 more days, then reassess.`;
      } else {
        fitStatus = 'poor';
        recommendation = `Gap: ${gapAnalysis.gap_mm}mm. Extend wear for 3+ days and re-scan. Consider clinician review.`;
      }
    }

    const updated = await AlignerTracking.update(latest.id, {
      fit_photo_url: req.file.path,
      gap_measurement_mm: gapAnalysis.gap_mm,
      fit_status: fitStatus,
      ai_recommendation: recommendation,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function advanceTray(req, res, next) {
  try {
    const record = await AlignerTracking.advanceTray(req.params.patientId);
    if (!record) throw new AppError('Cannot advance tray. Either no active tracking or already on final tray.', 400);

    // Schedule tray change reminder
    const nextChangeDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days default
    await AlignerTracking.update(record.id, { next_change_date: nextChangeDate });

    await CrmEvent.create({
      patient_id: req.params.patientId,
      event_type: 'aligner_tray_change',
      channel: 'sms',
      scheduled_at: nextChangeDate,
      message_template: `Time to switch to tray ${record.current_tray_number + 1}! Please upload a fit photo after 24 hours of wear.`,
    });

    res.json(record);
  } catch (err) {
    next(err);
  }
}

module.exports = { getStatus, getHistory, startTracking, submitFitPhoto, advanceTray };
