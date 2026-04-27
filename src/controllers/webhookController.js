const fs = require('fs');
const path = require('path');
const config = require('../config');
const hubspotService = require('../services/hubspotService');

// ─── Helper: guardar payload en JSON para debug/log ───────────────────────────
const saveToFile = (payload) => {
    try {
        // Crear el directorio si no existe
        const dir = path.dirname(config.DATA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        let fileData = [];
        if (fs.existsSync(config.DATA_FILE)) {
            const raw = fs.readFileSync(config.DATA_FILE, 'utf8');
            if (raw) fileData = JSON.parse(raw);
        }
        fileData.push({ received_at: new Date().toISOString(), data: payload });
        fs.writeFileSync(config.DATA_FILE, JSON.stringify(fileData, null, 2));
    } catch (err) {
        console.error('Error guardando en archivo:', err.message);
    }
};

// ─── Caso 4: Cierre de venta (Quattro → HubSpot) ─────────────────────────────
exports.cierreVenta = async (req, res) => {
    const payload = req.body;
    console.log('📥 Caso 4 - Cierre de venta recibido:', payload);
    saveToFile({ caso: 'cierre_venta', ...payload });

    try {
        // 1. Buscar contacto en HubSpot por email
        // 2. Si no existe, crearlo
        // 3. Crear Deal vinculado al contacto
        // 4. Asignar al Pipeline Metropoli en etapa 'En proceso'
        const result = await hubspotService.procesarCierreVenta(payload);

        res.status(200).json({
            status: 'success',
            message: 'Cierre de venta procesado',
            data: result
        });

    } catch (error) {
        console.error('Error en cierreVenta:', error.message);
        res.status(500).json({ error: 'Error procesando cierre de venta' });
    }
};

// ─── Caso 5: Cancelación de póliza (Quattro → HubSpot) ───────────────────────
exports.cancelacionPoliza = async (req, res) => {
    const payload = req.body;
    console.log('📥 Caso 5 - Cancelación de póliza recibida:', payload);
    saveToFile({ caso: 'cancelacion_poliza', ...payload });

    try {
        // 1. Buscar Deal vinculado al contacto
        // 2. Mover Deal a etapa 'Cierre perdido'
        const result = await hubspotService.procesarCancelacion(payload);

        res.status(200).json({
            status: 'success',
            message: 'Cancelación procesada',
            data: result
        });

    } catch (error) {
        console.error('Error en cancelacionPoliza:', error.message);
        res.status(500).json({ error: 'Error procesando cancelación' });
    }
};

// ─── Genérica: para pruebas / compatibilidad ─────────────────────────────────
exports.receiveWebhook = (req, res) => {
    const payload = req.body;
    console.log('📥 Webhook genérico recibido');
    saveToFile(payload);

    res.status(200).json({
        status: 'success',
        message: 'Payload recibido y guardado'
    });
};