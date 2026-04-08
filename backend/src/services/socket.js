const { Server } = require('socket.io');
const logger = require('../utils/logger');

let io;

function initializeSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Join simulation room for real-time progress
    socket.on('simulation:subscribe', (simulationId) => {
      socket.join(`simulation:${simulationId}`);
      logger.info(`Client ${socket.id} subscribed to simulation ${simulationId}`);
    });

    socket.on('simulation:unsubscribe', (simulationId) => {
      socket.leave(`simulation:${simulationId}`);
    });

    // Join patient room for CRM notifications
    socket.on('patient:subscribe', (patientId) => {
      socket.join(`patient:${patientId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    // Return a no-op emitter during tests or when socket isn't initialized
    return { to: () => ({ emit: () => {} }) };
  }
  return io;
}

module.exports = { initializeSocketIO, getIO };
