const axios = require('axios');
const config = require('../config');

const quattro = axios.create({
    baseURL: config.QUATTRO_API_URL,
    headers: {
        'Content-Type': 'application/json',
        // Descomentar cuando COPSIS confirme el tipo de autenticación
        // 'Authorization': `Bearer ${config.QUATTRO_API_KEY}`,
        // 'x-api-key': config.QUATTRO_API_KEY,
    }
});

// ─── Mapeo de campos HubSpot → Quattro ───────────────────────────────────────
const mapearProspecto = (payload) => {
    return {
        contactID: payload.contactID || 0,
        firstName: payload.firstName || '',
        lastName: payload.lastName || '',
        email: payload.email || '',
        job: payload.job || payload.jobtitle || '',
        companyName: payload.companyName || payload.company || '',
        contacto: payload.contacto || '',
        cp: payload.cp || '00000',
        giro: payload.giro || payload.industry || '',
        noColaboradores: payload.noColaboradores || '0',
        status: payload.status || 1,
        productos: {
            autos: payload.productos?.autos ?? false,
            accidentesPersonales: payload.productos?.accidentesPersonales ?? false,
            daños: payload.productos?.daños ?? false,
            fianzas: payload.productos?.fianzas ?? false,
            gmm: payload.productos?.gmm ?? false,
            vida: payload.productos?.vida ?? false,
        }
    };
};

// ─── Caso 1: Crear prospecto en Quattro ──────────────────────────────────────
exports.crearProspecto = async (payload) => {
    try {
        const body = mapearProspecto(payload);
        console.log('📤 Enviando prospecto a Quattro:', body);

        const res = await quattro.post('/hubspot/prospecto', body);
        console.log('✅ Respuesta Quattro:', res.data);

        // Quattro regresa { ok: true, result: { contactID: 455 } }
        if (!res.data.ok) {
            throw new Error('Quattro respondió ok: false');
        }

        return res.data.result;

    } catch (error) {
        console.error('Error creando prospecto en Quattro:', error.message);
        throw error;
    }
};

// ─── Casos 2 y 3: Actualizar prospecto en Quattro ────────────────────────────
exports.actualizarProspecto = async (payload) => {
    try {
        const contactID = payload.contactID || payload.hs_object_id;

        if (!contactID) {
            throw new Error('contactID requerido para actualizar prospecto');
        }

        const body = mapearProspecto(payload);
        console.log(`📤 Actualizando prospecto ${contactID} en Quattro:`, body);

        // Mismo endpoint que crear, pero con PUT o PATCH
        const res = await quattro.put('/hubspot/prospecto', body);
        console.log('✅ Respuesta Quattro:', res.data);

        if (!res.data.ok) {
            throw new Error('Quattro respondió ok: false');
        }

        return res.data.result;

    } catch (error) {
        console.error('Error actualizando prospecto en Quattro:', error.message);
        throw error;
    }
};