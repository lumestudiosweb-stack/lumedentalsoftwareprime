const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/scanController');
const { authenticate } = require('../middleware/auth');
const { uploadScan } = require('../middleware/upload');

router.use(authenticate);

router.get('/patient/:patientId', ctrl.listByPatient);
router.get('/:id', ctrl.getById);
router.get('/:id/meshes', ctrl.getMeshes);
router.post('/patient/:patientId/upload', uploadScan.single('scan'), ctrl.upload);
router.patch('/:id/status', ctrl.updateStatus);

module.exports = router;
