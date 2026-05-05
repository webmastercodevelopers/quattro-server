const validateQuattroSecret = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.QUATTRO_WEBHOOK_SECRET;

    if (!apiKey) {
        console.warn('⚠️ Request sin X-Api-Key rechazado');
        return res.status(401).json({ error: 'API Key requerida' });
    }

    if (apiKey !== expectedKey) {
        console.warn('⚠️ X-Api-Key inválida — request rechazado');
        return res.status(401).json({ error: 'API Key inválida' });
    }

    console.log('✅ API Key de Quattro validada correctamente');
    next();
};

module.exports = validateQuattroSecret;