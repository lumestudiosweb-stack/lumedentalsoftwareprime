require('dotenv').config({ path: '../.env' });
const http = require('http');
const app = require('./app');
const { initializeSocketIO } = require('./services/socket');
const logger = require('./utils/logger');
const { initializeCronJobs } = require('./services/cron');

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

initializeSocketIO(server);
initializeCronJobs();

server.listen(PORT, () => {
  logger.info(`LumeDental API running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = server;
