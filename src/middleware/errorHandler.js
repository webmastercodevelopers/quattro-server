const config = require('../config');

const errorHandler = (err, req, res, next) => {

    // Log detallado en consola
    console.error(`❌ [${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.error(`   Status: ${err.status || 500}`);
    console.error(`   Message: ${err.message}`);
    if (config.NODE_ENV === 'development') console.error(err.stack);

    // Errores conocidos de APIs externas
    if (err.response) {
        return res.status(502).json({
            status: 'error',
            message: 'Error comunicándose con API externa',
            source: err.config?.url || 'unknown',
            ...(config.NODE_ENV === 'development' && {
                detail: err.response.data,
                stack: err.stack
            })
        });
    }

    res.status(err.status || 500).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
        ...(config.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;