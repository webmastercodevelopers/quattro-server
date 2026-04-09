const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const validar = require('../middleware/validatePayload');

// Caso 4 - Cierre de venta
router.post('/cierre-venta', validar('cierreVenta'), webhookController.cierreVenta);

// Caso 5 - Cancelación de póliza
router.post('/cancelacion-poliza', validar('cancelacionPoliza'), webhookController.cancelacionPoliza);

// Genérica
router.post('/', webhookController.receiveWebhook);

module.exports = router;