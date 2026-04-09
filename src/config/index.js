const path = require('path');

module.exports = {
    // Server
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',

    // Data
    DATA_FILE: path.join(__dirname, '../../data/received_data.json'),

    // HubSpot
    HUBSPOT_API_KEY: process.env.HUBSPOT_API_KEY,
    HUBSPOT_PORTAL_ID: process.env.HUBSPOT_PORTAL_ID,

    // Quattro
    QUATTRO_API_URL: process.env.QUATTRO_API_URL || 'https://apiuat.quattrocrm.mx/crm/api',
    QUATTRO_API_KEY: process.env.QUATTRO_API_KEY,
};