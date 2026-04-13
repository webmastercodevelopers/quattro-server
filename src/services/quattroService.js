const axios = require('axios');
const config = require('../config');

// ─── Validación de config al arrancar ────────────────────────────────────────
if (!config.QUATTRO_BASIC_AUTH) {
    throw new Error('❌ QUATTRO_BASIC_AUTH no está definido en .env');
}
if (!config.QUATTRO_AUTH_URL) {
    throw new Error('❌ QUATTRO_AUTH_URL no está definido en .env');
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiry = null;

const getToken = async () => {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    try {
        console.log('🔐 Obteniendo token de Quattro...');
        console.log('URL:', config.QUATTRO_AUTH_URL);
        console.log('Auth header presente:', !!config.QUATTRO_BASIC_AUTH);

        const res = await axios.post(config.QUATTRO_AUTH_URL, {}, {
            headers: { 'Authorization': config.QUATTRO_BASIC_AUTH }
        });

        cachedToken = res.data.result.token;
        // Cambiar de 60 minutos a 25 minutos para tener margen
        tokenExpiry = Date.now() + (25 * 60 * 1000);
        console.log('✅ Token obtenido correctamente');
        return cachedToken;

    } catch (error) {
        console.error('❌ Error obteniendo token:', error.message);
        console.error('❌ Response data:', error.response?.data);
        console.error('❌ Response status:', error.response?.status);
        throw error;
    }
};

// ─── Axios instance ───────────────────────────────────────────────────────────
const quattro = axios.create({
    baseURL: config.QUATTRO_API_URL,
    headers: { 'Content-Type': 'application/json' }
});

quattro.interceptors.request.use(async (reqConfig) => {
    const token = await getToken();
    reqConfig.headers['Authorization'] = `Bearer ${token}`;
    return reqConfig;
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

        if (!res.data.ok) {
            throw new Error('Quattro respondió ok: false');
        }

        return res.data.result;

    } catch (error) {
        console.error('❌ Error creando prospecto en Quattro:', error.message);
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

        const res = await quattro.put('/hubspot/prospecto', body);
        console.log('✅ Respuesta Quattro:', res.data);

        if (!res.data.ok) {
            throw new Error('Quattro respondió ok: false');
        }

        return res.data.result;

    } catch (error) {
        console.error('❌ Error actualizando prospecto en Quattro:', error.message);
        throw error;
    }
};