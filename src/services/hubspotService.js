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

const actualizarContacto = async (contactId, propiedades) => {
    try {
        const res = await hubspot.patch(`/crm/v3/objects/contacts/${contactId}`, {
            properties: propiedades
        });
        console.log(`✅ Contacto ${contactId} actualizado en HubSpot`);
        return res.data;
    } catch (error) {
        console.error(`❌ Error actualizando contacto ${contactId}:`, error.message);
        throw error;
    }
};

exports.actualizarContacto = actualizarContacto;

// ─── Deals ────────────────────────────────────────────────────────────────────

const crearDeal = async (contactId, payload) => {
    try {
        const res = await hubspot.post('/crm/v3/objects/deals', {
            properties: {
                dealname: `Póliza ${payload.numeroPoliza} - ${payload.tipoPoliza || ''}`,
                pipeline: PIPELINE_ID,
                dealstage: ETAPA_EN_PROCESO,
                closedate: payload.fechaEmision,
                amount: payload.primaNeta,
                poliza: payload.numeroPoliza,
                tipo: payload.tipoPoliza,
                vigenciade: payload.vigenciaDe,
                vigencia_a: payload.vigenciaA,
                primaneta: payload.primaNeta,
                iva: String(payload.iva),
                porcentajecomision: String(payload.comision),
                estatus: payload.estatus,
                vendedor: payload.vendedor,
            },
            associations: [{
                to: { id: contactId },
                types: [{
                    associationCategory: 'HUBSPOT_DEFINED',
                    associationTypeId: 3
                }]
            }]
        });

        console.log(`✅ Deal creado: ${res.data.id}`);
        return res.data;

    } catch (error) {
        console.error('Error creando deal:', error.message);
        console.error('HubSpot error response:', JSON.stringify(error.response?.data));
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
                    'firstname', 'lastname', 'email', 'cargo', 'city',
                    'cmo_prefieres_que_te_contactemos', 'company', 'country',
                    'createdate', 'estado_de_la_republica', 'industria_dropdown',
                    'lifecyclestage', 'numero_de_colaboradores',
                    'producto__accidentes_personales_', 'producto__autos_',
                    'producto__danos_', 'producto__fianzas_',
                    'producto__gastos_medicos_mayores_', 'producto__vida_',
                    'que_producto_te_interesa_', 'tipo_de_producto',
                    'lead_scoring_metropoli', 'estatus_del_lead',
                    'motivo_de_rechazo', 'etapa_del_proceso', 'id_quattro'
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


// ─── Buscar Deal por número de póliza ────────────────────────────────────────
const buscarDealPorPoliza = async (numeroPoliza) => {
    try {
        const res = await hubspot.post('/crm/v3/objects/deals/search', {
            filterGroups: [{
                filters: [{
                    propertyName: 'poliza',
                    operator: 'EQ',
                    value: numeroPoliza
                }]
            }],
            properties: ['dealname', 'poliza', 'dealstage', 'pipeline']
        });

        const results = res.data.results;
        if (results.length > 0) {
            console.log(`✅ Deal encontrado por póliza ${numeroPoliza}: ${results[0].id}`);
            return results[0];
        }

        console.log(`⚠️ No existe Deal para póliza: ${numeroPoliza}`);
        return null;

    } catch (error) {
        console.error('Error buscando deal por póliza:', error.message);
        throw error;
    }
};

// ─── Actualizar Deal existente ────────────────────────────────────────────────
const actualizarDeal = async (dealId, payload) => {
    try {
        const res = await hubspot.patch(`/crm/v3/objects/deals/${dealId}`, {
            properties: {
                dealname: `Póliza ${payload.numeroPoliza} - ${payload.tipoPoliza || ''}`,
                closedate: payload.fechaEmision,
                amount: payload.primaNeta,
                poliza: payload.numeroPoliza,
                tipo: payload.tipoPoliza,
                vigenciade: payload.vigenciaDe,
                vigencia_a: payload.vigenciaA,
                primaneta: payload.primaNeta,
                iva: String(payload.iva),
                porcentajecomision: String(payload.comision),
                estatus: payload.estatus,
                vendedor: payload.vendedor,
            }
        });

        console.log(`✅ Deal ${dealId} actualizado`);
        return res.data;

    } catch (error) {
        console.error('Error actualizando deal:', error.message);
        console.error('HubSpot error response:', JSON.stringify(error.response?.data));
        throw error;
    }
};

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

    // 3. Buscar si ya existe un Deal para esta póliza
    const dealExistente = await buscarDealPorPoliza(payload.numeroPoliza);

    let deal;
    if (dealExistente) {
        // Ya existe → actualizar
        console.log(`🔄 Deal ya existe para póliza ${payload.numeroPoliza}, actualizando...`);
        deal = await actualizarDeal(dealExistente.id, payload);
        deal.id = dealExistente.id;
    } else {
        // No existe → crear
        console.log(`🆕 Creando nuevo Deal para póliza ${payload.numeroPoliza}`);
        deal = await crearDeal(contacto.id, payload);
    }

    return {
        contactId: contacto.id,
        dealId: deal.id,
        action: dealExistente ? 'updated' : 'created'
    };
};

// ─── Caso 5: Cancelación de póliza ───────────────────────────────────────────

exports.procesarCancelacion = async (payload) => {
    // 1. Buscar Deal directamente por número de póliza
    const deal = await buscarDealPorPoliza(payload.numeroPoliza);
    if (!deal) throw new Error(`Deal no encontrado para póliza: ${payload.numeroPoliza}`);

    // 2. Mover deal a 'Cierre perdido'
    await moverDealEtapa(deal.id, ETAPA_CIERRE_PERDIDO);

    return {
        dealId: deal.id,
        action: 'cancelled'
    };
};