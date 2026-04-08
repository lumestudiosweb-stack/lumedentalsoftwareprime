const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/crmController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/patient/:patientId', ctrl.listByPatient);
router.get('/escalations', ctrl.getEscalations);
router.get('/due', ctrl.getDueEvents);
router.post('/:id/response', ctrl.recordResponse);
router.post('/', ctrl.create);

module.exports = router;
