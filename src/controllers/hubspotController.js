const fs = require('fs');
const config = require('../config');
const quattroService = require('../services/quattroService');
const hubspotService = require('../services/hubspotService');

// ─── Helper: guardar payload en JSON para debug/log ───────────────────────────
const saveToFile = (payload) => {
    try {
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

// ─── Caso 1: Contacto llena formulario (HubSpot → Quattro) ───────────────────
exports.crearProspecto = async (req, res) => {
    const payload = req.body;
    const eventos = Array.isArray(payload) ? payload : [payload];
    const evento = eventos[0];

    console.log('📥 Caso 1 - Webhook HubSpot recibido:', evento);

    try {
        const contactId = evento.objectId;
        if (!contactId) {
            return res.status(400).json({ error: 'objectId no encontrado en webhook' });
        }

        // Consultar datos completos del contacto en HubSpot
        const contacto = await hubspotService.obtenerContactoPorId(contactId);
        const props = contacto.properties;

        // Mapear campos HubSpot → Quattro
        const prospecto = {
            contactID: 0,
            firstName: props.firstname || '',
            lastName: props.lastname || '',
            email: props.email || '',
            job: props.jobtitle || '',
            companyName: props.company || '',
            contacto: props.hs_whatsapp_phone ? 'WhatsApp' : '',
            cp: props.zip || '00000',
            giro: props.industry || '',
            noColaboradores: props.numberofemployees || '0',
            status: 1,
            productos: {
                autos: props.producto_autos === 'true',
                accidentesPersonales: props.producto_accidentes === 'true',
                daños: props.producto_danos === 'true',
                fianzas: props.producto_fianzas === 'true',
                gmm: props.producto_gmm === 'true',
                vida: props.producto_vida === 'true',
            }
        };

        console.log('📤 Enviando prospecto a Quattro:', prospecto);

        const result = await quattroService.crearProspecto(prospecto);

        res.status(200).json({
            status: 'success',
            message: 'Prospecto creado en Quattro',
            data: result
        });

    } catch (error) {
        console.error('❌ Error en crearProspecto:', error.message);
        res.status(500).json({ error: 'Error creando prospecto en Quattro' });
    }
};

// ─── Caso 2: Cambio en Lifecycle Stage (HubSpot → Quattro) ───────────────────
exports.actualizarLifecycle = async (req, res) => {
    const payload = req.body;
    console.log('📥 Caso 2 - Cambio Lifecycle Stage:', payload);
    saveToFile({ caso: 'lifecycle_change', ...payload });

    try {
        // 1. Identificar el contacto por contactID
        // 2. Actualizar lifecycle stage en Quattro
        const result = await quattroService.actualizarProspecto(payload);

        res.status(200).json({
            status: 'success',
            message: 'Lifecycle Stage actualizado en Quattro',
            data: result
        });

    } catch (error) {
        console.error('Error en actualizarLifecycle:', error.message);
        res.status(500).json({ error: 'Error actualizando lifecycle en Quattro' });
    }
};

// ─── Caso 3: Cambio de estatus del lead (HubSpot → Quattro) ──────────────────
exports.actualizarEstatusLead = async (req, res) => {
    const payload = req.body;
    console.log('📥 Caso 3 - Cambio estatus lead:', payload);
    saveToFile({ caso: 'estatus_lead', ...payload });

    try {
        // 1. Identificar el contacto por contactID
        // 2. Actualizar estatus, motivo de rechazo y etapa del proceso en Quattro
        const result = await quattroService.actualizarProspecto(payload);

        res.status(200).json({
            status: 'success',
            message: 'Estatus del lead actualizado en Quattro',
            data: result
        });

    } catch (error) {
        console.error('Error en actualizarEstatusLead:', error.message);
        res.status(500).json({ error: 'Error actualizando estatus en Quattro' });
    }
};