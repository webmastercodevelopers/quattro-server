const express = require('express');
const config = require('./src/config');
const webhookRoutes = require('./src/routes/webhook');
const hubspotRoutes = require('./src/routes/hubspot');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// Middleware
app.use(express.json({ limit: '10kb' }));

// Routes
app.use('/api/webhook', webhookRoutes);       // Quattro → HubSpot (Casos 4 y 5)
app.use('/api/hubspot', hubspotRoutes);        // HubSpot → Quattro (Casos 1, 2 y 3)

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV
    });
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