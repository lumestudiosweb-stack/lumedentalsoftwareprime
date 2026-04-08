const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/alignerController');
const { authenticate } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');

router.use(authenticate);

router.get('/patient/:patientId/status', ctrl.getStatus);
router.get('/patient/:patientId/history', ctrl.getHistory);
router.post('/patient/:patientId/start', ctrl.startTracking);
router.post('/patient/:patientId/fit-photo', uploadImage.single('photo'), ctrl.submitFitPhoto);
router.post('/patient/:patientId/advance', ctrl.advanceTray);

module.exports = router;
