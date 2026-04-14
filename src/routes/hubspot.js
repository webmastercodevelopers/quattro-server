const express = require('express');
const router = express.Router();
const hubspotController = require('../controllers/hubspotController');
const validar = require('../middleware/validatePayload');

// Caso 1 - sin validación, el body es webhook de HubSpot
router.post('/prospecto', hubspotController.crearProspecto);

// Caso 2 - Cambio en Lifecycle Stage
router.post('/lifecycle', validar('actualizarLifecycle'), hubspotController.actualizarLifecycle);

// Caso 3 - Cambio de estatus del lead
router.post('/estatus-lead', validar('actualizarEstatusLead'), hubspotController.actualizarEstatusLead);




module.exports = router;

