// ─── Schemas esperados por caso ───────────────────────────────────────────────
const schemas = {

    // Caso 1 - Crear prospecto
    crearProspecto: {
        required: ['email', 'firstName', 'lastName'],
        optional: [
            'contactID', 'job', 'companyName', 'contacto', 'cp',
            'giro', 'noColaboradores', 'status', 'productos'
        ]
    },

    // Caso 2 - Lifecycle Stage
    actualizarLifecycle: {
        required: ['contactID', 'lifecycleStage'],
        optional: ['email']
    },

    // Caso 3 - Estatus del lead
    actualizarEstatusLead: {
        required: ['contactID'],
        optional: ['estatusLead', 'motivoRechazo', 'etapaProceso', 'email']
    },

    // Caso 4 - Cierre de venta
    cierreVenta: {
        required: ['email', 'numeroPoliza', 'fechaEmision'],
        optional: [
            'nombre', 'apellido', 'telefono', 'empresa',
            'vigenciaDe', 'vigenciaA', 'primaNeta',
            'iva', 'comision', 'estatus', 'vendedor', 'tipoPoliza'
        ]
    },

    // Caso 5 - Cancelación de póliza
    cancelacionPoliza: {
        required: ['email', 'numeroPoliza', 'fechaCancelacion'],
        optional: ['motivoCancelacion', 'idCliente']
    }
};

// ─── Factory: genera middleware para cada schema ──────────────────────────────
const validar = (schemaName) => {
    return (req, res, next) => {
        console.log(`📨 Body recibido en ${schemaName}:`, JSON.stringify(req.body));

        const schema = schemas[schemaName];

        if (!schema) {
            return next(); // Si no hay schema definido, dejar pasar
        }

        const payload = req.body;
        const faltantes = [];

        // Verificar campos requeridos
        schema.required.forEach(campo => {
            if (payload[campo] === undefined || payload[campo] === null || payload[campo] === '') {
                faltantes.push(campo);
            }
        });

        if (faltantes.length > 0) {
            console.warn(`⚠️ Payload inválido para ${schemaName}. Faltan: ${faltantes.join(', ')}`);
            return res.status(400).json({
                status: 'error',
                message: 'Payload inválido',
                campos_faltantes: faltantes
            });
        }

        console.log(`✅ Payload válido para ${schemaName}`);
        next();
    };
};

module.exports = validar;