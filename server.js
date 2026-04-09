const express = require('express');
const config = require('./src/config');
const webhookRoutes = require('./src/routes/webhook');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/webhook', webhookRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString() 
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start the server
app.listen(config.PORT, () => {
    console.log(`Server is running on http://localhost:${config.PORT}`);
    console.log(`Environment: ${config.NODE_ENV}`);
    console.log(`Waiting for data at POST /api/webhook...`);
});

module.exports = app;
