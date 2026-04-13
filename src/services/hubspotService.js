const axios = require('axios');
const config = require('../config');

const hubspot = axios.create({
    baseURL: 'https://api.hubapi.com',
    headers: {
        'Authorization': `Bearer ${config.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
    }
});

// ─── IDs del Pipeline (se llenan cuando COPSIS confirme) ─────────────────────
const PIPELINE_ID = process.env.HUBSPOT_PIPELINE_ID;
const ETAPA_EN_PROCESO = process.env.HUBSPOT_ETAPA_EN_PROCESO;
const ETAPA_CIERRE_PERDIDO = process.env.HUBSPOT_ETAPA_CIERRE_PERDIDO;

// ─── Contactos ────────────────────────────────────────────────────────────────

const buscarContactoPorEmail = async (email) => {
    try {
        const res = await hubspot.post('/crm/v3/objects/contacts/search', {
            filterGroups: [{
                filters: [{
                    propertyName: 'email',
                    operator: 'EQ',
                    value: email
                }]
            }],
            properties: ['email', 'firstname', 'lastname', 'hs_object_id']
        });

        const results = res.data.results;
        if (results.length > 0) {
            console.log(`✅ Contacto encontrado: ${results[0].id}`);
            return results[0];
        }

        console.log(`⚠️ Contacto no encontrado para email: ${email}`);
        return null;

    } catch (error) {
        console.error('Error buscando contacto:', error.message);
        throw error;
    }
};

const crearContacto = async (datos) => {
    try {
        const res = await hubspot.post('/crm/v3/objects/contacts', {
            properties: {
                email: datos.email,
                firstname: datos.nombre,
                lastname: datos.apellido || '',
                phone: datos.telefono || '',
                company: datos.empresa || ''
            }
        });

        console.log(`✅ Contacto creado: ${res.data.id}`);
        return res.data;

    } catch (error) {
        console.error('Error creando contacto:', error.message);
        throw error;
    }
};

// ─── Deals ────────────────────────────────────────────────────────────────────

const crearDeal = async (contactId, payload) => {
    try {
        const res = await hubspot.post('/crm/v3/objects/deals', {
            properties: {
                dealname: `Póliza ${payload.numeroPoliza}`,
                pipeline: PIPELINE_ID,
                dealstage: ETAPA_EN_PROCESO,
                closedate: payload.fechaEmision,
                amount: payload.primaNeta,
                // Propiedades custom de Quattro
                numero_poliza: payload.numeroPoliza,
                tipo_poliza: payload.tipoPoliza,
                vigencia_de: payload.vigenciaDe,
                vigencia_a: payload.vigenciaA,
                prima_neta: payload.primaNeta,
                iva: payload.iva,
                comision: payload.comision,
                estatus_poliza: payload.estatus,
                vendedor: payload.vendedor,
            },
            associations: [{
                to: { id: contactId },
                types: [{
                    associationCategory: 'HUBSPOT_DEFINED',
                    associationTypeId: 3 // Contact → Deal
                }]
            }]
        });

        console.log(`✅ Deal creado: ${res.data.id}`);
        return res.data;

    } catch (error) {
        console.error('Error creando deal:', error.message);
        throw error;
    }
};

const buscarDealPorContacto = async (contactId) => {
    try {
        const res = await hubspot.get(`/crm/v3/objects/contacts/${contactId}/associations/deals`);
        const deals = res.data.results;

        if (deals.length > 0) {
            console.log(`✅ Deal encontrado: ${deals[0].id}`);
            return deals[0];
        }

        console.log(`⚠️ No se encontró deal para contacto: ${contactId}`);
        return null;

    } catch (error) {
        console.error('Error buscando deal:', error.message);
        throw error;
    }
};

const moverDealEtapa = async (dealId, etapaId) => {
    try {
        const res = await hubspot.patch(`/crm/v3/objects/deals/${dealId}`, {
            properties: {
                dealstage: etapaId
            }
        });

        console.log(`✅ Deal ${dealId} movido a etapa: ${etapaId}`);
        return res.data;

    } catch (error) {
        console.error('Error moviendo deal:', error.message);
        throw error;
    }
};


const obtenerContactoPorId = async (contactId) => {
    try {
        const res = await hubspot.get(`/crm/v3/objects/contacts/${contactId}`, {
            params: {
                properties: [
                    'email', 'firstname', 'lastname', 'jobtitle', 'company',
                    'zip', 'industry', 'numberofemployees', 'hs_whatsapp_phone',
                    'producto_autos', 'producto_accidentes', 'producto_danos',
                    'producto_fianzas', 'producto_gmm', 'producto_vida'
                ].join(',')
            }
        });
        console.log(`✅ Contacto obtenido: ${contactId}`);
        return res.data;
    } catch (error) {
        console.error(`❌ Error obteniendo contacto ${contactId}:`, error.message);
        throw error;
    }
};

exports.obtenerContactoPorId = obtenerContactoPorId;


// ─── Caso 4: Cierre de venta ──────────────────────────────────────────────────

exports.procesarCierreVenta = async (payload) => {
    // 1. Buscar contacto por email
    let contacto = await buscarContactoPorEmail(payload.email);

    // 2. Si no existe, crearlo
    if (!contacto) {
        contacto = await crearContacto({
            email: payload.email,
            nombre: payload.nombre,
            apellido: payload.apellido,
            telefono: payload.telefono,
            empresa: payload.empresa
        });
    }

    // 3. Crear deal vinculado al contacto en etapa 'En proceso'
    const deal = await crearDeal(contacto.id, payload);

    return {
        contactId: contacto.id,
        dealId: deal.id
    };
};

// ─── Caso 5: Cancelación de póliza ───────────────────────────────────────────

exports.procesarCancelacion = async (payload) => {
    // 1. Buscar contacto por email
    const contacto = await buscarContactoPorEmail(payload.email);
    if (!contacto) throw new Error(`Contacto no encontrado para email: ${payload.email}`);

    // 2. Buscar deal vinculado
    const deal = await buscarDealPorContacto(contacto.id);
    if (!deal) throw new Error(`Deal no encontrado para contacto: ${contacto.id}`);

    // 3. Mover deal a 'Cierre perdido'
    await moverDealEtapa(deal.id, ETAPA_CIERRE_PERDIDO);

    return {
        contactId: contacto.id,
        dealId: deal.id
    };
};