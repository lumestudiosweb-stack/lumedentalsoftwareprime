const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/clinicalController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/patient/:patientId', ctrl.listByPatient);
router.get('/patient/:patientId/perio-chart', ctrl.getPerioChart);
router.get('/:id', ctrl.getById);
router.post('/patient/:patientId', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
