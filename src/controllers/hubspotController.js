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
const mapearProspecto = (props, status = 1) => ({
    contactID: parseInt(props.id_quattro) || 0,
    firstName: props.firstname || '',
    lastName: props.lastname || '',
    email: props.email || '',
    job: props.cargo || '',
    companyName: props.company || '',
    contacto: props.cmo_prefieres_que_te_contactemos || '',
    cp: props.zip || '00000',
    giro: props.industria_dropdown || '',
    noColaboradores: props.numero_de_colaboradores || '0',
    status,
    productos: {
        autos: props.producto__autos_ === 'true',
        accidentesPersonales: props.producto__accidentes_personales_ === 'true',
        daños: props.producto__danos_ === 'true',
        fianzas: props.producto__fianzas_ === 'true',
        gmm: props.producto__gastos_medicos_mayores_ === 'true',
        vida: props.producto__vida_ === 'true',
    }
});

// ─── Helper: extraer contactId del webhook de HubSpot ────────────────────────
const extraerContactId = (body) => {
    const eventos = Array.isArray(body) ? body : [body];
    return eventos[0]?.objectId || null;
};

// ─── Mapeo de lifecycleStage → status Quattro ────────────────────────────────
const lifecycleToStatus = {
    'subscriber': 1,
    'lead': 1,
    'marketingqualifiedlead': 2,
    'salesqualifiedlead': 3,
    'opportunity': 3,
    'customer': 6,
    'other': 1,
};

// ─── Caso 1: Contacto llena formulario ───────────────────────────────────────
exports.crearProspecto = async (req, res) => {
    const contactId = extraerContactId(req.body);
    const evento = Array.isArray(req.body) ? req.body[0] : req.body;

    console.log('📥 Caso 1 - Formulario llenado:', { contactId, subscriptionType: evento.subscriptionType });

    if (!contactId) {
        return res.status(400).json({ error: 'objectId no encontrado en webhook' });
    }

    try {
        const contacto = await hubspotService.obtenerContactoPorId(contactId);
        const prospecto = mapearProspecto(contacto.properties, 1);

        console.log('📤 Enviando prospecto a Quattro:', prospecto);
        const result = await quattroService.crearProspecto(prospecto);

        if (result?.contactID) {
            await hubspotService.actualizarContacto(contactId, {
                id_quattro: String(result.contactID)
            });
            console.log(`✅ ID Quattro ${result.contactID} guardado en HubSpot contacto ${contactId}`);
        }

        res.status(200).json({
            status: 'success',
            message: 'Prospecto creado en Quattro',
            data: result
        });

    } catch (error) {
        console.error('❌ Error en crearProspecto:', error.message);
        res.status(500).json({ error: 'Error procesando webhook de HubSpot' });
    }
};

// ─── Caso 2a: Cambio en Lifecycle Stage ──────────────────────────────────────
exports.actualizarLifecycle = async (req, res) => {
    const contactId = extraerContactId(req.body);
    const evento = Array.isArray(req.body) ? req.body[0] : req.body;
    const nuevoLifecycle = evento.propertyValue || '';

    console.log('📥 Caso 2a - Lifecycle Stage:', { contactId, nuevoLifecycle });

    if (!contactId) {
        return res.status(400).json({ error: 'objectId no encontrado en webhook' });
    }

    try {
        const contacto = await hubspotService.obtenerContactoPorId(contactId);
        const props = contacto.properties;

        // Verificar que tiene ID de Quattro
        if (!props.id_quattro) {
            console.warn(`⚠️ Contacto ${contactId} no tiene id_quattro, creando en Quattro primero`);
            const prospecto = mapearProspecto(props, 1);
            const result = await quattroService.crearProspecto(prospecto);
            if (result?.contactID) {
                await hubspotService.actualizarContacto(contactId, {
                    id_quattro: String(result.contactID)
                });
                props.id_quattro = String(result.contactID);
            }
        }

        const status = lifecycleToStatus[nuevoLifecycle] || 1;
        const prospecto = mapearProspecto(props, status);

        console.log('📤 Actualizando prospecto en Quattro (lifecycle):', prospecto);
        const result = await quattroService.actualizarProspecto(prospecto);

        saveToFile({ caso: 'lifecycle_change', contactId, nuevoLifecycle, result });

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

// ─── Caso 2b: Lead Scoring >= 50 ─────────────────────────────────────────────
exports.leadScoring = async (req, res) => {
    const contactId = extraerContactId(req.body);
    const evento = Array.isArray(req.body) ? req.body[0] : req.body;
    const score = parseInt(evento.propertyValue, 10);

    console.log('📥 Caso 2b - Lead Scoring:', { contactId, score });

    if (!contactId) {
        return res.status(400).json({ error: 'objectId no encontrado en webhook' });
    }

    if (isNaN(score) || score < 50) {
        console.log(`⏭️ Score ${score} < 50, ignorando`);
        return res.status(200).json({ status: 'ignored', message: 'Score menor a 50' });
    }

    try {
        const contacto = await hubspotService.obtenerContactoPorId(contactId);
        const props = contacto.properties;

        const prospecto = mapearProspecto(props, 2); // status 2 = Cotización

        console.log('📤 Enviando lead calificado a Quattro:', prospecto);

        let result;
        if (props.id_quattro) {
            result = await quattroService.actualizarProspecto(prospecto);
        } else {
            result = await quattroService.crearProspecto(prospecto);
            if (result?.contactID) {
                await hubspotService.actualizarContacto(contactId, {
                    id_quattro: String(result.contactID)
                });
            }
        }

        res.status(200).json({
            status: 'success',
            message: `Lead scoring ${score} enviado a Quattro`,
            data: result
        });

    } catch (error) {
        console.error('❌ Error en leadScoring:', error.message);
        res.status(500).json({ error: 'Error procesando lead scoring' });
    }
};

// ─── Caso 3: Cambio de estatus del lead / motivo rechazo / etapa proceso ──────
exports.actualizarEstatusLead = async (req, res) => {
    const contactId = extraerContactId(req.body);
    const evento = Array.isArray(req.body) ? req.body[0] : req.body;
    const propertyName = evento.propertyName;
    const propertyValue = evento.propertyValue;

    console.log('📥 Caso 3 - Estatus lead:', { contactId, propertyName, propertyValue });

    if (!contactId) {
        return res.status(400).json({ error: 'objectId no encontrado en webhook' });
    }

    try {
        const contacto = await hubspotService.obtenerContactoPorId(contactId);
        const props = contacto.properties;

        if (!props.id_quattro) {
            return res.status(400).json({
                error: `Contacto ${contactId} no tiene id_quattro en HubSpot`
            });
        }

        // Mapear estatus_del_lead de HubSpot → status Quattro
        const statusMap = {
            'new': 1,
            'open': 2,
            'in_progress': 3,
            'open_deal': 4,
            'unqualified': 7,
            'bad_timing': 7,
        };

        const status = statusMap[props.estatus_del_lead] || 1;
        const prospecto = mapearProspecto(props, status);

        console.log('📤 Actualizando estatus en Quattro:', prospecto);
        const result = await quattroService.actualizarProspecto(prospecto);

        saveToFile({ caso: 'estatus_lead', contactId, propertyName, propertyValue, result });

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