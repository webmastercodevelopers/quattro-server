const express = require('express');
const axios = require('axios');
const config = require('./src/config');
const webhookRoutes = require('./src/routes/webhook');
const hubspotRoutes = require('./src/routes/hubspot');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// Capturar raw body para validación de firma de HubSpot
app.use((req, res, next) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
        req.rawBody = data;
        try {
            req.body = data ? JSON.parse(data) : {};
        } catch {
            req.body = {};
        }
        next();
    });
});

// Routes
app.use('/api/webhook', webhookRoutes);       // Quattro → HubSpot (Casos 4 y 5)
app.use('/api/hubspot', hubspotRoutes);        // HubSpot → Quattro (Casos 1, 2 y 3)

// Health check endpoint
app.get('/health', async (req, res) => {
    const resultado = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV,
        servicios: {
            quattro_auth: { status: 'unknown' },
            hubspot_api: { status: 'unknown' }
        }
    };

    // ── Verificar conectividad con Quattro (tokenizador) ──
    try {
        const res = await axios.post(config.QUATTRO_AUTH_URL, {}, {
            headers: { 'Authorization': config.QUATTRO_BASIC_AUTH },
            timeout: 5000
        });
        if (res.data?.result?.token) {
            resultado.servicios.quattro_auth = { status: 'ok' };
        } else {
            resultado.servicios.quattro_auth = { status: 'error', detalle: 'Token no recibido' };
        }
    } catch (err) {
        resultado.servicios.quattro_auth = {
            status: 'error',
            detalle: err.response?.data?.message || err.message
        };
    }

    // ── Verificar conectividad con HubSpot API ──
    try {
        const hsRes = await axios.get('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
            headers: { 'Authorization': `Bearer ${config.HUBSPOT_API_KEY}` },
            timeout: 5000
        });
        resultado.servicios.hubspot_api = { status: hsRes.status === 200 ? 'ok' : 'error' };
    } catch (err) {
        resultado.servicios.hubspot_api = {
            status: 'error',
            detalle: err.response?.data?.message || err.message
        };
    }

    // ── Estado general ──
    const todoOk = Object.values(resultado.servicios).every(s => s.status === 'ok');
    resultado.status = todoOk ? 'ok' : 'degradado';

    res.status(todoOk ? 200 : 207).json(resultado);
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start the server
app.listen(config.PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${config.PORT}`);
    console.log(`📦 Environment: ${config.NODE_ENV}`);
    console.log(`\nEndpoints activos:`);
    console.log(`  POST /api/webhook         → Quattro → HubSpot`);
    console.log(`  POST /api/hubspot/prospecto → HubSpot → Quattro`);
    console.log(`  GET  /health              → Health check\n`);
});

module.exports = app;