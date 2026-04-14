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

// ─── Helper: mapear props de HubSpot → payload Quattro ───────────────────────
const mapearProspecto = (props) => ({
    contactID: 0,
    firstName: props.firstname || '',
    lastName: props.lastname || '',
    email: props.email || '',
    job: props.cargo || '',
    companyName: props.company || '',
    contacto: props.cmo_prefieres_que_te_contactemos || '',
    cp: props.zip || '00000',
    giro: props.industria_dropdown || '',
    noColaboradores: props.numero_de_colaboradores || '0',
    status: 1,
    productos: {
        autos: props.producto__autos_ === 'true',
        accidentesPersonales: props.producto__accidentes_personales_ === 'true',
        daños: props.producto__danos_ === 'true',
        fianzas: props.producto__fianzas_ === 'true',
        gmm: props.producto__gastos_medicos_mayores_ === 'true',
        vida: props.producto__vida_ === 'true',
    }
});

// ─── Caso 1 y 2b: Entrada principal HubSpot → Quattro ────────────────────────
exports.crearProspecto = async (req, res) => {
    const payload = req.body;
    const eventos = Array.isArray(payload) ? payload : [payload];
    const evento = eventos[0];

    const subscriptionType = evento.subscriptionType;
    const propertyName = evento.propertyName;
    const propertyValue = evento.propertyValue;

    console.log('📥 Webhook HubSpot recibido:', { subscriptionType, propertyName, propertyValue });

    try {
        const contactId = evento.objectId;
        if (!contactId) {
            return res.status(400).json({ error: 'objectId no encontrado en webhook' });
        }

        // ─── Caso 2b: Lead Scoring >= 50 ─────────────────────────────────────
        if (subscriptionType === 'contact.propertyChange' && propertyName === 'lead_scoring_metropoli') {
            const score = parseInt(propertyValue, 10);
            if (isNaN(score) || score < 50) {
                console.log(`⏭️ Lead scoring ${score} < 50, ignorando`);
                return res.status(200).json({ status: 'ignored', message: 'Score menor a 50, no se envía a Quattro' });
            }
            console.log(`🎯 Caso 2b - Lead Scoring ${score} >= 50, enviando a Quattro`);
        }

        // ─── Caso 1: Formulario llenado (contact.creation o form submission) ──
        // Ambos casos consultan el contacto completo y envían a Quattro
        const contacto = await hubspotService.obtenerContactoPorId(contactId);
        const props = contacto.properties;

        const prospecto = mapearProspecto(props);

        console.log('📤 Enviando prospecto a Quattro:', prospecto);
        const result = await quattroService.crearProspecto(prospecto);

        // Guardar el ID de Quattro en HubSpot
        if (result?.contactID) {
            await hubspotService.actualizarContacto(contactId, {
                id_quattro: String(result.contactID)
            });
            console.log(`✅ ID Quattro ${result.contactID} guardado en HubSpot contacto ${contactId}`);
        }

        res.status(200).json({
            status: 'success',
            message: subscriptionType === 'contact.propertyChange'
                ? 'Lead calificado enviado a Quattro'
                : 'Prospecto creado en Quattro',
            data: result
        });


    } catch (error) {
        console.error('❌ Error en crearProspecto:', error.message);
        res.status(500).json({ error: 'Error procesando webhook de HubSpot' });
    }
};

// ─── Caso 2: Cambio en Lifecycle Stage (HubSpot → Quattro) ───────────────────
exports.actualizarLifecycle = async (req, res) => {
    const payload = req.body;
    console.log('📥 Caso 2 - Cambio Lifecycle Stage:', payload);
    saveToFile({ caso: 'lifecycle_change', ...payload });

    try {
        const result = await quattroService.actualizarProspecto(payload);

        res.status(200).json({
            status: 'success',
            message: 'Lifecycle Stage actualizado en Quattro',
            data: result
        });

    } catch (error) {
        console.error('❌ Error en actualizarLifecycle:', error.message);
        res.status(500).json({ error: 'Error actualizando lifecycle en Quattro' });
    }
};

// ─── Caso 3: Cambio de estatus del lead (HubSpot → Quattro) ──────────────────
exports.actualizarEstatusLead = async (req, res) => {
    const payload = req.body;
    console.log('📥 Caso 3 - Cambio estatus lead:', payload);
    saveToFile({ caso: 'estatus_lead', ...payload });

    try {
        const result = await quattroService.actualizarProspecto(payload);

        res.status(200).json({
            status: 'success',
            message: 'Estatus del lead actualizado en Quattro',
            data: result
        });

    } catch (error) {
        console.error('❌ Error en actualizarEstatusLead:', error.message);
        res.status(500).json({ error: 'Error actualizando estatus en Quattro' });
    }
};