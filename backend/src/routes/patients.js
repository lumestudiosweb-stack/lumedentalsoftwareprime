const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/patientController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.get('/:id/profile', ctrl.getFullProfile);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
