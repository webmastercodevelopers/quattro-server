const crypto = require('crypto');

const HUBSPOT_CLIENT_SECRET = '5a311979-9b18-4648-b114-a7a5eb52a667';

const validateHubspotSignature = (req, res, next) => {
    try {
        const signatureV3 = req.headers['x-hubspot-signature-v3'];
        const signatureV1 = req.headers['x-hubspot-signature'];
        const signature = signatureV3 || signatureV1;

        if (!signature) {
            console.warn('⚠️ Request sin firma de HubSpot rechazado');
            return res.status(401).json({ error: 'Firma de HubSpot requerida' });
        }

        const rawBody = req.rawBody || '';
        let expectedSignature;

        if (signatureV3) {
            const timestamp = req.headers['x-hubspot-request-timestamp'];
            const uri = `https://${req.get('host')}${req.originalUrl}`;
            const source = `${req.method}${uri}${rawBody}${timestamp}`;
            expectedSignature = crypto.createHmac('sha256', HUBSPOT_CLIENT_SECRET)
                .update(source)
                .digest('base64');
        } else {
            const source = `${HUBSPOT_CLIENT_SECRET}${rawBody}`;
            expectedSignature = crypto.createHash('sha256')
                .update(source)
                .digest('hex');
        }

        if (signature !== expectedSignature) {
            console.warn('⚠️ Firma de HubSpot inválida — request rechazado');
            return res.status(401).json({ error: 'Firma de HubSpot inválida' });
        }

        console.log('✅ Firma de HubSpot validada correctamente');
        next();

    } catch (error) {
        console.error('❌ Error validando firma de HubSpot:', error.message);
        return res.status(500).json({ error: 'Error validando firma' });
    }
};

module.exports = validateHubspotSignature;