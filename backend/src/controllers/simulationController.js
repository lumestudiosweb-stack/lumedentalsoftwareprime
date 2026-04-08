const Simulation = require('../models/Simulation');
const { AppError } = require('../middleware/errorHandler');
const axios = require('axios');
const logger = require('../utils/logger');
const { getIO } = require('../services/socket');

async function listByPatient(req, res, next) {
  try {
    const sims = await Simulation.findByPatient(req.params.patientId);
    res.json(sims);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const sim = await Simulation.getFullSimulation(req.params.id);
    if (!sim) throw new AppError('Simulation not found', 404);
    res.json(sim);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { patient_id, parent_scan_id, clinician_prompt, simulation_type, module, target_teeth, parameters } = req.body;

    const sim = await Simulation.create({
      patient_id,
      parent_scan_id,
      clinician_prompt,
      simulation_type,
      module,
      target_teeth,
      parameters,
      status: 'queued',
      created_by: req.user.id,
    });

    // Trigger async AI simulation pipeline
    runSimulationPipeline(sim.id).catch((err) => {
      logger.error(`Simulation pipeline failed for ${sim.id}:`, err.message);
    });

    res.status(201).json(sim);
  } catch (err) {
    next(err);
  }
}

async function runSimulationPipeline(simulationId) {
  const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
  const io = getIO();

  try {
    // Step 1: Parse clinician prompt via LLM
    await Simulation.updateStatus(simulationId, 'parsing', 10);
    io.to(`simulation:${simulationId}`).emit('simulation:progress', { id: simulationId, status: 'parsing', progress: 10 });

    const sim = await Simulation.findById(simulationId);

    const parseResponse = await axios.post(`${aiServiceUrl}/api/parse-prompt`, {
      simulation_id: simulationId,
      prompt: sim.clinician_prompt,
      module: sim.module,
    });

    await Simulation.update(simulationId, { parsed_intent: parseResponse.data.intent });

    // Step 2: Run geometric simulation
    await Simulation.updateStatus(simulationId, 'simulating', 40);
    io.to(`simulation:${simulationId}`).emit('simulation:progress', { id: simulationId, status: 'simulating', progress: 40 });

    const simResponse = await axios.post(`${aiServiceUrl}/api/simulate`, {
      simulation_id: simulationId,
      scan_id: sim.parent_scan_id,
      intent: parseResponse.data.intent,
      module: sim.module,
      parameters: sim.parameters,
    });

    // Step 3: Apply texture mapping
    await Simulation.updateStatus(simulationId, 'texturing', 75);
    io.to(`simulation:${simulationId}`).emit('simulation:progress', { id: simulationId, status: 'texturing', progress: 75 });

    await axios.post(`${aiServiceUrl}/api/texture`, {
      simulation_id: simulationId,
      states: simResponse.data.states,
    });

    // Complete
    await Simulation.updateStatus(simulationId, 'completed', 100);
    io.to(`simulation:${simulationId}`).emit('simulation:progress', { id: simulationId, status: 'completed', progress: 100 });
  } catch (err) {
    await Simulation.updateStatus(simulationId, 'failed');
    await Simulation.update(simulationId, { error_message: err.message });
    io.to(`simulation:${simulationId}`).emit('simulation:error', { id: simulationId, error: err.message });
    throw err;
  }
}

async function getStates(req, res, next) {
  try {
    const states = await Simulation.getStates(req.params.id);
    res.json(states);
  } catch (err) {
    next(err);
  }
}

module.exports = { listByPatient, getById, create, getStates };
