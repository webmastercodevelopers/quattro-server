const express = require('express');
const router = express.Router();
const hubspotController = require('../controllers/hubspotController');

// Caso 1 - Formulario llenado / contact.creation
router.post('/prospecto', hubspotController.crearProspecto);

// Caso 2a - Cambio en Lifecycle Stage
router.post('/lifecycle', hubspotController.actualizarLifecycle);

// Caso 2b - Lead Scoring >= 50
router.post('/lead-scoring', hubspotController.leadScoring);

// Caso 3 - Cambio estatus lead / motivo rechazo / etapa proceso
router.post('/estatus-lead', hubspotController.actualizarEstatusLead);

module.exports = router;