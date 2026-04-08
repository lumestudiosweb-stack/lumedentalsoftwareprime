const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/simulationController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/patient/:patientId', ctrl.listByPatient);
router.get('/:id', ctrl.getById);
router.get('/:id/states', ctrl.getStates);
router.post('/', ctrl.create);

module.exports = router;
