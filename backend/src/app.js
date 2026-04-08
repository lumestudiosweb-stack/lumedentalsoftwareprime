const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const patientRoutes = require('./routes/patients');
const clinicalRoutes = require('./routes/clinical');
const scanRoutes = require('./routes/scans');
const simulationRoutes = require('./routes/simulations');
const treatmentRoutes = require('./routes/treatments');
const crmRoutes = require('./routes/crm');
const alignerRoutes = require('./routes/aligners');
const authRoutes = require('./routes/auth');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'lumedental-api', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/clinical', clinicalRoutes);
app.use('/api/scans', scanRoutes);
app.use('/api/simulations', simulationRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/aligners', alignerRoutes);

app.use(errorHandler);

module.exports = app;
