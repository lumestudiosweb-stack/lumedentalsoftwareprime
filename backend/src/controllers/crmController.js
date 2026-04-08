const CrmEvent = require('../models/CrmEvent');
const { AppError } = require('../middleware/errorHandler');

async function listByPatient(req, res, next) {
  try {
    const events = await CrmEvent.findByPatient(req.params.patientId);
    res.json(events);
  } catch (err) {
    next(err);
  }
}

async function getEscalations(req, res, next) {
  try {
    const escalations = await CrmEvent.findEscalations();
    res.json(escalations);
  } catch (err) {
    next(err);
  }
}

async function getDueEvents(req, res, next) {
  try {
    const events = await CrmEvent.findScheduledDue();
    res.json(events);
  } catch (err) {
    next(err);
  }
}

async function recordResponse(req, res, next) {
  try {
    const { response } = req.body;
    if (!response) throw new AppError('Response text is required', 400);

    // AI-powered response analysis
    const analysis = analyzePatientResponse(response);

    const event = await CrmEvent.recordResponse(req.params.id, response, analysis);
    res.json(event);
  } catch (err) {
    next(err);
  }
}

function analyzePatientResponse(response) {
  const lower = response.toLowerCase();
  const painKeywords = ['pain', 'hurt', 'ache', 'throb', 'sore', 'agony', 'sharp'];
  const bleedingKeywords = ['bleed', 'blood', 'bleeding', 'hemorrhage'];
  const swellingKeywords = ['swell', 'swollen', 'swelling', 'puff', 'inflam'];
  const positiveKeywords = ['good', 'fine', 'great', 'better', 'no pain', 'comfortable', 'okay'];

  const hasPain = painKeywords.some((k) => lower.includes(k));
  const hasBleeding = bleedingKeywords.some((k) => lower.includes(k));
  const hasSwelling = swellingKeywords.some((k) => lower.includes(k));
  const isPositive = positiveKeywords.some((k) => lower.includes(k));

  const requiresEscalation = hasBleeding || (hasPain && hasSwelling);
  const reasons = [];
  if (hasPain) reasons.push('pain reported');
  if (hasBleeding) reasons.push('bleeding reported');
  if (hasSwelling) reasons.push('swelling reported');

  return {
    sentiment: isPositive && !requiresEscalation ? 'positive' : requiresEscalation ? 'negative' : 'neutral',
    keywords: { pain: hasPain, bleeding: hasBleeding, swelling: hasSwelling },
    requires_escalation: requiresEscalation,
    escalation_reason: requiresEscalation ? reasons.join(', ') : null,
  };
}

async function create(req, res, next) {
  try {
    const event = await CrmEvent.create(req.body);
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
}

module.exports = { listByPatient, getEscalations, getDueEvents, recordResponse, create };
