const fs = require('fs');
const config = require('../config');
const quattroService = require('../services/quattroService');
const hubspotService = require('../services/hubspotService');

// ─── Debounce por contactId ───────────────────────────────────────────────────
const timers = new Map();
const DEBOUNCE_MS = 3000; // 3 segundos

const procesarConDebounce = (contactId, fn) => {
    // Si hay un timer pendiente para este contacto, cancelarlo
    if (timers.has(contactId)) {
        clearTimeout(timers.get(contactId));
        console.log(`⏱️ Debounce: reiniciando timer para contacto ${contactId}`);
    }

    // Programar el procesamiento en DEBOUNCE_MS
    const timer = setTimeout(async () => {
        timers.delete(contactId);
        await fn();
    }, DEBOUNCE_MS);

    timers.set(contactId, timer);
};

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

// ─── Propiedades que deben ignorarse para evitar loops ───────────────────────
const PROPIEDADES_IGNORADAS = new Set([
    'id_quattro',
    'hs_object_id',
    'hs_lastmodifieddate',
    'lastmodifieddate',
    'hs_updated_by_user_id',
]);

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
    const eventos = Array.isArray(req.body) ? req.body : [req.body];
    const evento = eventos[0];
    const subscriptionType = evento.subscriptionType || '';

    const tiposPermitidos = ['contact.creation', 'contact.propertyChange'];
    if (!tiposPermitidos.includes(subscriptionType)) {
        console.log(`⏭️ Ignorando evento: ${subscriptionType}`);
        return res.status(200).json({ status: 'ignored', message: `Evento ${subscriptionType} ignorado` });
    }

    // Ignorar si TODOS los cambios son en propiedades ignoradas
    if (subscriptionType === 'contact.propertyChange') {
        const todasIgnoradas = eventos.every(e => PROPIEDADES_IGNORADAS.has(e.propertyName));
        if (todasIgnoradas) {
            const props = eventos.map(e => e.propertyName).join(', ');
            console.log(`⏭️ Ignorando cambio en propiedades internas: ${props}`);
            return res.status(200).json({ status: 'ignored', message: `Cambio en propiedad interna ignorado` });
        }
        const propsCambiadas = eventos.map(e => e.propertyName).join(', ');
        console.log(`🔔 Propiedades cambiadas: ${propsCambiadas}`);
    }

    const contactId = extraerContactId(req.body);
    console.log('📥 Caso 1 - Formulario llenado:', { contactId, subscriptionType });

    if (!contactId) {
        return res.status(400).json({ error: 'objectId no encontrado en webhook' });
    }

    // Responder inmediatamente a HubSpot para evitar retries
    res.status(200).json({ status: 'queued', message: 'Webhook recibido, procesando...' });

    // Programar el procesamiento con debounce
    procesarConDebounce(contactId, async () => {
        try {
            console.log(`⚙️ Procesando contacto ${contactId} (después de debounce)`);
            const contacto = await hubspotService.obtenerContactoPorId(contactId);
            const props = contacto.properties;
            const prospecto = mapearProspecto(props, 1);

            let result;

            if (props.id_quattro) {
                console.log(`📤 Contacto ya existe en Quattro (${props.id_quattro}), actualizando...`);
                result = await quattroService.actualizarProspecto(prospecto);
            } else {
                console.log('📤 Contacto nuevo, creando en Quattro...');
                result = await quattroService.crearProspecto(prospecto);

                if (result?.contactID) {
                    await hubspotService.actualizarContacto(contactId, {
                        id_quattro: String(result.contactID)
                    });
                    console.log(`✅ ID Quattro ${result.contactID} guardado en HubSpot contacto ${contactId}`);
                }
            }

        } catch (error) {
            console.error('❌ Error en crearProspecto (debounce):', error.message);
        }
    });
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

        const prospecto = mapearProspecto(props, 2);

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