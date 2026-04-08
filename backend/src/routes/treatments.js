const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/treatmentController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/patient/:patientId', ctrl.listByPatient);
router.get('/:id', ctrl.getById);
router.post('/patient/:patientId', ctrl.create);
router.put('/:id', ctrl.update);
router.post('/:id/complete', ctrl.complete);

module.exports = router;
